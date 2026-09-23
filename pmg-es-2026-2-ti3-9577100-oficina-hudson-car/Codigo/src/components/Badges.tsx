// Badges de status reutilizáveis, com rótulos legíveis em pt-BR.

import type { StatusOrcamento, StatusOS } from '../types'

type Cor = 'verde' | 'vermelho' | 'amarelo' | 'azul' | 'cinza'

export function Badge({ cor, texto }: { cor: Cor; texto: string }) {
  return <span className={`badge badge-ponto ${cor}`}>{texto}</span>
}

const ORCAMENTO_MAP: Record<StatusOrcamento, { cor: Cor; texto: string }> = {
  rascunho: { cor: 'cinza', texto: 'Rascunho' },
  aguardando_autorizacao: { cor: 'amarelo', texto: 'Aguardando autorização' },
  autorizado: { cor: 'verde', texto: 'Autorizado' },
  recusado: { cor: 'vermelho', texto: 'Recusado' },
}

export function BadgeOrcamento({ status }: { status: StatusOrcamento }) {
  const { cor, texto } = ORCAMENTO_MAP[status]
  return <Badge cor={cor} texto={texto} />
}

const OS_MAP: Record<StatusOS, { cor: Cor; texto: string }> = {
  aberta: { cor: 'azul', texto: 'Aberta' },
  em_andamento: { cor: 'azul', texto: 'Em andamento' },
  aguardando_peca: { cor: 'amarelo', texto: 'Aguardando peça' },
  pronta: { cor: 'verde', texto: 'Pronta' },
  entregue: { cor: 'cinza', texto: 'Entregue' },
}

export function BadgeOS({ status }: { status: StatusOS }) {
  const { cor, texto } = OS_MAP[status]
  return <Badge cor={cor} texto={texto} />
}
