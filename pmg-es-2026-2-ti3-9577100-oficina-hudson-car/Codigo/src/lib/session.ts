// Assinatura/verificação do token de sessão (JWT). Módulo "edge-safe":
// usa apenas `jose` (sem dependências de Node), então pode ser importado pelo
// middleware, que roda no runtime edge. Nada de bcrypt/Prisma aqui.

import { SignJWT, jwtVerify } from 'jose'
import type { Papel } from './constants'

export const SESSAO_COOKIE = 'hc_sessao'
const DURACAO_SEGUNDOS = 60 * 60 * 8 // 8 horas

export interface SessaoPayload {
  sub: string // id do usuário
  nome: string
  cargo: string
  papel: Papel
}

function segredo(): Uint8Array {
  const s = process.env.AUTH_SECRET
  if (!s) throw new Error('AUTH_SECRET não configurado (.env).')
  return new TextEncoder().encode(s)
}

export async function assinarToken(payload: SessaoPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${DURACAO_SEGUNDOS}s`)
    .sign(segredo())
}

export async function verificarToken(token: string): Promise<SessaoPayload | null> {
  try {
    const { payload } = await jwtVerify(token, segredo())
    if (
      typeof payload.sub === 'string' &&
      typeof payload.nome === 'string' &&
      typeof payload.cargo === 'string' &&
      typeof payload.papel === 'string'
    ) {
      return {
        sub: payload.sub,
        nome: payload.nome,
        cargo: payload.cargo,
        papel: payload.papel as Papel,
      }
    }
    return null
  } catch {
    return null
  }
}

export const SESSAO_MAX_AGE = DURACAO_SEGUNDOS
