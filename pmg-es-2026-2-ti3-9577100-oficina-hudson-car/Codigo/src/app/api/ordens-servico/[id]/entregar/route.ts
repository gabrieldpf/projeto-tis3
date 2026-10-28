// POST /api/ordens-servico/[id]/entregar
// Transição PRONTA → ENTREGUE. Grava entregueEm e gera garantias.
// Retorna: { os: OrdemServicoApi, garantias: GarantiaApi[] }
import { comErros, ok } from '@/lib/http'
import { exigirAutenticacao } from '@/lib/rbac'
import { entregarOS } from '@/server/os'
import { z } from 'zod'

type Ctx = { params: { id: string } }

const bodySchema = z.object({
  version: z.number().int('Versão é obrigatória.'),
})

export function POST(req: Request, { params }: Ctx) {
  return comErros(async () => {
    await exigirAutenticacao()
    const { version } = bodySchema.parse(await req.json())
    const resultado = await entregarOS(params.id, version)
    // Mapeia garantias adicionando vigente
    const agora = new Date()
    const garantias = resultado.garantias.map((g) => ({
      ...g,
      vigente: g.validaAte >= agora,
    }))
    return ok({ os: resultado.os, garantias })
  })
}
