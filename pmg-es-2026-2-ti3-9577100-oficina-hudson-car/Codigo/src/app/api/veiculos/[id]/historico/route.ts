// GET /api/veiculos/[id]/historico
// Retorna histórico completo do veículo: OS entregues + garantias vigentes.
import { comErros, ok } from '@/lib/http'
import { exigirAutenticacao } from '@/lib/rbac'
import { obterHistoricoVeiculo } from '@/server/historico'

type Ctx = { params: { id: string } }

export function GET(_req: Request, { params }: Ctx) {
  return comErros(async () => {
    await exigirAutenticacao()
    const historico = await obterHistoricoVeiculo(params.id)
    return ok(historico)
  })
}
