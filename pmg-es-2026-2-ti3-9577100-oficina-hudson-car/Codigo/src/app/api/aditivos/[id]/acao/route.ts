// POST /api/aditivos/[id]/acao — ENVIAR / AUTORIZAR / RECUSAR o aditivo.
// Controle otimista por `version`; AUTORIZADO/RECUSADO são imutáveis.
import { comErros, ok } from '@/lib/http'
import { exigirAutenticacao } from '@/lib/rbac'
import { aditivoAcaoSchema } from '@/lib/validation'
import { executarAcaoAditivo } from '@/server/aditivo'

type Ctx = { params: { id: string } }

export function POST(req: Request, { params }: Ctx) {
  return comErros(async () => {
    const sessao = await exigirAutenticacao()
    const dados = aditivoAcaoSchema.parse(await req.json())
    const aditivo = await executarAcaoAditivo(params.id, dados, sessao.sub)
    return ok(aditivo)
  })
}
