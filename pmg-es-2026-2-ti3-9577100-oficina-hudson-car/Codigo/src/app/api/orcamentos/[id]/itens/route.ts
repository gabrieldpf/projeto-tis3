// POST /api/orcamentos/[id]/itens — adiciona um item (peça ou mão de obra).
// Item de peça copia o preço do dia no momento (regra de ouro nº 3).
import { comErros, ok } from '@/lib/http'
import { exigirAutenticacao } from '@/lib/rbac'
import { itemCreateSchema } from '@/lib/validation'
import { adicionarItem } from '@/server/orcamento'

type Ctx = { params: { id: string } }

export function POST(req: Request, { params }: Ctx) {
  return comErros(async () => {
    await exigirAutenticacao()
    const dados = itemCreateSchema.parse(await req.json())
    const item = await adicionarItem(params.id, dados)
    return ok(item, 201)
  })
}
