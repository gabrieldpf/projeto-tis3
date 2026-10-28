// L1 — Baixa automática de estoque ao marcar OS como PRONTA.
//
// Regras verificadas:
//  - Apenas itens tipo PECA com origemPeca=ESTOQUE são baixados.
//  - Cria MovimentacaoEstoque SAIDA com motivo "OS <numero>", usuarioId e ordemServicoId.
//  - Idempotência: 2ª chamada a marcarPronta (revertendo para EM_ANDAMENTO depois) não
//    cria nova SAIDA para o mesmo item (baixaEstoqueEm já preenchido).
//  - Itens MAO_DE_OBRA e COMPRA_AVULSA NÃO geram movimentação.
//  - Peça cujo saldo pós-baixa <= estoqueMinimo aparece nos alertas.
import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '@/lib/db'
import { marcarPronta, atualizarOS } from '@/server/os'
import {
  limparTudo,
  criarUsuario,
  criarCliente,
  criarVeiculo,
  criarMecanico,
  criarPecaComSaldo,
  criarOrcamentoAutorizadoComOS,
} from './helpers'

let usuarioId: string
let clienteId: string
let veiculoId: string
let mecanicoId: string

beforeEach(async () => {
  await limparTudo()
  usuarioId = (await criarUsuario()).id
  clienteId = (await criarCliente()).id
  veiculoId = (await criarVeiculo(clienteId)).id
  mecanicoId = (await criarMecanico()).id
})

