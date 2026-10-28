// H3 — Teste de integração do fluxo completo:
// cliente → veículo → orçamento → autorização → OS → entrega.
import { describe, it, expect, beforeEach } from 'vitest'
import { criarOrcamento, adicionarItem, executarAcao, totalOrcamento } from '@/server/orcamento'
import { criarOS, atualizarOS, marcarPronta, entregarOS } from '@/server/os'
import { limparTudo, criarUsuario, criarCliente, criarVeiculo, criarMecanico, criarPeca } from './helpers'

beforeEach(limparTudo)

describe('fluxo completo', () => {
  it('cliente → veículo → orçamento → autorização → OS → entregue', async () => {
    const usuario = await criarUsuario()
    const cliente = await criarCliente('Marcos')
    const veiculo = await criarVeiculo(cliente.id, { chassi: '9BWZZZ377VT004251' })
    const mecanico = await criarMecanico('José')
    const peca = await criarPeca({ precoDia: 42.9 })

    // 1) Monta orçamento com uma peça (preço do dia copiado)…
    const orc = await criarOrcamento(
      {
        clienteId: cliente.id,
        veiculoId: veiculo.id,
        itens: [{ tipo: 'PECA', pecaId: peca.id, descricao: '', quantidade: 4, valorUnitario: 0 }],
      },
      usuario.id,
    )
    // …e adiciona mão de obra depois.
    await adicionarItem(orc.id, { tipo: 'MAO_DE_OBRA', descricao: 'Troca de óleo', quantidade: 1, valorUnitario: 120 })

    // 2) Envia e autoriza.
    const enviado = await executarAcao(orc.id, { acao: 'ENVIAR', version: orc.version })
    const autorizado = await executarAcao(orc.id, { acao: 'AUTORIZAR', formaAutorizacao: 'WHATSAPP', version: enviado!.version })
    expect(autorizado?.status).toBe('AUTORIZADO')
    expect(totalOrcamento(autorizado!.itens)).toBeCloseTo(4 * 42.9 + 120, 2)

    // 3) Gera a OS e leva até a entrega via endpoints dedicados (Sprint 3).
    let os = await criarOS({ orcamentoId: orc.id, mecanicoId: mecanico.id, previsaoEntrega: '2026-10-20' })
    expect(os.orcamentoId).toBe(orc.id)
    os = (await atualizarOS(os.id, { status: 'EM_ANDAMENTO', version: os.version }, usuario.id))!
    // Sprint 3: PRONTA e ENTREGUE exigem funções dedicadas (baixa estoque + garantias).
    const { os: osPronta } = await marcarPronta(os.id, os.version, usuario.id)
    const { os: osEntregue } = await entregarOS(osPronta!.id, osPronta!.version)
    expect(osEntregue!.status).toBe('ENTREGUE')
    expect(osEntregue!.entregueEm).toBeTruthy()
  })
})
