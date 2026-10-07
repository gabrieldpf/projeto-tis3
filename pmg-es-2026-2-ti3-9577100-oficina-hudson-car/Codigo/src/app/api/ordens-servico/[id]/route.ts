// /api/ordens-servico/[id] — detalhe (GET) e atualização (PATCH).
// PATCH troca status (transição validada), mecânico e/ou previsão; otimista.
import { prisma } from '@/lib/db'
import { comErros, ok, ApiError } from '@/lib/http'
import { exigirAutenticacao } from '@/lib/rbac'
import { ordemServicoUpdateSchema } from '@/lib/validation'
import { atualizarOS, OS_INCLUDE } from '@/server/os'

type Ctx = { params: { id: string } }

export function GET(_req: Request, { params }: Ctx) {
  return comErros(async () => {
    await exigirAutenticacao()
    const ordem = await prisma.ordemServico.findUnique({
      where: { id: params.id },
      include: OS_INCLUDE,
    })
    if (!ordem) throw new ApiError('NAO_ENCONTRADO', 'Ordem de serviço não encontrada.')
    return ok(ordem)
  })
}

export function PATCH(req: Request, { params }: Ctx) {
  return comErros(async () => {
    await exigirAutenticacao()
    const dados = ordemServicoUpdateSchema.parse(await req.json())
    const ordem = await atualizarOS(params.id, dados)
    return ok(ordem)
  })
}
