// /api/ordens-servico/[id]
//
// GET  — detalhe completo: OS + itens efetivos + aditivos + garantias + movimentações + totalServico.
// PATCH — atualiza mecânico, previsão e status (exceto PRONTA/ENTREGUE, que têm endpoints dedicados).

import { prisma } from '@/lib/db'
import { comErros, ok, ApiError } from '@/lib/http'
import { exigirAutenticacao } from '@/lib/rbac'
import { ordemServicoUpdateSchema } from '@/lib/validation'
import { atualizarOS, OS_INCLUDE } from '@/server/os'

type Ctx = { params: { id: string } }

export function GET(_req: Request, { params }: Ctx) {
  return comErros(async () => {
    await exigirAutenticacao()

    const os = await prisma.ordemServico.findUnique({
      where: { id: params.id },
      include: {
        ...OS_INCLUDE,
        movimentacoes: {
          orderBy: { createdAt: 'asc' },
        },
        garantias: {
          orderBy: { validaAte: 'asc' },
        },
        orcamento: {
          select: {
            id: true,
            numero: true,
            aditivos: {
              include: {
                itens: { orderBy: { id: 'asc' } },
                orcamento: {
                  select: {
                    id: true,
                    numero: true,
                    ordemServico: { select: { id: true, numero: true } },
                  },
                },
              },
              orderBy: { numero: 'asc' },
            },
          },
        },
      },
    })
    if (!os) throw new ApiError('NAO_ENCONTRADO', 'Ordem de serviço não encontrada.')

    // Itens efetivos: orçamento base (aditivoId null) + aditivos AUTORIZADOS
    const itens = await prisma.itemOrcamento.findMany({
      where: {
        orcamentoId: os.orcamentoId,
        OR: [
          { aditivoId: null },
          { aditivo: { status: 'AUTORIZADO' } },
        ],
      },
      orderBy: { id: 'asc' },
    })

    const totalServico = itens.reduce(
      (s, it) => s + it.quantidade * it.valorUnitario,
      0,
    )

    const agora = new Date()

    // Garantias com campo `vigente`
    const garantias = os.garantias.map((g) => ({
      ...g,
      vigente: g.validaAte >= agora,
    }))

    // Aditivos extraídos do include (dentro de orcamento)
    const aditivos = os.orcamento?.aditivos ?? []

    return ok({
      ...os,
      orcamento: os.orcamento ? { id: os.orcamento.id, numero: os.orcamento.numero } : null,
      itens,
      aditivos,
      garantias,
      movimentacoes: os.movimentacoes,
      totalServico,
    })
  })
}

export function PATCH(req: Request, { params }: Ctx) {
  return comErros(async () => {
    const sessao = await exigirAutenticacao()
    const dados = ordemServicoUpdateSchema.parse(await req.json())
    const ordem = await atualizarOS(params.id, dados, sessao.sub)
    return ok(ordem)
  })
}
