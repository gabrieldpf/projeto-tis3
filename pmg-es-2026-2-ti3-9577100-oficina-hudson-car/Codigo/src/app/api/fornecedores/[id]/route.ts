// /api/fornecedores/[id] — detalhe (GET), edição (PATCH) e remoção (DELETE).
import { prisma } from '@/lib/db'
import { comErros, ok, ApiError } from '@/lib/http'
import { exigirAutenticacao } from '@/lib/rbac'
import { fornecedorUpdateSchema } from '@/lib/validation'

type Ctx = { params: { id: string } }

export function GET(_req: Request, { params }: Ctx) {
  return comErros(async () => {
    await exigirAutenticacao()
    const fornecedor = await prisma.fornecedor.findUnique({
      where: { id: params.id },
      include: { pecas: { where: { ativo: true }, orderBy: { nome: 'asc' } } },
    })
    if (!fornecedor) throw new ApiError('NAO_ENCONTRADO', 'Fornecedor não encontrado.')
    return ok(fornecedor)
  })
}

export function PATCH(req: Request, { params }: Ctx) {
  return comErros(async () => {
    await exigirAutenticacao()
    const { version, email, ...dados } = fornecedorUpdateSchema.parse(await req.json())

    const atual = await prisma.fornecedor.findUnique({ where: { id: params.id } })
    if (!atual) throw new ApiError('NAO_ENCONTRADO', 'Fornecedor não encontrado.')

    // Concorrência otimista (regra de ouro nº 4): se o cliente enviou uma
    // versão e ela está desatualizada, recusa em vez de sobrescrever.
    if (version !== undefined && version !== atual.version) {
      throw new ApiError(
        'CONFLITO',
        'Este fornecedor foi alterado por outra pessoa. Recarregue e tente novamente.',
      )
    }

    const fornecedor = await prisma.fornecedor.update({
      where: { id: params.id },
      data: {
        ...dados,
        ...(email !== undefined ? { email: email || null } : {}),
        version: { increment: 1 },
      },
    })
    return ok(fornecedor)
  })
}

export function DELETE(_req: Request, { params }: Ctx) {
  return comErros(async () => {
    await exigirAutenticacao()
    const atual = await prisma.fornecedor.findUnique({ where: { id: params.id } })
    if (!atual) throw new ApiError('NAO_ENCONTRADO', 'Fornecedor não encontrado.')
    // Remoção lógica (preserva histórico e evita quebrar peças vinculadas).
    await prisma.fornecedor.update({
      where: { id: params.id },
      data: { ativo: false, version: { increment: 1 } },
    })
    return ok({ ok: true })
  })
}
