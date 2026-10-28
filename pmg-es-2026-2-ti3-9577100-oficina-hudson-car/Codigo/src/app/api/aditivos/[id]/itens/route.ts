// POST /api/aditivos/[id]/itens — adiciona item ao aditivo.
// Item de peça copia o preço do dia (regra de ouro nº 3).
import { comErros, ok } from '@/lib/http'
import { exigirAutenticacao } from '@/lib/rbac'
import { itemAditivoSchema } from '@/lib/validation'
import { adicionarItemAditivo } from '@/server/aditivo'

type Ctx = { params: { id: string } }

export function POST(req: Request, { params }: Ctx) {
  return comErros(async () => {
    await exigirAutenticacao()
    const dados = itemAditivoSchema.parse(await req.json())
    const item = await adicionarItemAditivo(params.id, dados)
    return ok(item, 201)
  })
}
