// Utilitários de formatação (pt-BR).

export function moeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function data(iso: string): string {
  const [ano, mes, dia] = iso.split('-')
  if (!ano || !mes || !dia) return iso
  return `${dia}/${mes}/${ano}`
}

export function variacaoPercentual(atual: number, anterior: number): string {
  if (anterior === 0) return '—'
  const pct = ((atual - anterior) / anterior) * 100
  const sinal = pct >= 0 ? '+' : ''
  return `${sinal}${pct.toFixed(1)}%`
}
