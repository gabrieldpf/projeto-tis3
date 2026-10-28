// L2 — Pendência de baixa: saldo insuficiente não trava a OS; resolver pendência.
//
// Regras verificadas:
//  - Saldo insuficiente: OS vai para PRONTA mas o item fica como pendência
//    (baixaEstoqueEm = null, aparece em pendencias[]).
//  - resolverPendencia COMPRA_AVULSA: muda origemPeca para COMPRA_AVULSA, não baixa
//    estoque, não cria MovimentacaoEstoque.
//  - resolverPendencia AJUSTE_ESTOQUE: cria ENTRADA, aumenta saldo, e se OS PRONTA
//    e saldo suficiente, cria SAIDA e seta baixaEstoqueEm no item.
import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '@/lib/db'
import { marcarPronta, resolverPendencia, atualizarOS } from '@/server/os'
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

describe('saldo insuficiente — pendência sem travar OS', () => {
  it('OS vai para PRONTA mesmo com saldo insuficiente; item fica pendente', async () => {
    // Peça com saldo 1, mas a OS precisa de 5
    const peca = await criarPecaComSaldo(usuarioId, { quantidadeAtual: 1 })

    const { os } = await criarOrcamentoAutorizadoComOS(
      usuarioId, clienteId, veiculoId, mecanicoId,
      [{ tipo: 'PECA', pecaId: peca.id, descricao: '', quantidade: 5, valorUnitario: 0, origemPeca: 'ESTOQUE' }],
    )
    const osAndamento = (await atualizarOS(os.id, { status: 'EM_ANDAMENTO', version: os.version }, usuarioId))!
    const { os: osPronta, baixados, pendencias } = await marcarPronta(osAndamento.id, osAndamento.version, usuarioId)

    // OS chega a PRONTA sem lançar erro
    expect(osPronta!.status).toBe('PRONTA')
    // Nada foi baixado (saldo insuficiente)
    expect(baixados).toHaveLength(0)
    // Item aparece como pendência
    expect(pendencias).toHaveLength(1)
    expect(pendencias[0]!.pecaId).toBe(peca.id)
    expect(pendencias[0]!.quantidadeNecessaria).toBe(5)
    expect(pendencias[0]!.saldoAtual).toBe(1)
    expect(pendencias[0]!.faltam).toBe(4)

    // Item no banco: baixaEstoqueEm ainda null
    const item = await prisma.itemOrcamento.findFirst({ where: { pecaId: peca.id } })
    expect(item!.baixaEstoqueEm).toBeNull()
  })
})

describe('resolverPendencia — COMPRA_AVULSA', () => {
  it('muda origemPeca para COMPRA_AVULSA e NÃO cria saída de estoque', async () => {
    const peca = await criarPecaComSaldo(usuarioId, { quantidadeAtual: 0 })

    const { os } = await criarOrcamentoAutorizadoComOS(
      usuarioId, clienteId, veiculoId, mecanicoId,
      [{ tipo: 'PECA', pecaId: peca.id, descricao: '', quantidade: 3, valorUnitario: 0, origemPeca: 'ESTOQUE' }],
    )
    const osAndamento = (await atualizarOS(os.id, { status: 'EM_ANDAMENTO', version: os.version }, usuarioId))!
    const { pendencias } = await marcarPronta(osAndamento.id, osAndamento.version, usuarioId)

    const itemPendente = pendencias[0]!
    const { item } = await resolverPendencia(
      osAndamento.id,
      itemPendente.itemId,
      { acao: 'COMPRA_AVULSA', version: itemPendente.version },
      usuarioId,
    )

    // origemPeca atualizada para COMPRA_AVULSA
    expect(item!.origemPeca).toBe('COMPRA_AVULSA')
    // baixaEstoqueEm continua null (compra avulsa não baixa)
    expect(item!.baixaEstoqueEm).toBeNull()

    // Nenhuma saída gerada
    const saidas = await prisma.movimentacaoEstoque.findMany({ where: { tipo: 'SAIDA', pecaId: peca.id } })
    expect(saidas).toHaveLength(0)
  })

  it('version velha de item → CONFLITO', async () => {
    const peca = await criarPecaComSaldo(usuarioId, { quantidadeAtual: 0 })

    const { os } = await criarOrcamentoAutorizadoComOS(
      usuarioId, clienteId, veiculoId, mecanicoId,
      [{ tipo: 'PECA', pecaId: peca.id, descricao: '', quantidade: 3, valorUnitario: 0, origemPeca: 'ESTOQUE' }],
    )
    const osAndamento = (await atualizarOS(os.id, { status: 'EM_ANDAMENTO', version: os.version }, usuarioId))!
    const { pendencias } = await marcarPronta(osAndamento.id, osAndamento.version, usuarioId)

    const itemPendente = pendencias[0]!
    await expect(
      resolverPendencia(
        osAndamento.id,
        itemPendente.itemId,
        { acao: 'COMPRA_AVULSA', version: 999 }, // versão errada
        usuarioId,
      ),
    ).rejects.toMatchObject({ code: 'CONFLITO' })
  })
})

