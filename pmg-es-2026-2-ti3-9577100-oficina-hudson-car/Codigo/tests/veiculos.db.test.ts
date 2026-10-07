// G2 — Veículo: placa única, vínculo com cliente, busca por placa e chassi.
import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '@/lib/db'
import { limparTudo, criarCliente } from './helpers'

beforeEach(limparTudo)

describe('veículo', () => {
  it('fica vinculado ao cliente', async () => {
    const c = await criarCliente()
    const v = await prisma.veiculo.create({ data: { clienteId: c.id, placa: 'AAA-1111', chassi: 'CHS1' } })
    const comCliente = await prisma.veiculo.findUniqueOrThrow({ where: { id: v.id }, include: { cliente: true } })
    expect(comCliente.cliente.id).toBe(c.id)
  })

  it('não permite placa duplicada (placa única)', async () => {
    const c = await criarCliente()
    await prisma.veiculo.create({ data: { clienteId: c.id, placa: 'DUP-0001', chassi: 'X1' } })
    await expect(
      prisma.veiculo.create({ data: { clienteId: c.id, placa: 'DUP-0001', chassi: 'X2' } }),
    ).rejects.toMatchObject({ code: 'P2002' })
  })

  it('busca por placa e por chassi', async () => {
    const c = await criarCliente()
    await prisma.veiculo.create({ data: { clienteId: c.id, placa: 'FGH-1A23', chassi: '9BWZZZ377VT004251', modelo: 'Gol' } })
    await prisma.veiculo.create({ data: { clienteId: c.id, placa: 'JKL-2B34', chassi: '93HGD56209Z100882', modelo: 'Civic' } })

    const porPlaca = await prisma.veiculo.findMany({ where: { placa: { contains: 'FGH' } } })
    expect(porPlaca.map((v) => v.modelo)).toEqual(['Gol'])

    const porChassi = await prisma.veiculo.findMany({ where: { chassi: { contains: '93HGD' } } })
    expect(porChassi.map((v) => v.modelo)).toEqual(['Civic'])
  })
})
