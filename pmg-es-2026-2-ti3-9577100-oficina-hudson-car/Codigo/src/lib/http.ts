// Camada HTTP: resposta e erro padronizados da API.
// Todo erro sai no formato { code, message } (convenção do §A5 do plano).

import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

export type CodigoErro =
  | 'NAO_AUTENTICADO'
  | 'SEM_PERMISSAO'
  | 'NAO_ENCONTRADO'
  | 'DADOS_INVALIDOS'
  | 'CONFLITO'
  | 'ERRO_INTERNO'

const STATUS_PADRAO: Record<CodigoErro, number> = {
  NAO_AUTENTICADO: 401,
  SEM_PERMISSAO: 403,
  NAO_ENCONTRADO: 404,
  DADOS_INVALIDOS: 422,
  CONFLITO: 409,
  ERRO_INTERNO: 500,
}

/// Erro de domínio/aplicação. Lançar em qualquer lugar do handler; o wrapper
/// `rotaProtegida`/`comErros` converte para a resposta HTTP padrão.
export class ApiError extends Error {
  code: CodigoErro
  status: number
  detalhes?: unknown

  constructor(code: CodigoErro, message: string, detalhes?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = STATUS_PADRAO[code]
    this.detalhes = detalhes
  }
}

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status })
}

export function erro(code: CodigoErro, message: string, detalhes?: unknown): NextResponse {
  return NextResponse.json({ code, message, detalhes }, { status: STATUS_PADRAO[code] })
}

/// Envolve um handler traduzindo exceções conhecidas em respostas padrão.
export function comErros(
  handler: () => Promise<NextResponse>,
): Promise<NextResponse> {
  return handler().catch((e: unknown) => {
    if (e instanceof ApiError) {
      return NextResponse.json(
        { code: e.code, message: e.message, detalhes: e.detalhes },
        { status: e.status },
      )
    }
    if (e instanceof ZodError) {
      return NextResponse.json(
        {
          code: 'DADOS_INVALIDOS' satisfies CodigoErro,
          message: 'Dados inválidos.',
          detalhes: e.flatten().fieldErrors,
        },
        { status: 422 },
      )
    }
    // Erro de unicidade do Prisma (ex.: código/email duplicado).
    if (typeof e === 'object' && e !== null && 'code' in e && (e as { code: unknown }).code === 'P2002') {
      return NextResponse.json(
        { code: 'CONFLITO' satisfies CodigoErro, message: 'Registro já existe (valor único duplicado).' },
        { status: 409 },
      )
    }
    console.error('[API] erro não tratado:', e)
    return NextResponse.json(
      { code: 'ERRO_INTERNO' satisfies CodigoErro, message: 'Erro interno inesperado.' },
      { status: 500 },
    )
  })
}
