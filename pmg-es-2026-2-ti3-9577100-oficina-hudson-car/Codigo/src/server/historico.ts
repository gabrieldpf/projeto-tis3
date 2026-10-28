// Histórico do veículo (camada de serviço).
//
// Retorna as OS ENTREGUE do veículo com itens efetivos, mecânico, datas,
// total e garantias. Também lista as garantias ainda vigentes (validaAte >= hoje).

import { prisma } from '@/lib/db'
import { ApiError } from '@/lib/http'

/// Retorna o histórico completo de um veículo: OS entregues + garantias vigentes.
export async function obterHistoricoVeiculo(veiculoId: string) {
  const veiculo = await prisma.veiculo.findUnique({
    where: { id: veiculoId },
  })
  if (!veiculo) throw new ApiError('NAO_ENCONTRADO', 'Veículo não encontrado.')

  const agora = new Date()

  // OS entregues do veículo, com itens e garantias
  const ordensRaw = await prisma.ordemServico.findMany({
    where: { veiculoId, status: 'ENTREGUE' },
    orderBy: { entregueEm: 'desc' },
    include: {
      cliente: { select: { id: true, nome: true, telefone: true } },
      veiculo: { select: { id: true, placa: true, marca: true, modelo: true } },
      mecanico: { select: { id: true, nome: true } },
      orcamento: { select: { id: true, numero: true } },
      garantias: true,
    },
  })

  // Para cada OS, busca os itens efetivos (orçamento base + aditivos AUTORIZADOS)
  const ordensEntregues = await Promise.all(
    ordensRaw.map(async (os) => {
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

      const garantias = os.garantias.map((g) => ({
        ...g,
        vigente: g.validaAte >= agora,
      }))

      return {
        ...os,
        itens,
        garantias,
        totalServico,
      }
    }),
  )

  // Garantias vigentes de todo o veículo
  const osIds = ordensRaw.map((o) => o.id)
  const garantiasVigentes =
    osIds.length > 0
      ? await prisma.garantiaServico.findMany({
          where: {
            ordemServicoId: { in: osIds },
            validaAte: { gte: agora },
          },
          orderBy: { validaAte: 'asc' },
        }).then((gs) => gs.map((g) => ({ ...g, vigente: true })))
      : []

  return { veiculo, ordensEntregues, garantiasVigentes }
}
