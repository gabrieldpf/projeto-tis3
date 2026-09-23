// /api/estoque/movimentacoes — registra (POST) e lista (GET) movimentações.
// Toda mudança de saldo passa por aqui (rastreabilidade — hoje peça instalada
// some do estoque sem baixa). A regra vive em src/server/estoque.ts.
import { prisma } from '@/lib/db'
import { comErros, ok } from '@/lib/http'
import { exigirAutenticacao } from '@/lib/rbac'
import { movimentacaoSchema } from '@/lib/validation'
import { registrarMovimentacao } from '@/server/estoque'

export function GET(req: Request) {
  return comErros(async () => {
    await exigirAutenticacao()
    const pecaId = new URL(req.url).searchParams.get('pecaId')?.trim()
    const movimentacoes = await prisma.movimentacaoEstoque.findMany({
      where: pecaId ? { pecaId } : {},
      include: {
        peca: { select: { id: true, nome: true, unidade: true } },
        usuario: { select: { id: true, nome: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return ok(movimentacoes)
  })
}

export function POST(req: Request) {
  return comErros(async () => {
    const sessao = await exigirAutenticacao()
    const dados = movimentacaoSchema.parse(await req.json())
    const resultado = await registrarMovimentacao({ ...dados, usuarioId: sessao.sub })
    return ok(resultado, 201)
  })
}
