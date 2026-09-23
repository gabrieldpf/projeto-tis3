// /api/pecas/[id] — detalhe (GET), edição (PATCH), remoção lógica (DELETE).
// Observação: `precoDia` NÃO é alterado aqui — tem endpoint próprio com
// auditoria (regra de ouro nº 3): /api/pecas/[id]/preco-dia.
import { prisma } from '@/lib/db'
import { comErros, ok, ApiError } from '@/lib/http'
import { exigirAutenticacao } from '@/lib/rbac'
import { pecaUpdateSchema } from '@/lib/validation'

type Ctx = { params: { id: string } }

export function GET(_req: Request, { params }: Ctx) {
  return comErros(async () => {
    await exigirAutenticacao()
    const peca = await prisma.peca.findUnique({
      where: { id: params.id },
      include: {
        fornecedor: true,
        chassisCompativeis: true,
        precoDiaAtualizadoPor: { select: { id: true, nome: true } },
        movimentacoes: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    })
    if (!peca) throw new ApiError('NAO_ENCONTRADO', 'Peça não encontrada.')
    return ok(peca)
  })
}

export function PATCH(req: Request, { params }: Ctx) {
  return comErros(async () => {
    await exigirAutenticacao()
    const { version, chassisCompativeis, fornecedorId, codigo, ...dados } =
      pecaUpdateSchema.parse(await req.json())

    const atual = await prisma.peca.findUnique({ where: { id: params.id } })
    if (!atual) throw new ApiError('NAO_ENCONTRADO', 'Peça não encontrada.')

    if (version !== undefined && version !== atual.version) {
      throw new ApiError(
        'CONFLITO',
        'Esta peça foi alterada por outra pessoa. Recarregue e tente novamente.',
      )
    }

    const peca = await prisma.$transaction(async (tx) => {
      // Se vieram chassis, substitui o conjunto (mais simples e previsível).
      if (chassisCompativeis) {
        await tx.chassiCompativel.deleteMany({ where: { pecaId: params.id } })
        if (chassisCompativeis.length) {
          await tx.chassiCompativel.createMany({
            data: chassisCompativeis.map((c) => ({ ...c, pecaId: params.id })),
          })
        }
      }
      return tx.peca.update({
        where: { id: params.id },
        data: {
          ...dados,
          ...(codigo !== undefined ? { codigo: codigo || null } : {}),
          ...(fornecedorId !== undefined ? { fornecedorId: fornecedorId || null } : {}),
          version: { increment: 1 },
        },
        include: { fornecedor: true, chassisCompativeis: true },
      })
    })
    return ok(peca)
  })
}

export function DELETE(_req: Request, { params }: Ctx) {
  return comErros(async () => {
    await exigirAutenticacao()
    const atual = await prisma.peca.findUnique({ where: { id: params.id } })
    if (!atual) throw new ApiError('NAO_ENCONTRADO', 'Peça não encontrada.')
    await prisma.peca.update({
      where: { id: params.id },
      data: { ativo: false, version: { increment: 1 } },
    })
    return ok({ ok: true })
  })
}
