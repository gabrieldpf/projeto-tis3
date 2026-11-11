// Relatórios financeiros (camada de serviço — ADMIN/financeiro, regra de ouro nº 2).
//
// Derivados de OS ENTREGUE:
//  - serie: por mês, nº de carros e faturamento (= soma dos itens efetivos).
//    Sem período, são os últimos 6 meses; com `de`/`ate`, os meses do intervalo.
//  - totalCarros / totalFaturamento: somatório do período da série.
//  - ticketMedioPeriodo: totalFaturamento / totalCarros (0 se nenhum carro).
//  - variacao: variação % de carros e faturamento vs. o período ANTERIOR de
//    igual duração (null quando o anterior é 0 — sem base de comparação).
//  - faturamentoMes / faturamentoMesAnterior / ticketMedio: sempre do mês
//    corrente / anterior (dashboard padrão), independentes do filtro.
//  - aReceber: soma dos itens de OS PRONTA (prontas, ainda não entregues).
//
// RF11 pede comparativo nº de carros × faturamento (NÃO proporcionais).
// totalServico de cada OS = soma dos itens efetivos (orçamento base + aditivos
// AUTORIZADOS). As consultas são em lote (evitam N+1 por mês/OS).

import { prisma } from '@/lib/db'
import { ApiError } from '@/lib/http'
import type { RelatorioFinanceiroApi } from '@/lib/api'

/// Nomes de mês em pt-BR abreviados.
const MESES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

/// Rótulo "Mmm/aa" (ex.: "Nov/26") — inclui o ano para não colidir em períodos
/// que cruzam anos ou passam de 12 meses.
function rotuloMes(d: Date): string {
  return `${MESES_PT[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`
}

function inicioDoMes(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function somaMeses(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}

/// Parse de "yyyy-mm-dd" como data LOCAL (evita o deslocamento de fuso do
/// `new Date('yyyy-mm-dd')`, que é interpretado como UTC). Retorna null se inválida.
function parseDataLocal(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim())
  if (!m) return null
  const [, y, mes, dia] = m
  const d = new Date(Number(y), Number(mes) - 1, Number(dia))
  return Number.isNaN(d.getTime()) ? null : d
}

/// Mapa orcamentoId → total dos itens efetivos (base + aditivos AUTORIZADOS).
/// Uma única query para todos os orçamentos informados.
async function totaisPorOrcamento(orcamentoIds: string[]): Promise<Map<string, number>> {
  const mapa = new Map<string, number>()
  if (orcamentoIds.length === 0) return mapa
  const itens = await prisma.itemOrcamento.findMany({
    where: {
      orcamentoId: { in: orcamentoIds },
      OR: [{ aditivoId: null }, { aditivo: { status: 'AUTORIZADO' } }],
    },
    select: { orcamentoId: true, quantidade: true, valorUnitario: true },
  })
  for (const it of itens) {
    mapa.set(it.orcamentoId, (mapa.get(it.orcamentoId) ?? 0) + it.quantidade * it.valorUnitario)
  }
  return mapa
}

/// Lista as OS ENTREGUE num intervalo [inicio, fim) com o total de cada uma.
async function entregasNoIntervalo(
  inicio: Date,
  fim: Date,
): Promise<{ entregueEm: Date; total: number }[]> {
  const oss = await prisma.ordemServico.findMany({
    where: { status: 'ENTREGUE', entregueEm: { gte: inicio, lt: fim } },
    select: { orcamentoId: true, entregueEm: true },
  })
  const totais = await totaisPorOrcamento(oss.map((o) => o.orcamentoId))
  return oss.map((o) => ({ entregueEm: o.entregueEm as Date, total: totais.get(o.orcamentoId) ?? 0 }))
}

/// Variação percentual de `atual` vs `anterior`. null se não há base (anterior 0).
function variacaoPct(atual: number, anterior: number): number | null {
  if (anterior === 0) return null
  return ((atual - anterior) / anterior) * 100
}