describe('resolverPendencia — AJUSTE_ESTOQUE', () => {
  it('sobe o saldo (ENTRADA) e, se OS PRONTA e saldo suficiente, baixa (SAIDA) e seta baixaEstoqueEm', async () => {
    const peca = await criarPecaComSaldo(usuarioId, { quantidadeAtual: 1 })

    const { os } = await criarOrcamentoAutorizadoComOS(
      usuarioId, clienteId, veiculoId, mecanicoId,
      [{ tipo: 'PECA', pecaId: peca.id, descricao: '', quantidade: 4, valorUnitario: 0, origemPeca: 'ESTOQUE' }],
    )
    const osAndamento = (await atualizarOS(os.id, { status: 'EM_ANDAMENTO', version: os.version }, usuarioId))!
    const { pendencias } = await marcarPronta(osAndamento.id, osAndamento.version, usuarioId)

    const itemPendente = pendencias[0]!
    const { item, baixado } = await resolverPendencia(
      osAndamento.id,
      itemPendente.itemId,
      { acao: 'AJUSTE_ESTOQUE', quantidade: 10, version: itemPendente.version },
      usuarioId,
    )

    // Item deve estar baixado (baixaEstoqueEm preenchido)
    expect(item!.baixaEstoqueEm).not.toBeNull()
    // Retorno de baixado preenchido
    expect(baixado).not.toBeNull()
    expect(baixado!.quantidade).toBe(4)

    // Deve existir uma ENTRADA e uma SAIDA para a peça
    const movs = await prisma.movimentacaoEstoque.findMany({
      where: { pecaId: peca.id, ordemServicoId: osAndamento.id },
      orderBy: { createdAt: 'asc' },
    })
    const tipos = movs.map((m) => m.tipo)
    expect(tipos).toContain('ENTRADA')
    expect(tipos).toContain('SAIDA')

    // Saldo final: 1 (inicial) + 10 (ajuste) - 4 (baixa) = 7
    const pecaDb = await prisma.peca.findUnique({ where: { id: peca.id } })
    expect(pecaDb!.quantidadeAtual).toBe(7)
  })

  it('AJUSTE_ESTOQUE sem quantidade → DADOS_INVALIDOS', async () => {
    const peca = await criarPecaComSaldo(usuarioId, { quantidadeAtual: 0 })

    const { os } = await criarOrcamentoAutorizadoComOS(
      usuarioId, clienteId, veiculoId, mecanicoId,
      [{ tipo: 'PECA', pecaId: peca.id, descricao: '', quantidade: 3, valorUnitario: 0, origemPeca: 'ESTOQUE' }],
    )
    const osAndamento = (await atualizarOS(os.id, { status: 'EM_ANDAMENTO', version: os.version }, usuarioId))!
    const { pendencias } = await marcarPronta(osAndamento.id, osAndamento.version, usuarioId)

    const itemPendente = pendencias[0]!
    await expect(
      resolverPendencia(
        osAndamento.id,
        itemPendente.itemId,
        { acao: 'AJUSTE_ESTOQUE', version: itemPendente.version }, // sem quantidade
        usuarioId,
      ),
    ).rejects.toMatchObject({ code: 'DADOS_INVALIDOS' })
  })
})
