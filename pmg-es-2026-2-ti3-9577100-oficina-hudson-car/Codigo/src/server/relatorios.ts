// Relatórios financeiros (camada de serviço — ADMIN/financeiro).
//
// Derivados de OS ENTREGUE:
//  - serie: últimos 6 meses, por mês (nº de carros e faturamento = soma totalServico).
//  - faturamentoMes: mês corrente.
//  - faturamentoMesAnterior: mês anterior.
//  - ticketMedio: faturamentoMes / carros no mês (0 se nenhum).
//  - aReceber: soma totalServico de OS PRONTA (prontas, não entregues).
//
// totalServico de cada OS = soma dos itens efetivos (orçamento base + aditivos AUTORIZADOS).

import { prisma } from '@/lib/db'
import type { RelatorioFinanceiroApi } from '@/lib/api'

/// Nomes de mês em pt-BR abreviados.
const MESES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

/// Soma os itens efetivos de uma OS (orçamento base + aditivos AUTORIZADOS).
async function totalServicoOS(orcamentoId: string): Promise<number> {
  const itens = await prisma.itemOrcamento.findMany({
    where: {
      orcamentoId,
      OR: [
        { aditivoId: null },
        { aditivo: { status: 'AUTORIZADO' } },
      ],
    },
    select: { quantidade: true, valorUnitario: true },
  })
  return itens.reduce((s, it) => s + it.quantidade * it.valorUnitario, 0)
}

/// Calcula relatório financeiro para o período informado (ou últimos 6 meses).
export async function obterRelatorioFinanceiro(params: {
  de?: string
  ate?: string
}): Promise<RelatorioFinanceiroApi> {
  const agora = new Date()

  // --- Série: últimos 6 meses ---
  const serie: { periodo: string; carros: number; faturamento: number }[] = []

  for (let i = 5; i >= 0; i--) {
    const ref = new Date(agora.getFullYear(), agora.getMonth() - i, 1)
    const inicio = new Date(ref.getFullYear(), ref.getMonth(), 1)
    const fim = new Date(ref.getFullYear(), ref.getMonth() + 1, 1)

    const oss = await prisma.ordemServico.findMany({
      where: {
        status: 'ENTREGUE',
        entregueEm: { gte: inicio, lt: fim },
      },
      select: { orcamentoId: true },
    })

    let faturamento = 0
    for (const os of oss) {
      faturamento += await totalServicoOS(os.orcamentoId)
    }

    serie.push({
      periodo: MESES_PT[ref.getMonth()] ?? '',
      carros: oss.length,
      faturamento,
    })
  }

  // --- Mês corrente ---
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1)
  const fimMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 1)

  const osMes = await prisma.ordemServico.findMany({
    where: { status: 'ENTREGUE', entregueEm: { gte: inicioMes, lt: fimMes } },
    select: { orcamentoId: true },
  })
  let faturamentoMes = 0
  for (const os of osMes) faturamentoMes += await totalServicoOS(os.orcamentoId)

  const ticketMedio = osMes.length > 0 ? faturamentoMes / osMes.length : 0

  // --- Mês anterior ---
  const inicioMesAnterior = new Date(agora.getFullYear(), agora.getMonth() - 1, 1)
  const fimMesAnterior = new Date(agora.getFullYear(), agora.getMonth(), 1)

  const osMesAnterior = await prisma.ordemServico.findMany({
    where: { status: 'ENTREGUE', entregueEm: { gte: inicioMesAnterior, lt: fimMesAnterior } },
    select: { orcamentoId: true },
  })
  let faturamentoMesAnterior = 0
  for (const os of osMesAnterior) faturamentoMesAnterior += await totalServicoOS(os.orcamentoId)

  // --- A receber: OS PRONTA (ainda não entregue) ---
  const osProntas = await prisma.ordemServico.findMany({
    where: { status: 'PRONTA' },
    select: { orcamentoId: true },
  })
  let aReceber = 0
  for (const os of osProntas) aReceber += await totalServicoOS(os.orcamentoId)

  return {
    faturamentoMes,
    faturamentoMesAnterior,
    ticketMedio,
    aReceber,
    serie,
  }
}
