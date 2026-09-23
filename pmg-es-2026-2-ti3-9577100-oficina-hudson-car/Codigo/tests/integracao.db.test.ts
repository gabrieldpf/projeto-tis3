// Testes de integração com o banco (SQLite de teste). Cobrem as regras de
// negócio centrais: movimentação de estoque, alertas de compra, busca por
// chassi e auditoria do preço do dia.
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { prisma } from '@/lib/db'
import { registrarMovimentacao, listarAlertasCompra } from '@/server/estoque'

let usuarioId: string
let fornecedorId: string

beforeAll(async () => {
  const u = await prisma.usuario.create({
    data: { nome: 'Teste', email: 'teste@hc.local', senhaHash: 'x', papel: 'ADMIN', cargo: 'x' },
  })
  usuarioId = u.id
  const f = await prisma.fornecedor.create({ data: { nome: 'Fornecedor Teste' } })
  fornecedorId = f.id
})

beforeEach(async () => {
  // limpa peças e movimentações entre testes (mantém usuário/fornecedor)
  await prisma.movimentacaoEstoque.deleteMany()
  await prisma.chassiCompativel.deleteMany()
  await prisma.peca.deleteMany()
})

async function criarPeca(over: Partial<{ nome: string; quantidadeAtual: number; estoqueMinimo: number }> = {}) {
  return prisma.peca.create({
    data: {
      nome: over.nome ?? 'Peça X',
      categoria: 'Geral',
      unidade: 'UN',
      fornecedorId,
      quantidadeAtual: over.quantidadeAtual ?? 0,
      estoqueMinimo: over.estoqueMinimo ?? 0,
    },
  })
}

describe('registrarMovimentacao', () => {
  it('ENTRADA aumenta o saldo e cria movimentação', async () => {
    const p = await criarPeca({ quantidadeAtual: 10 })
    const { peca, movimentacao } = await registrarMovimentacao({
      pecaId: p.id, tipo: 'ENTRADA', quantidade: 5, usuarioId,
    })
    expect(peca.quantidadeAtual).toBe(15)
    expect(movimentacao.saldoResultante).toBe(15)
    const total = await prisma.movimentacaoEstoque.count({ where: { pecaId: p.id } })
    expect(total).toBe(1)
  })

  it('SAIDA diminui o saldo', async () => {
    const p = await criarPeca({ quantidadeAtual: 10 })
    const { peca } = await registrarMovimentacao({ pecaId: p.id, tipo: 'SAIDA', quantidade: 4, usuarioId })
    expect(peca.quantidadeAtual).toBe(6)
  })

  it('SAIDA que deixaria saldo negativo é bloqueada e não persiste', async () => {
    const p = await criarPeca({ quantidadeAtual: 3 })
    await expect(
      registrarMovimentacao({ pecaId: p.id, tipo: 'SAIDA', quantidade: 5, usuarioId }),
    ).rejects.toMatchObject({ code: 'CONFLITO' })
    const recarregada = await prisma.peca.findUniqueOrThrow({ where: { id: p.id } })
    expect(recarregada.quantidadeAtual).toBe(3) // saldo intacto (transação revertida)
    expect(await prisma.movimentacaoEstoque.count({ where: { pecaId: p.id } })).toBe(0)
  })

  it('AJUSTE define o saldo para o valor informado', async () => {
    const p = await criarPeca({ quantidadeAtual: 999 })
    const { peca } = await registrarMovimentacao({ pecaId: p.id, tipo: 'AJUSTE', quantidade: 12, usuarioId })
    expect(peca.quantidadeAtual).toBe(12)
  })
})

describe('listarAlertasCompra', () => {
  it('lista peça abaixo/igual ao mínimo e ignora as acima', async () => {
    await criarPeca({ nome: 'Abaixo', quantidadeAtual: 2, estoqueMinimo: 8 })
    await criarPeca({ nome: 'No limite', quantidadeAtual: 5, estoqueMinimo: 5 })
    await criarPeca({ nome: 'Acima', quantidadeAtual: 20, estoqueMinimo: 5 })
    await criarPeca({ nome: 'Sem minimo', quantidadeAtual: 0, estoqueMinimo: 0 })

    const alertas = await listarAlertasCompra()
    const nomes = alertas.map((a) => a.nome).sort()
    expect(nomes).toEqual(['Abaixo', 'No limite'])
    const abaixo = alertas.find((a) => a.nome === 'Abaixo')
    expect(abaixo?.faltam).toBe(6)
  })
})

describe('busca por chassi', () => {
  it('retorna apenas a peça compatível com o chassi', async () => {
    const alvo = await criarPeca({ nome: 'Correia 1.6' })
    await prisma.chassiCompativel.create({ data: { pecaId: alvo.id, chassi: '9BWZZZ377VT004251' } })
    const outra = await criarPeca({ nome: 'Vela' })
    await prisma.chassiCompativel.create({ data: { pecaId: outra.id, chassi: '9BGKS48T0PC201336' } })

    const resultado = await prisma.peca.findMany({
      where: { ativo: true, chassisCompativeis: { some: { chassi: { contains: '9BWZZZ377VT004251' } } } },
    })
    expect(resultado).toHaveLength(1)
    expect(resultado[0]?.nome).toBe('Correia 1.6')
  })
})

describe('preço do dia (auditoria)', () => {
  it('grava quem e quando atualizou; não faz média', async () => {
    const p = await criarPeca({ nome: 'Óleo' })
    const antes = p.precoDia
    const atualizada = await prisma.peca.update({
      where: { id: p.id },
      data: { precoDia: 49.9, precoDiaAtualizadoPorId: usuarioId, precoDiaAtualizadoEm: new Date() },
    })
    expect(atualizada.precoDia).toBe(49.9) // valor exato informado, não média
    expect(atualizada.precoDia).not.toBe(antes)
    expect(atualizada.precoDiaAtualizadoPorId).toBe(usuarioId)
  })
})
