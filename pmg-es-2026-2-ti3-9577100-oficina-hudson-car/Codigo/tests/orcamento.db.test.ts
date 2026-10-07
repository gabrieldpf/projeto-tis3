// H1 — Orçamento e itens: criação por veículo, peça + mão de obra, total,
// e a CÓPIA do preço do dia (mudar o preço depois NÃO altera o orçamento).
import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '@/lib/db'
import { criarOrcamento, totalOrcamento } from '@/server/orcamento'
import { limparTudo, criarUsuario, criarCliente, criarVeiculo, criarPeca } from './helpers'

let usuarioId: string
let clienteId: string
let veiculoId: string

beforeEach(async () => {
  await limparTudo()
  usuarioId = (await criarUsuario()).id
  clienteId = (await criarCliente()).id
  veiculoId = (await criarVeiculo(clienteId)).id
})

describe('criarOrcamento', () => {
  it('cria com itens de peça e mão de obra e calcula o total', async () => {
    const peca = await criarPeca({ precoDia: 42.9 })
    const orc = await criarOrcamento(
      {
        clienteId,
        veiculoId,
        itens: [
          { tipo: 'PECA', pecaId: peca.id, descricao: '', quantidade: 4, valorUnitario: 0 },
          { tipo: 'MAO_DE_OBRA', descricao: 'Troca de óleo', quantidade: 1, valorUnitario: 120 },
        ],
      },
      usuarioId,
    )
    expect(orc.numero).toMatch(/^ORC-\d{4}-0001$/)
    expect(orc.itens).toHaveLength(2)
    expect(totalOrcamento(orc.itens)).toBeCloseTo(4 * 42.9 + 120, 2)
  })

  it('COPIA o preço do dia no item de peça (não recalcula depois)', async () => {
    const peca = await criarPeca({ precoDia: 42.9 })
    const orc = await criarOrcamento(
      { clienteId, veiculoId, itens: [{ tipo: 'PECA', pecaId: peca.id, descricao: '', quantidade: 1, valorUnitario: 0 }] },
      usuarioId,
    )
    const item = orc.itens[0]!
    expect(item.valorUnitario).toBe(42.9) // copiou o preço do dia
    expect(item.descricao).toBe('Óleo 5W30') // copiou o nome da peça

    // Preço do dia muda depois → o item já montado NÃO muda.
    await prisma.peca.update({ where: { id: peca.id }, data: { precoDia: 99.9 } })
    const recarregado = await prisma.itemOrcamento.findUniqueOrThrow({ where: { id: item.id } })
    expect(recarregado.valorUnitario).toBe(42.9)
  })

  it('recusa orçamento se o veículo não é do cliente', async () => {
    const outro = await criarCliente('Outro')
    await expect(
      criarOrcamento({ clienteId: outro.id, veiculoId, itens: [] }, usuarioId),
    ).rejects.toMatchObject({ code: 'DADOS_INVALIDOS' })
  })

  it('numera sequencialmente', async () => {
    const a = await criarOrcamento({ clienteId, veiculoId, itens: [] }, usuarioId)
    const b = await criarOrcamento({ clienteId, veiculoId, itens: [] }, usuarioId)
    expect(a.numero).toMatch(/0001$/)
    expect(b.numero).toMatch(/0002$/)
  })
})
