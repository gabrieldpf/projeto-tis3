// /api/orcamentos/[id] — detalhe (GET) e edição do cabeçalho (PATCH).
// PATCH usa controle otimista (envia `version`); 409 em caso de conflito.
import { prisma } from '@/lib/db'
import { comErros, ok, ApiError } from '@/lib/http'
import { exigirAutenticacao } from '@/lib/rbac'
import { orcamentoUpdateSchema } from '@/lib/validation'
import { atualizarCabecalho, ORCAMENTO_INCLUDE } from '@/server/orcamento'

type Ctx = { params: { id: string } }

export function GET(_req: Request, { params }: Ctx) {
  return comErros(async () => {
    await exigirAutenticacao()
    const orcamento = await prisma.orcamento.findUnique({
      where: { id: params.id },
      include: ORCAMENTO_INCLUDE,
    })
    if (!orcamento) throw new ApiError('NAO_ENCONTRADO', 'Orçamento não encontrado.')
    return ok(orcamento)
  })
}

export function PATCH(req: Request, { params }: Ctx) {
  return comErros(async () => {
    await exigirAutenticacao()
    const dados = orcamentoUpdateSchema.parse(await req.json())
    const orcamento = await atualizarCabecalho(params.id, dados)
    return ok(orcamento)
  })
}
