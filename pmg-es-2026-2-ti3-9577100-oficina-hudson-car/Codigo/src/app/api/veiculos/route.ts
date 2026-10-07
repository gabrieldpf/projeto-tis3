// /api/veiculos — lista/busca (GET) e criação (POST).
// Busca por placa, chassi, marca, modelo ou nome do cliente (prioridade nº 2).
import { prisma } from '@/lib/db'
import { comErros, ok, ApiError } from '@/lib/http'
import { exigirAutenticacao } from '@/lib/rbac'
import { veiculoCreateSchema } from '@/lib/validation'
import type { Prisma } from '@prisma/client'

export function GET(req: Request) {
  return comErros(async () => {
    await exigirAutenticacao()
    const sp = new URL(req.url).searchParams
    const q = sp.get('q')?.trim()
    const clienteId = sp.get('clienteId')?.trim()

    const where: Prisma.VeiculoWhereInput = { ativo: true }
    if (clienteId) where.clienteId = clienteId
    if (q) {
      where.OR = [
        { placa: { contains: q, mode: 'insensitive' } },
        { chassi: { contains: q, mode: 'insensitive' } },
        { marca: { contains: q, mode: 'insensitive' } },
        { modelo: { contains: q, mode: 'insensitive' } },
        { cliente: { nome: { contains: q, mode: 'insensitive' } } },
      ]
    }

    const veiculos = await prisma.veiculo.findMany({
      where,
      include: { cliente: { select: { id: true, nome: true, telefone: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return ok(veiculos)
  })
}

export function POST(req: Request) {
  return comErros(async () => {
    await exigirAutenticacao()
    const dados = veiculoCreateSchema.parse(await req.json())

    const cliente = await prisma.cliente.findUnique({ where: { id: dados.clienteId } })
    if (!cliente) throw new ApiError('NAO_ENCONTRADO', 'Cliente informado não existe.')

    const veiculo = await prisma.veiculo.create({
      data: {
        ...dados,
        chassi: dados.chassi ? dados.chassi.toUpperCase() : null,
        placa: dados.placa ? dados.placa.toUpperCase() : null,
      },
      include: { cliente: { select: { id: true, nome: true, telefone: true } } },
    })
    return ok(veiculo, 201)
  })
}
