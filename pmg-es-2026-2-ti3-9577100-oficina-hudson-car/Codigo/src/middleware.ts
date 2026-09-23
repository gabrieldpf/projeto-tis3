// Middleware (runtime edge). Duas responsabilidades:
//  1. Exigir sessão para as áreas autenticadas e para a API de dados.
//  2. Barrar rotas financeiras/administrativas para papéis sem permissão
//     (regra de ouro nº 2) — a guarda nasce aqui, antes de qualquer handler.
//
// Só usa `verificarToken` (jose, edge-safe). A validação fina por papel também
// é reforçada nos route handlers via rbac.ts (defesa em profundidade).

import { NextResponse, type NextRequest } from 'next/server'
import { SESSAO_COOKIE, verificarToken } from './lib/session'
import { PAPEIS_ADMIN } from './lib/constants'

// Rotas de UI públicas (sem sessão).
const UI_PUBLICAS = ['/login']

// Prefixos que exigem papel ADMIN (financeiro/relatórios/gestão de usuários).
const PREFIXOS_ADMIN = ['/relatorios', '/api/relatorios', '/api/financeiro', '/api/usuarios']

// APIs públicas (login/logout não exigem sessão).
const API_PUBLICAS = ['/api/auth/login', '/api/auth/logout']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  const ehApi = pathname.startsWith('/api')
  const token = req.cookies.get(SESSAO_COOKIE)?.value
  const sessao = token ? await verificarToken(token) : null

  // Rotas públicas passam direto.
  if (API_PUBLICAS.includes(pathname) || UI_PUBLICAS.includes(pathname)) {
    // Se já logado e indo pro /login, manda pra home.
    if (pathname === '/login' && sessao) {
      return NextResponse.redirect(new URL('/', req.url))
    }
    return NextResponse.next()
  }

  // Sem sessão → API responde 401 JSON; UI redireciona pro login.
  if (!sessao) {
    if (ehApi) {
      return NextResponse.json(
        { code: 'NAO_AUTENTICADO', message: 'É necessário estar autenticado.' },
        { status: 401 },
      )
    }
    const url = new URL('/login', req.url)
    return NextResponse.redirect(url)
  }

  // Área ADMIN (financeiro/relatórios/usuários).
  const exigeAdmin = PREFIXOS_ADMIN.some((p) => pathname.startsWith(p))
  if (exigeAdmin && !PAPEIS_ADMIN.includes(sessao.papel)) {
    if (ehApi) {
      return NextResponse.json(
        { code: 'SEM_PERMISSAO', message: 'Acesso restrito ao administrador.' },
        { status: 403 },
      )
    }
    return NextResponse.redirect(new URL('/', req.url))
  }

  return NextResponse.next()
}

export const config = {
  // Protege tudo, menos assets estáticos do Next e favicon.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
