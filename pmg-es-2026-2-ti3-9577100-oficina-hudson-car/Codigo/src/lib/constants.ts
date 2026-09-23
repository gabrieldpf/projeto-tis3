// Constantes de domínio compartilhadas (client + server).
// Como o SQLite não tem enums, estes valores são a fonte da verdade usada
// tanto na validação (Zod) quanto no RBAC e na UI.

export const PAPEIS = ['ADMIN', 'GESTOR', 'OPERACIONAL'] as const
export type Papel = (typeof PAPEIS)[number]

export const UNIDADES = ['UN', 'L', 'KG', 'PC', 'JOGO', 'M'] as const
export type Unidade = (typeof UNIDADES)[number]

export const TIPOS_MOVIMENTACAO = ['ENTRADA', 'SAIDA', 'AJUSTE'] as const
export type TipoMovimentacao = (typeof TIPOS_MOVIMENTACAO)[number]

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
