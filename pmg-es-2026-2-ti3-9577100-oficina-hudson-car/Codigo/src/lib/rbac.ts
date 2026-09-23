// Controle de acesso por papel (RBAC). Regra de ouro nº 2: financeiro só ADMIN.
// Estas funções são usadas dentro dos route handlers; lançam ApiError, que o
// wrapper `comErros` (http.ts) converte em 401/403 padronizado.

import { lerSessao } from './auth'
import { ApiError } from './http'
import { PAPEIS_ADMIN, PAPEIS_FINANCEIRO, type Papel } from './constants'
import type { SessaoPayload } from './session'

/// Exige usuário autenticado. Lança 401 se não houver sessão válida.
export async function exigirAutenticacao(): Promise<SessaoPayload> {
  const sessao = await lerSessao()
  if (!sessao) {
    throw new ApiError('NAO_AUTENTICADO', 'É necessário estar autenticado.')
  }
  return sessao
}

/// Exige que o usuário tenha um dos papéis informados. Lança 403 caso contrário.
export async function exigirPapel(...papeis: Papel[]): Promise<SessaoPayload> {
  const sessao = await exigirAutenticacao()
  if (!papeis.includes(sessao.papel)) {
    throw new ApiError('SEM_PERMISSAO', 'Você não tem permissão para esta ação.')
  }
  return sessao
}

/// Atalho: exige papel ADMIN (gestão de usuários, etc.).
export function exigirAdmin(): Promise<SessaoPayload> {
  return exigirPapel(...PAPEIS_ADMIN)
}

/// Atalho: exige acesso a dados financeiros (hoje = só ADMIN).
export function exigirFinanceiro(): Promise<SessaoPayload> {
  return exigirPapel(...PAPEIS_FINANCEIRO)
}

export function podeVerFinanceiro(papel: Papel): boolean {
  return PAPEIS_FINANCEIRO.includes(papel)
}
