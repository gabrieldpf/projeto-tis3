// Badges de status reutilizáveis, com rótulos legíveis em pt-BR.

import {
  ROTULO_STATUS_ORCAMENTO,
  ROTULO_STATUS_OS,
  type StatusOrcamento,
  type StatusOS,
} from '@/lib/constants'

type Cor = 'verde' | 'vermelho' | 'amarelo' | 'azul' | 'cinza'

export function Badge({ cor, texto }: { cor: Cor; texto: string }) {
  return <span className={`badge badge-ponto ${cor}`}>{texto}</span>
}

const ORCAMENTO_COR: Record<StatusOrcamento, Cor> = {
  RASCUNHO: 'cinza',
  AGUARDANDO_AUTORIZACAO: 'amarelo',
  AUTORIZADO: 'verde',
  RECUSADO: 'vermelho',
}

export function BadgeOrcamento({ status }: { status: StatusOrcamento }) {
  return <Badge cor={ORCAMENTO_COR[status]} texto={ROTULO_STATUS_ORCAMENTO[status]} />
}

const OS_COR: Record<StatusOS, Cor> = {
  ABERTA: 'azul',
  EM_ANDAMENTO: 'azul',
  AGUARDANDO_PECA: 'amarelo',
  PRONTA: 'verde',
  ENTREGUE: 'cinza',
}

export function BadgeOS({ status }: { status: StatusOS }) {
  return <Badge cor={OS_COR[status]} texto={ROTULO_STATUS_OS[status]} />
}
