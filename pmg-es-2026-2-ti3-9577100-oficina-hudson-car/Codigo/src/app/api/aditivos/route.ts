// /api/aditivos — lista (GET) e criação (POST).
//
// GET  ?orcamentoId=&status= → AditivoApi[] (com itens e navegação p/ OS).
// POST { orcamentoId, observacao? } → cria aditivo RASCUNHO.
import { prisma } from '@/lib/db'
import { comErros, ok } from '@/lib/http'
import { exigirAutenticacao } from '@/lib/rbac'
import { aditivoCreateSchema } from '@/lib/validation'
import { criarAditivo, ADITIVO_INCLUDE } from '@/server/aditivo'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'

const criarSchema = aditivoCreateSchema.extend({
  orcamentoId: z.string().trim().min(1, 'Orçamento é obrigatório.'),
})

export function GET(req: Request) {
  return comErros(async () => {
    await exigirAutenticacao()
    const sp = new URL(req.url).searchParams
    const orcamentoId = sp.get('orcamentoId')?.trim()
    const status = sp.get('status')?.trim()

    const where: Prisma.AditivoOrcamentoWhereInput = {}
    if (orcamentoId) where.orcamentoId = orcamentoId
    if (status) where.status = status

    const aditivos = await prisma.aditivoOrcamento.findMany({
      where,
      include: ADITIVO_INCLUDE,
      orderBy: [{ orcamentoId: 'asc' }, { numero: 'asc' }],
    })
    return ok(aditivos)
  })
}

export function POST(req: Request) {
  return comErros(async () => {
    const sessao = await exigirAutenticacao()
    const dados = criarSchema.parse(await req.json())
    const aditivo = await criarAditivo(dados, sessao.sub)
    return ok(aditivo, 201)
  })
}
