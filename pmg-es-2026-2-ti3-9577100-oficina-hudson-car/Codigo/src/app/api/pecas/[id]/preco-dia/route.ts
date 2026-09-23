// PATCH /api/pecas/[id]/preco-dia — atualiza o "preço do dia" (regra de ouro
// nº 3): sempre manual, nunca média/fixo, com auditoria de quem/quando.
import { prisma } from '@/lib/db'
import { comErros, ok, ApiError } from '@/lib/http'
import { exigirAutenticacao } from '@/lib/rbac'
import { precoDiaSchema } from '@/lib/validation'

type Ctx = { params: { id: string } }

export function PATCH(req: Request, { params }: Ctx) {
  return comErros(async () => {
    const sessao = await exigirAutenticacao()
    const { precoDia } = precoDiaSchema.parse(await req.json())

    const atual = await prisma.peca.findUnique({ where: { id: params.id } })
    if (!atual) throw new ApiError('NAO_ENCONTRADO', 'Peça não encontrada.')

    const peca = await prisma.peca.update({
      where: { id: params.id },
      data: {
        precoDia,
        precoDiaAtualizadoEm: new Date(),
        precoDiaAtualizadoPorId: sessao.sub,
        version: { increment: 1 },
      },
      include: { precoDiaAtualizadoPor: { select: { id: true, nome: true } } },
    })
    return ok(peca)
  })
}
