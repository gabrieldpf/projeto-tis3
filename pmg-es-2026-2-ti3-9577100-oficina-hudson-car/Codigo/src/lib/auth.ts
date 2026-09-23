// Autenticação (runtime Node — usado nos route handlers, não no middleware).
// Senhas com hash bcrypt; sessão em cookie httpOnly assinado (ver session.ts).

import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import {
  SESSAO_COOKIE,
  SESSAO_MAX_AGE,
  assinarToken,
  verificarToken,
  type SessaoPayload,
} from './session'

const ROUNDS = 10

export function hashSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, ROUNDS)
}

export function verificarSenha(senha: string, hash: string): Promise<boolean> {
  return bcrypt.compare(senha, hash)
}

/// Cria a sessão e grava o cookie httpOnly. Chamar dentro de um route handler.
export async function criarSessao(payload: SessaoPayload): Promise<void> {
  const token = await assinarToken(payload)
  cookies().set(SESSAO_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSAO_MAX_AGE,
  })
}

/// Lê a sessão atual do cookie. Retorna null se não autenticado/expirado.
export async function lerSessao(): Promise<SessaoPayload | null> {
  const token = cookies().get(SESSAO_COOKIE)?.value
  if (!token) return null
  return verificarToken(token)
}

export function destruirSessao(): void {
  cookies().delete(SESSAO_COOKIE)
}