describe('marcarPronta — baixa automática de estoque', () => {
  it('item PECA+ESTOQUE gera MovimentacaoEstoque SAIDA e atualiza saldo', async () => {
    const peca = await criarPecaComSaldo(usuarioId, { quantidadeAtual: 10 })

    const { os } = await criarOrcamentoAutorizadoComOS(
      usuarioId, clienteId, veiculoId, mecanicoId,
      [{ tipo: 'PECA', pecaId: peca.id, descricao: '', quantidade: 3, valorUnitario: 0, origemPeca: 'ESTOQUE' }],
    )

    // Avança para EM_ANDAMENTO antes de PRONTA
    const osAndamento = (await atualizarOS(os.id, { status: 'EM_ANDAMENTO', version: os.version }, usuarioId))!
    const { os: osPronta, baixados } = await marcarPronta(osAndamento.id, osAndamento.version, usuarioId)

    // OS deve estar PRONTA
    expect(osPronta!.status).toBe('PRONTA')

    // Item deve aparecer nos baixados
    expect(baixados).toHaveLength(1)
    expect(baixados[0]!.pecaId).toBe(peca.id)
    expect(baixados[0]!.quantidade).toBe(3)
    expect(baixados[0]!.saldoResultante).toBe(7)

    // MovimentacaoEstoque SAIDA com os campos corretos
    const mov = await prisma.movimentacaoEstoque.findFirst({
      where: { tipo: 'SAIDA', pecaId: peca.id },
    })
    expect(mov).not.toBeNull()
    expect(mov!.quantidade).toBe(3)
    expect(mov!.saldoResultante).toBe(7)
    expect(mov!.motivo).toContain(osPronta!.numero)
    expect(mov!.usuarioId).toBe(usuarioId)
    expect(mov!.ordemServicoId).toBe(osPronta!.id)

    // Saldo da peça atualizado no banco
    const pecaAtualizada = await prisma.peca.findUnique({ where: { id: peca.id } })
    expect(pecaAtualizada!.quantidadeAtual).toBe(7)
  })

  it('item MAO_DE_OBRA NÃO gera movimentação de estoque', async () => {
    const { os } = await criarOrcamentoAutorizadoComOS(
      usuarioId, clienteId, veiculoId, mecanicoId,
      [{ tipo: 'MAO_DE_OBRA', descricao: 'Alinhamento', quantidade: 1, valorUnitario: 80 }],
    )
    const osAndamento = (await atualizarOS(os.id, { status: 'EM_ANDAMENTO', version: os.version }, usuarioId))!
    const { baixados } = await marcarPronta(osAndamento.id, osAndamento.version, usuarioId)

    expect(baixados).toHaveLength(0)
    const movs = await prisma.movimentacaoEstoque.findMany({ where: { tipo: 'SAIDA' } })
    expect(movs).toHaveLength(0)
  })

  it('item PECA com origemPeca=COMPRA_AVULSA NÃO gera saída de estoque', async () => {
    const peca = await criarPecaComSaldo(usuarioId, { quantidadeAtual: 5 })

    const { os } = await criarOrcamentoAutorizadoComOS(
      usuarioId, clienteId, veiculoId, mecanicoId,
      [{ tipo: 'PECA', pecaId: peca.id, descricao: '', quantidade: 2, valorUnitario: 0, origemPeca: 'COMPRA_AVULSA' }],
    )
    const osAndamento = (await atualizarOS(os.id, { status: 'EM_ANDAMENTO', version: os.version }, usuarioId))!
    const { baixados } = await marcarPronta(osAndamento.id, osAndamento.version, usuarioId)

    expect(baixados).toHaveLength(0)
    // Saldo não foi alterado
    const pecaDb = await prisma.peca.findUnique({ where: { id: peca.id } })
    expect(pecaDb!.quantidadeAtual).toBe(5)
  })

  it('idempotência: voltar para EM_ANDAMENTO e marcar PRONTA de novo não duplica a SAIDA', async () => {
    const peca = await criarPecaComSaldo(usuarioId, { quantidadeAtual: 10 })

    const { os } = await criarOrcamentoAutorizadoComOS(
      usuarioId, clienteId, veiculoId, mecanicoId,
      [{ tipo: 'PECA', pecaId: peca.id, descricao: '', quantidade: 2, valorUnitario: 0, origemPeca: 'ESTOQUE' }],
    )
    let osAtual = (await atualizarOS(os.id, { status: 'EM_ANDAMENTO', version: os.version }, usuarioId))!
    const { os: osPronta1 } = await marcarPronta(osAtual.id, osAtual.version, usuarioId)

    // Volta para EM_ANDAMENTO (transição PRONTA → EM_ANDAMENTO é válida)
    const osVoltou = (await atualizarOS(osPronta1!.id, { status: 'EM_ANDAMENTO', version: osPronta1!.version }, usuarioId))!

    // Segunda chamada a marcarPronta: o item já tem baixaEstoqueEm preenchido
    const { baixados: baixados2 } = await marcarPronta(osVoltou.id, osVoltou.version, usuarioId)

    // Não deve ter baixado novamente (o item já estava marcado)
    expect(baixados2).toHaveLength(0)

    // Só deve existir UMA movimentação SAIDA para essa peça
    const saidas = await prisma.movimentacaoEstoque.findMany({
      where: { tipo: 'SAIDA', pecaId: peca.id },
    })
    expect(saidas).toHaveLength(1)
  })

  it('peça cujo saldo pós-baixa <= estoqueMinimo aparece nos alertas', async () => {
    // estoqueMinimo = 5, quantidadeAtual = 6, baixa 2 → saldo final = 4 <= 5
    const peca = await criarPecaComSaldo(usuarioId, {
      quantidadeAtual: 6,
      estoqueMinimo: 5,
    })
    // Ajusta estoqueMinimo pois criarPecaComSaldo não expõe esse campo ainda
    await prisma.peca.update({ where: { id: peca.id }, data: { estoqueMinimo: 5 } })

    const { os } = await criarOrcamentoAutorizadoComOS(
      usuarioId, clienteId, veiculoId, mecanicoId,
      [{ tipo: 'PECA', pecaId: peca.id, descricao: '', quantidade: 2, valorUnitario: 0, origemPeca: 'ESTOQUE' }],
    )
    const osAndamento = (await atualizarOS(os.id, { status: 'EM_ANDAMENTO', version: os.version }, usuarioId))!
    const { alertas } = await marcarPronta(osAndamento.id, osAndamento.version, usuarioId)

    expect(alertas).toHaveLength(1)
    expect(alertas[0]!.id).toBe(peca.id)
    expect(alertas[0]!.quantidadeAtual).toBe(4)
    expect(alertas[0]!.estoqueMinimo).toBe(5)
  })

  it('peça com saldo acima do mínimo após baixa NÃO aparece nos alertas', async () => {
    // estoqueMinimo = 3, quantidadeAtual = 10, baixa 2 → saldo = 8 > 3
    const peca = await criarPecaComSaldo(usuarioId, { quantidadeAtual: 10 })
    await prisma.peca.update({ where: { id: peca.id }, data: { estoqueMinimo: 3 } })

    const { os } = await criarOrcamentoAutorizadoComOS(
      usuarioId, clienteId, veiculoId, mecanicoId,
      [{ tipo: 'PECA', pecaId: peca.id, descricao: '', quantidade: 2, valorUnitario: 0, origemPeca: 'ESTOQUE' }],
    )
    const osAndamento = (await atualizarOS(os.id, { status: 'EM_ANDAMENTO', version: os.version }, usuarioId))!
    const { alertas } = await marcarPronta(osAndamento.id, osAndamento.version, usuarioId)

    expect(alertas).toHaveLength(0)
  })
})
