// PATCH /api/mecanicos/[id] — editar nome / ativar / desativar (otimista).
import { prisma } from '@/lib/db'
import { comErros, ok, ApiError } from '@/lib/http'
import { exigirAutenticacao } from '@/lib/rbac'
import { mecanicoUpdateSchema } from '@/lib/validation'

type Ctx = { params: { id: string } }

export function PATCH(req: Request, { params }: Ctx) {
  return comErros(async () => {
    await exigirAutenticacao()
    const { version, ...dados } = mecanicoUpdateSchema.parse(await req.json())

    const atual = await prisma.mecanico.findUnique({ where: { id: params.id } })
    if (!atual) throw new ApiError('NAO_ENCONTRADO', 'Mecânico não encontrado.')
    if (version !== undefined && version !== atual.version) {
      throw new ApiError('CONFLITO', 'Este mecânico foi alterado por outra pessoa. Recarregue e tente novamente.')
    }

    const mecanico = await prisma.mecanico.update({
      where: { id: params.id },
      data: { ...dados, version: { increment: 1 } },
    })
    return ok(mecanico)
  })
}
