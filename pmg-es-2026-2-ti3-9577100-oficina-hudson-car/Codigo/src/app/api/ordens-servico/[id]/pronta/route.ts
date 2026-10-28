// POST /api/ordens-servico/[id]/pronta
// Marca a OS como PRONTA e executa a baixa automática de estoque.
// Retorna: { os, baixados[], pendencias[], alertas[] }
import { comErros, ok } from '@/lib/http'
import { exigirAutenticacao } from '@/lib/rbac'
import { marcarPronta } from '@/server/os'
import { z } from 'zod'

type Ctx = { params: { id: string } }

const bodySchema = z.object({
  version: z.number().int('Versão é obrigatória.'),
})

export function POST(req: Request, { params }: Ctx) {
  return comErros(async () => {
    const sessao = await exigirAutenticacao()
    const { version } = bodySchema.parse(await req.json())
    const resultado = await marcarPronta(params.id, version, sessao.sub)
    return ok(resultado)
  })
}
