// /api/clientes/[id] — detalhe (GET), edição (PATCH) e remoção lógica (DELETE).
import { prisma } from '@/lib/db'
import { comErros, ok, ApiError } from '@/lib/http'
import { exigirAutenticacao } from '@/lib/rbac'
import { clienteUpdateSchema } from '@/lib/validation'

type Ctx = { params: { id: string } }

export function GET(_req: Request, { params }: Ctx) {
  return comErros(async () => {
    await exigirAutenticacao()
    const cliente = await prisma.cliente.findUnique({
      where: { id: params.id },
      include: { veiculos: { where: { ativo: true }, orderBy: { createdAt: 'desc' } } },
    })
    if (!cliente) throw new ApiError('NAO_ENCONTRADO', 'Cliente não encontrado.')
    return ok(cliente)
  })
}

export function PATCH(req: Request, { params }: Ctx) {
  return comErros(async () => {
    await exigirAutenticacao()
    const { version, email, ...dados } = clienteUpdateSchema.parse(await req.json())

    const atual = await prisma.cliente.findUnique({ where: { id: params.id } })
    if (!atual) throw new ApiError('NAO_ENCONTRADO', 'Cliente não encontrado.')
    if (version !== undefined && version !== atual.version) {
      throw new ApiError('CONFLITO', 'Este cliente foi alterado por outra pessoa. Recarregue e tente novamente.')
    }

    const cliente = await prisma.cliente.update({
      where: { id: params.id },
      data: {
        ...dados,
        ...(email !== undefined ? { email: email || null } : {}),
        version: { increment: 1 },
      },
      include: { _count: { select: { veiculos: true } } },
    })
    return ok(cliente)
  })
}

export function DELETE(_req: Request, { params }: Ctx) {
  return comErros(async () => {
    await exigirAutenticacao()
    const atual = await prisma.cliente.findUnique({ where: { id: params.id } })
    if (!atual) throw new ApiError('NAO_ENCONTRADO', 'Cliente não encontrado.')
    // Remoção lógica (preserva histórico e vínculos).
    await prisma.cliente.update({
      where: { id: params.id },
      data: { ativo: false, version: { increment: 1 } },
    })
    return ok({ ok: true })
  })
}
