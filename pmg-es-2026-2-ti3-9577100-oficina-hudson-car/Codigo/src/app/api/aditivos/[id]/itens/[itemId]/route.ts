// PATCH/DELETE /api/aditivos/[id]/itens/[itemId]
// PATCH usa controle otimista por item; 409 com estado atual em conflito.
// DELETE só funciona em aditivos editáveis (RASCUNHO/AGUARDANDO).
import { comErros, ok } from '@/lib/http'
import { exigirAutenticacao } from '@/lib/rbac'
import { itemAditivoUpdateSchema } from '@/lib/validation'
import { atualizarItemAditivo, removerItemAditivo } from '@/server/aditivo'

type Ctx = { params: { id: string; itemId: string } }

export function PATCH(req: Request, { params }: Ctx) {
  return comErros(async () => {
    await exigirAutenticacao()
    const dados = itemAditivoUpdateSchema.parse(await req.json())
    const item = await atualizarItemAditivo(params.itemId, dados)
    return ok(item)
  })
}

export function DELETE(_req: Request, { params }: Ctx) {
  return comErros(async () => {
    await exigirAutenticacao()
    await removerItemAditivo(params.itemId)
    return ok({ ok: true })
  })
}
