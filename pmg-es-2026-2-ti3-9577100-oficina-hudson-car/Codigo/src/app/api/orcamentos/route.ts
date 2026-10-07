// /api/orcamentos — lista/busca (GET) e criação (POST).
// Criação usa a camada de serviço (número sequencial em transação; itens com
// cópia do preço do dia — regra de ouro nº 3).
import { prisma } from '@/lib/db'
import { comErros, ok } from '@/lib/http'
import { exigirAutenticacao } from '@/lib/rbac'
import { orcamentoCreateSchema } from '@/lib/validation'
import { criarOrcamento, ORCAMENTO_INCLUDE } from '@/server/orcamento'
import type { Prisma } from '@prisma/client'

export function GET(req: Request) {
  return comErros(async () => {
    await exigirAutenticacao()
    const sp = new URL(req.url).searchParams
    const q = sp.get('q')?.trim()
    const status = sp.get('status')?.trim()

    const where: Prisma.OrcamentoWhereInput = {}
    if (status) where.status = status
    if (q) {
      where.OR = [
        { numero: { contains: q, mode: 'insensitive' } },
        { cliente: { nome: { contains: q, mode: 'insensitive' } } },
        { veiculo: { placa: { contains: q, mode: 'insensitive' } } },
        { veiculo: { modelo: { contains: q, mode: 'insensitive' } } },
      ]
    }

    const orcamentos = await prisma.orcamento.findMany({
      where,
      include: ORCAMENTO_INCLUDE,
      orderBy: { createdAt: 'desc' },
    })
    return ok(orcamentos)
  })
}

export function POST(req: Request) {
  return comErros(async () => {
    const sessao = await exigirAutenticacao()
    const dados = orcamentoCreateSchema.parse(await req.json())
    const orcamento = await criarOrcamento(dados, sessao.sub)
    return ok(orcamento, 201)
  })
}
