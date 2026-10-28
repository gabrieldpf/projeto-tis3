// Regras de negócio de GARANTIA (camada de serviço, testável pelo Vitest).
//
// Regras:
//  - Garantias são geradas no momento da ENTREGA da OS (status ENTREGUE).
//  - Somente itens efetivos com garantiaDias > 0 geram garantia.
//  - "Efetivos" = itens do orçamento (aditivoId IS NULL) + itens de aditivos AUTORIZADOS.
//  - Idempotente: se a garantia do item já existe nessa OS, não cria novamente.
//  - validaAte = entregueEm + garantiaDias dias.

import type { Prisma } from '@prisma/client'

/// Retorna itens efetivos de uma OS (orçamento base + aditivos AUTORIZADOS),
/// filtrando opcionalmente só os que têm garantiaDias > 0.
async function itensEfetivos(
  tx: Prisma.TransactionClient,
  ordemServicoId: string,
  soComGarantia = false,
) {
  // Obtém o orcamentoId da OS
  const os = await tx.ordemServico.findUnique({
    where: { id: ordemServicoId },
    select: { orcamentoId: true },
  })
  if (!os) return []

  const where: Prisma.ItemOrcamentoWhereInput = {
    orcamentoId: os.orcamentoId,
    OR: [
      { aditivoId: null },
      { aditivo: { status: 'AUTORIZADO' } },
    ],
  }
  if (soComGarantia) {
    where.garantiaDias = { gt: 0 }
  }

  return tx.itemOrcamento.findMany({ where })
}

/// Gera garantias para todos os itens efetivos com garantiaDias > 0.
/// Idempotente: pula itens que já têm garantia nessa OS.
export async function gerarGarantiasDaOS(
  tx: Prisma.TransactionClient,
  ordemServicoId: string,
  entregueEm: Date,
) {
  const itens = await itensEfetivos(tx, ordemServicoId, true)

  const garantias = []
  for (const item of itens) {
    // Idempotência: não criar segunda vez
    const jaExiste = await tx.garantiaServico.findFirst({
      where: { ordemServicoId, itemOrcamentoId: item.id },
    })
    if (jaExiste) {
      garantias.push(jaExiste)
      continue
    }

    const prazoDias = item.garantiaDias!
    const validaAte = new Date(entregueEm)
    validaAte.setDate(validaAte.getDate() + prazoDias)

    const garantia = await tx.garantiaServico.create({
      data: {
        ordemServicoId,
        itemOrcamentoId: item.id,
        descricao: item.descricao,
        prazoDias,
        iniciaEm: entregueEm,
        validaAte,
      },
    })
    garantias.push(garantia)
  }
  return garantias
}

/// Lista todas as garantias de uma OS, adicionando campo `vigente`.
export async function listarGarantiasDaOS(ordemServicoId: string) {
  const { prisma } = await import('@/lib/db')
  const agora = new Date()
  const garantias = await prisma.garantiaServico.findMany({
    where: { ordemServicoId },
    orderBy: { validaAte: 'asc' },
  })
  return garantias.map((g) => ({ ...g, vigente: g.validaAte >= agora }))
}

/// Lista garantias vigentes (validaAte >= agora) de um veículo, via suas OS.
export async function listarGarantiasVigentesDaOS(ordemServicoIds: string[]) {
  const { prisma } = await import('@/lib/db')
  const agora = new Date()
  const garantias = await prisma.garantiaServico.findMany({
    where: {
      ordemServicoId: { in: ordemServicoIds },
      validaAte: { gte: agora },
    },
    orderBy: { validaAte: 'asc' },
  })
  return garantias.map((g) => ({ ...g, vigente: true }))
}
