// /api/clientes — lista/busca (GET) e criação (POST).
// ~95% pessoa física; busca por nome, telefone ou documento (CPF).
import { prisma } from '@/lib/db'
import { comErros, ok } from '@/lib/http'
import { exigirAutenticacao } from '@/lib/rbac'
import { clienteCreateSchema } from '@/lib/validation'
import type { Prisma } from '@prisma/client'

export function GET(req: Request) {
  return comErros(async () => {
    await exigirAutenticacao()
    const q = new URL(req.url).searchParams.get('q')?.trim()

    const where: Prisma.ClienteWhereInput = { ativo: true }
    if (q) {
      where.OR = [
        { nome: { contains: q, mode: 'insensitive' } },
        { telefone: { contains: q } },
        { documento: { contains: q } },
      ]
    }

    const clientes = await prisma.cliente.findMany({
      where,
      include: { _count: { select: { veiculos: true } } },
      orderBy: { nome: 'asc' },
    })
    return ok(clientes)
  })
}

export function POST(req: Request) {
  return comErros(async () => {
    await exigirAutenticacao()
    const dados = clienteCreateSchema.parse(await req.json())
    const cliente = await prisma.cliente.create({
      data: { ...dados, email: dados.email || null },
      include: { _count: { select: { veiculos: true } } },
    })
    return ok(cliente, 201)
  })
}
