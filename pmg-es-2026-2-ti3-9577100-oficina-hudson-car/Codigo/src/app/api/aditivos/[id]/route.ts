// /api/aditivos/[id] — detalhe (GET) e atualização de cabeçalho (PATCH).
// PATCH usa controle otimista por `version`; só RASCUNHO/AGUARDANDO são editáveis.
import { prisma } from '@/lib/db'
import { comErros, ok, ApiError } from '@/lib/http'
import { exigirAutenticacao } from '@/lib/rbac'
import { aditivoUpdateSchema } from '@/lib/validation'
import { atualizarCabecalhoAditivo, ADITIVO_INCLUDE } from '@/server/aditivo'

type Ctx = { params: { id: string } }

export function GET(_req: Request, { params }: Ctx) {
  return comErros(async () => {
    await exigirAutenticacao()
    const aditivo = await prisma.aditivoOrcamento.findUnique({
      where: { id: params.id },
      include: ADITIVO_INCLUDE,
    })
    if (!aditivo) throw new ApiError('NAO_ENCONTRADO', 'Aditivo não encontrado.')
    return ok(aditivo)
  })
}

export function PATCH(req: Request, { params }: Ctx) {
  return comErros(async () => {
    await exigirAutenticacao()
    const dados = aditivoUpdateSchema.parse(await req.json())
    const aditivo = await atualizarCabecalhoAditivo(params.id, dados)
    return ok(aditivo)
  })
}
