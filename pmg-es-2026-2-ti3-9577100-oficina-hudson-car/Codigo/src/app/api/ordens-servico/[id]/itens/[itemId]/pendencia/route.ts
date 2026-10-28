// POST /api/ordens-servico/[id]/itens/[itemId]/pendencia
// Resolve um item que não baixou por saldo insuficiente.
//
// acao COMPRA_AVULSA: muda origemPeca → nunca baixa do estoque.
// acao AJUSTE_ESTOQUE: adiciona saldo na peça (ENTRADA) e, se OS PRONTA, baixa
//   o item (SAIDA + baixaEstoqueEm). Retorna item, peca, baixado.
import { comErros, ok } from '@/lib/http'
import { exigirAutenticacao } from '@/lib/rbac'
import { pendenciaItemSchema } from '@/lib/validation'
import { resolverPendencia } from '@/server/os'

type Ctx = { params: { id: string; itemId: string } }

export function POST(req: Request, { params }: Ctx) {
  return comErros(async () => {
    const sessao = await exigirAutenticacao()
    const dados = pendenciaItemSchema.parse(await req.json())
    const resultado = await resolverPendencia(params.id, params.itemId, dados, sessao.sub)
    return ok(resultado)
  })
}
