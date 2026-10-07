// POST /api/orcamentos/[id]/acao — enviar / autorizar / recusar o orçamento.
// Ao AUTORIZAR grava forma e data. Controle otimista por `version`.
import { comErros, ok } from '@/lib/http'
import { exigirAutenticacao } from '@/lib/rbac'
import { orcamentoAcaoSchema } from '@/lib/validation'
import { executarAcao } from '@/server/orcamento'

type Ctx = { params: { id: string } }

export function POST(req: Request, { params }: Ctx) {
  return comErros(async () => {
    await exigirAutenticacao()
    const dados = orcamentoAcaoSchema.parse(await req.json())
    const orcamento = await executarAcao(params.id, dados)
    return ok(orcamento)
  })
}
