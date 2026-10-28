// L5 — Baixa de itens de aditivo ao marcar PRONTA.
//
// Regras verificadas:
//  - Item de aditivo AUTORIZADO com origemPeca=ESTOQUE é baixado ao marcarPronta.
//  - Item de aditivo RASCUNHO NÃO é baixado.
//  - Item de aditivo AGUARDANDO_AUTORIZACAO NÃO é baixado.
import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '@/lib/db'
import { marcarPronta, atualizarOS } from '@/server/os'
import { criarAditivo, adicionarItemAditivo, executarAcaoAditivo } from '@/server/aditivo'
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

async function prepararOSComAditivo(statusAditivo: 'RASCUNHO' | 'AGUARDANDO_AUTORIZACAO' | 'AUTORIZADO') {
  const peca = await criarPecaComSaldo(usuarioId, { quantidadeAtual: 10 })
  const { orc, os } = await criarOrcamentoAutorizadoComOS(
    usuarioId, clienteId, veiculoId, mecanicoId,
    // Orçamento base sem itens de estoque (para isolar o comportamento do aditivo)
    [{ tipo: 'MAO_DE_OBRA', descricao: 'Revisão geral', quantidade: 1, valorUnitario: 100 }],
  )

  // Cria o aditivo e adiciona um item de peça ESTOQUE
  const aditivo = await criarAditivo({ orcamentoId: orc.id }, usuarioId)
  await adicionarItemAditivo(aditivo.id, {
    tipo: 'PECA',
    pecaId: peca.id,
    descricao: '',
    quantidade: 3,
    valorUnitario: 0,
    origemPeca: 'ESTOQUE',
  })

  // Avança o status do aditivo conforme solicitado
  if (statusAditivo === 'AGUARDANDO_AUTORIZACAO' || statusAditivo === 'AUTORIZADO') {
    await executarAcaoAditivo(aditivo.id, { acao: 'ENVIAR', version: aditivo.version }, usuarioId)
  }
  if (statusAditivo === 'AUTORIZADO') {
    const enviado = await prisma.aditivoOrcamento.findUniqueOrThrow({ where: { id: aditivo.id } })
    await executarAcaoAditivo(
      aditivo.id,
      { acao: 'AUTORIZAR', formaAutorizacao: 'PRESENCIAL', version: enviado.version },
      usuarioId,
    )
  }

  // Avança a OS para EM_ANDAMENTO
  const osAndamento = (await atualizarOS(os.id, { status: 'EM_ANDAMENTO', version: os.version }, usuarioId))!
  return { peca, osAndamento }
}

describe('marcarPronta — itens de aditivo', () => {
  it('item de aditivo AUTORIZADO+ESTOQUE é baixado ao marcar PRONTA', async () => {
    const { peca, osAndamento } = await prepararOSComAditivo('AUTORIZADO')

    const { baixados } = await marcarPronta(osAndamento.id, osAndamento.version, usuarioId)

    // O item do aditivo AUTORIZADO deve ter sido baixado
    expect(baixados).toHaveLength(1)
    expect(baixados[0]!.pecaId).toBe(peca.id)
    expect(baixados[0]!.quantidade).toBe(3)

    // MovimentacaoEstoque SAIDA deve existir
    const saida = await prisma.movimentacaoEstoque.findFirst({
      where: { tipo: 'SAIDA', pecaId: peca.id },
    })
    expect(saida).not.toBeNull()

    // Saldo atualizado: 10 - 3 = 7
    const pecaDb = await prisma.peca.findUnique({ where: { id: peca.id } })
    expect(pecaDb!.quantidadeAtual).toBe(7)
  })

  it('item de aditivo RASCUNHO NÃO é baixado ao marcar PRONTA', async () => {
    const { peca, osAndamento } = await prepararOSComAditivo('RASCUNHO')

    const { baixados } = await marcarPronta(osAndamento.id, osAndamento.version, usuarioId)

    // Nenhum item de aditivo RASCUNHO deve ser baixado
    expect(baixados).toHaveLength(0)

    // Saldo da peça inalterado
    const pecaDb = await prisma.peca.findUnique({ where: { id: peca.id } })
    expect(pecaDb!.quantidadeAtual).toBe(10)
  })

  it('item de aditivo AGUARDANDO_AUTORIZACAO NÃO é baixado ao marcar PRONTA', async () => {
    const { peca, osAndamento } = await prepararOSComAditivo('AGUARDANDO_AUTORIZACAO')

    const { baixados } = await marcarPronta(osAndamento.id, osAndamento.version, usuarioId)

    expect(baixados).toHaveLength(0)

    // Saldo da peça inalterado
    const pecaDb = await prisma.peca.findUnique({ where: { id: peca.id } })
    expect(pecaDb!.quantidadeAtual).toBe(10)
  })
})
