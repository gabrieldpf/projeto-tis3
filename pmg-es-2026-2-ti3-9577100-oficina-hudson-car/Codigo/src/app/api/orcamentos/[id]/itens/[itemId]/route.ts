// PATCH/DELETE /api/orcamentos/[id]/itens/[itemId]
// PATCH usa controle otimista POR ITEM (envia `version`); 409 em conflito.
import { comErros, ok } from '@/lib/http'
import { exigirAutenticacao } from '@/lib/rbac'
import { itemUpdateSchema } from '@/lib/validation'
import { atualizarItem, removerItem } from '@/server/orcamento'

type Ctx = { params: { id: string; itemId: string } }

export function PATCH(req: Request, { params }: Ctx) {
  return comErros(async () => {
    await exigirAutenticacao()
    const dados = itemUpdateSchema.parse(await req.json())
    const item = await atualizarItem(params.itemId, dados)
    return ok(item)
  })
}

export function DELETE(_req: Request, { params }: Ctx) {
  return comErros(async () => {
    await exigirAutenticacao()
    await removerItem(params.itemId)
    return ok({ ok: true })
  })
}
