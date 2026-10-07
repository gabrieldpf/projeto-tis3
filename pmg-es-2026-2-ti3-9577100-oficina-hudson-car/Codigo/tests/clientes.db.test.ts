// G1 — CRUD/busca de cliente. Busca por nome, telefone e CPF.
import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '@/lib/db'
import { limparTudo } from './helpers'

beforeEach(limparTudo)

async function buscar(q: string) {
  return prisma.cliente.findMany({
    where: {
      ativo: true,
      OR: [
        { nome: { contains: q, mode: 'insensitive' } },
        { telefone: { contains: q } },
        { documento: { contains: q } },
      ],
    },
  })
}

describe('cliente — criação e busca', () => {
  beforeEach(async () => {
    await prisma.cliente.create({ data: { nome: 'Marcos Pereira', telefone: '(16) 99911-2233', documento: '123.456.789-01' } })
    await prisma.cliente.create({ data: { nome: 'Ana Souza', telefone: '(16) 98822-4455', documento: '234.567.890-12' } })
  })

  it('acha por parte do nome (case-insensitive)', async () => {
    const r = await buscar('marcos')
    expect(r).toHaveLength(1)
    expect(r[0]?.nome).toBe('Marcos Pereira')
  })

  it('acha por telefone', async () => {
    const r = await buscar('98822')
    expect(r.map((c) => c.nome)).toEqual(['Ana Souza'])
  })

  it('acha por CPF', async () => {
    const r = await buscar('123.456')
    expect(r.map((c) => c.nome)).toEqual(['Marcos Pereira'])
  })

  it('não retorna cliente inativo (remoção lógica)', async () => {
    const c = await prisma.cliente.findFirstOrThrow({ where: { nome: 'Ana Souza' } })
    await prisma.cliente.update({ where: { id: c.id }, data: { ativo: false } })
    expect(await buscar('Ana')).toHaveLength(0)
  })
})
