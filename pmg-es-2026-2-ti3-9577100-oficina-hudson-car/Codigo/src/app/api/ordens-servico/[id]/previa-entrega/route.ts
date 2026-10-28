// GET /api/ordens-servico/[id]/previa-entrega
// Retorna prévia das garantias que serão geradas ao entregar a OS:
// itens efetivos com garantiaDias != null.
import { prisma } from '@/lib/db'
import { comErros, ok, ApiError } from '@/lib/http'
import { exigirAutenticacao } from '@/lib/rbac'

type Ctx = { params: { id: string } }

export function GET(_req: Request, { params }: Ctx) {
  return comErros(async () => {
    await exigirAutenticacao()

    const os = await prisma.ordemServico.findUnique({
      where: { id: params.id },
      select: { orcamentoId: true },
    })
    if (!os) throw new ApiError('NAO_ENCONTRADO', 'Ordem de serviço não encontrada.')

    // Itens efetivos com garantia definida
    const itens = await prisma.itemOrcamento.findMany({
      where: {
        orcamentoId: os.orcamentoId,
        OR: [
          { aditivoId: null },
          { aditivo: { status: 'AUTORIZADO' } },
        ],
        garantiaDias: { not: null },
      },
      orderBy: { id: 'asc' },
    })

    const agora = new Date()
    const itensPreviews = itens
      .filter((it) => it.garantiaDias != null && it.garantiaDias > 0)
      .map((it) => {
        const prazoDias = it.garantiaDias!
        const validaAte = new Date(agora)
        validaAte.setDate(validaAte.getDate() + prazoDias)
        return {
          itemId: it.id,
          descricao: it.descricao,
          tipo: it.tipo as 'PECA' | 'MAO_DE_OBRA',
          prazoDias,
          validaAte: validaAte.toISOString(),
        }
      })

    return ok({ ordemServicoId: params.id, itens: itensPreviews })
  })
}
