// /api/ordens-servico — lista/busca (GET) e criação (POST).
// OS nasce SOMENTE de orçamento AUTORIZADO, 1 por orçamento, mecânico obrigatório.
import { prisma } from '@/lib/db'
import { comErros, ok } from '@/lib/http'
import { exigirAutenticacao } from '@/lib/rbac'
import { ordemServicoCreateSchema } from '@/lib/validation'
import { criarOS, OS_INCLUDE } from '@/server/os'
import type { Prisma } from '@prisma/client'

export function GET(req: Request) {
  return comErros(async () => {
    await exigirAutenticacao()
    const sp = new URL(req.url).searchParams
    const q = sp.get('q')?.trim()
    const status = sp.get('status')?.trim()

    const where: Prisma.OrdemServicoWhereInput = {}
    if (status) where.status = status
    if (q) {
      where.OR = [
        { numero: { contains: q, mode: 'insensitive' } },
        { cliente: { nome: { contains: q, mode: 'insensitive' } } },
        { mecanico: { nome: { contains: q, mode: 'insensitive' } } },
        { veiculo: { placa: { contains: q, mode: 'insensitive' } } },
        { veiculo: { modelo: { contains: q, mode: 'insensitive' } } },
      ]
    }

    const ordens = await prisma.ordemServico.findMany({
      where,
      include: OS_INCLUDE,
      orderBy: { aberturaEm: 'desc' },
    })
    return ok(ordens)
  })
}

export function POST(req: Request) {
  return comErros(async () => {
    await exigirAutenticacao()
    const dados = ordemServicoCreateSchema.parse(await req.json())
    const ordem = await criarOS(dados)
    return ok(ordem, 201)
  })
}