/// Calcula o relatório financeiro para o período informado (ou últimos 6 meses).
export async function obterRelatorioFinanceiro(params: {
  de?: string
  ate?: string
}): Promise<RelatorioFinanceiroApi> {
  const agora = new Date()

  // --- Janela da série -------------------------------------------------------
  let primeiroMes: Date
  let fimExclusivo: Date // 1º dia do mês SEGUINTE ao último mês do período
  let numMeses: number

  const temPeriodo = Boolean(params.de || params.ate)
  if (temPeriodo) {
    if (!params.de || !params.ate) {
      throw new ApiError('DADOS_INVALIDOS', 'Informe as duas datas do período (de e até).')
    }
    const dDe = parseDataLocal(params.de)
    const dAte = parseDataLocal(params.ate)
    if (!dDe || !dAte) {
      throw new ApiError('DADOS_INVALIDOS', 'Datas inválidas (use o formato yyyy-mm-dd).')
    }
    if (dDe > dAte) {
      throw new ApiError('DADOS_INVALIDOS', 'A data inicial não pode ser maior que a final.')
    }
    primeiroMes = inicioDoMes(dDe)
    fimExclusivo = somaMeses(inicioDoMes(dAte), 1)
    numMeses =
      (dAte.getFullYear() - dDe.getFullYear()) * 12 + (dAte.getMonth() - dDe.getMonth()) + 1
  } else {
    primeiroMes = somaMeses(inicioDoMes(agora), -5)
    fimExclusivo = somaMeses(inicioDoMes(agora), 1)
    numMeses = 6
  }

  // --- Série por mês (uma consulta para toda a janela) -----------------------
  const entregas = await entregasNoIntervalo(primeiroMes, fimExclusivo)
  const serie: { periodo: string; carros: number; faturamento: number }[] = []
  for (let mes = new Date(primeiroMes); mes < fimExclusivo; mes = somaMeses(mes, 1)) {
    const ini = mes
    const fim = somaMeses(mes, 1)
    const doMes = entregas.filter((e) => e.entregueEm >= ini && e.entregueEm < fim)
    serie.push({
      periodo: rotuloMes(mes),
      carros: doMes.length,
      faturamento: doMes.reduce((s, e) => s + e.total, 0),
    })
  }

  const totalCarros = serie.reduce((s, m) => s + m.carros, 0)
  const totalFaturamento = serie.reduce((s, m) => s + m.faturamento, 0)
  const ticketMedioPeriodo = totalCarros > 0 ? totalFaturamento / totalCarros : 0

  // --- Período anterior de igual duração (para a variação) -------------------
  const anteriorInicio = somaMeses(primeiroMes, -numMeses)
  const anteriorFim = primeiroMes
  const entregasAnt = await entregasNoIntervalo(anteriorInicio, anteriorFim)
  const carrosAnt = entregasAnt.length
  const faturamentoAnt = entregasAnt.reduce((s, e) => s + e.total, 0)

  // --- Mês corrente / anterior (dashboard padrão) ----------------------------
  const inicioMes = inicioDoMes(agora)
  const entregasMes = await entregasNoIntervalo(inicioMes, somaMeses(inicioMes, 1))
  const faturamentoMes = entregasMes.reduce((s, e) => s + e.total, 0)
  const ticketMedio = entregasMes.length > 0 ? faturamentoMes / entregasMes.length : 0

  const inicioMesAnterior = somaMeses(inicioMes, -1)
  const entregasMesAnterior = await entregasNoIntervalo(inicioMesAnterior, inicioMes)
  const faturamentoMesAnterior = entregasMesAnterior.reduce((s, e) => s + e.total, 0)

  // --- A receber: OS PRONTA (ainda não entregue) -----------------------------
  const prontas = await prisma.ordemServico.findMany({
    where: { status: 'PRONTA' },
    select: { orcamentoId: true },
  })
  const totaisProntas = await totaisPorOrcamento(prontas.map((o) => o.orcamentoId))
  const aReceber = prontas.reduce((s, o) => s + (totaisProntas.get(o.orcamentoId) ?? 0), 0)

  return {
    faturamentoMes,
    faturamentoMesAnterior,
    ticketMedio,
    aReceber,
    serie,
    periodo: {
      de: temPeriodo ? params.de! : null,
      ate: temPeriodo ? params.ate! : null,
    },
    totalCarros,
    totalFaturamento,
    ticketMedioPeriodo,
    variacao: {
      carros: variacaoPct(totalCarros, carrosAnt),
      faturamento: variacaoPct(totalFaturamento, faturamentoAnt),
    },
  }
}
