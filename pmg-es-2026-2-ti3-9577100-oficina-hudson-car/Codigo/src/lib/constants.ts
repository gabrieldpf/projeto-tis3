// Constantes de domínio compartilhadas (client + server).
// Como o SQLite não tem enums, estes valores são a fonte da verdade usada
// tanto na validação (Zod) quanto no RBAC e na UI.

export const PAPEIS = ['ADMIN', 'GESTOR', 'OPERACIONAL'] as const
export type Papel = (typeof PAPEIS)[number]

export const UNIDADES = ['UN', 'L', 'KG', 'PC', 'JOGO', 'M'] as const
export type Unidade = (typeof UNIDADES)[number]

export const TIPOS_MOVIMENTACAO = ['ENTRADA', 'SAIDA', 'AJUSTE'] as const
export type TipoMovimentacao = (typeof TIPOS_MOVIMENTACAO)[number]

// Status de orçamento e de ordem de serviço (UPPERCASE — enums persistidos,
// validados com Zod, iguais ao planejamento da Sprint 2).
export const STATUS_ORCAMENTO = [
  'RASCUNHO',
  'AGUARDANDO_AUTORIZACAO',
  'AUTORIZADO',
  'RECUSADO',
] as const
export type StatusOrcamento = (typeof STATUS_ORCAMENTO)[number]

export const ROTULO_STATUS_ORCAMENTO: Record<StatusOrcamento, string> = {
  RASCUNHO: 'Rascunho',
  AGUARDANDO_AUTORIZACAO: 'Aguardando autorização',
  AUTORIZADO: 'Autorizado',
  RECUSADO: 'Recusado',
}

export const STATUS_OS = [
  'ABERTA',
  'EM_ANDAMENTO',
  'AGUARDANDO_PECA',
  'PRONTA',
  'ENTREGUE',
] as const
export type StatusOS = (typeof STATUS_OS)[number]

export const ROTULO_STATUS_OS: Record<StatusOS, string> = {
  ABERTA: 'Aberta',
  EM_ANDAMENTO: 'Em andamento',
  AGUARDANDO_PECA: 'Aguardando peça',
  PRONTA: 'Pronta',
  ENTREGUE: 'Entregue',
}

// Transições de status válidas da OS (fluxo operacional da oficina).
export const TRANSICOES_OS: Record<StatusOS, StatusOS[]> = {
  ABERTA: ['EM_ANDAMENTO', 'AGUARDANDO_PECA'],
  EM_ANDAMENTO: ['AGUARDANDO_PECA', 'PRONTA'],
  AGUARDANDO_PECA: ['EM_ANDAMENTO', 'PRONTA'],
  PRONTA: ['ENTREGUE', 'EM_ANDAMENTO'],
  ENTREGUE: [],
}

// Tipo de item de orçamento (peça ou mão de obra).
export const TIPOS_ITEM_ORCAMENTO = ['PECA', 'MAO_DE_OBRA'] as const
export type TipoItemOrcamento = (typeof TIPOS_ITEM_ORCAMENTO)[number]

// Forma como o cliente autorizou o orçamento.
export const FORMAS_AUTORIZACAO = ['PRESENCIAL', 'TELEFONE', 'WHATSAPP'] as const
export type FormaAutorizacao = (typeof FORMAS_AUTORIZACAO)[number]

export const ROTULO_FORMA_AUTORIZACAO: Record<FormaAutorizacao, string> = {
  PRESENCIAL: 'Presencial',
  TELEFONE: 'Telefone',
  WHATSAPP: 'WhatsApp',
}

// Rótulos legíveis (pt-BR) para a UI.
export const ROTULO_PAPEL: Record<Papel, string> = {
  ADMIN: 'Administrador',
  GESTOR: 'Gestor',
  OPERACIONAL: 'Operacional',
}

// Papéis que podem ver/alterar dados financeiros — regra de ouro nº 2.
// Nesta sprint ainda não há tela financeira, mas a guarda já nasce pronta.
export const PAPEIS_FINANCEIRO: Papel[] = ['ADMIN']

// Papéis que gerenciam usuários/papéis.
export const PAPEIS_ADMIN: Papel[] = ['ADMIN']

export function ehPapelValido(valor: string): valor is Papel {
  return (PAPEIS as readonly string[]).includes(valor)
}
