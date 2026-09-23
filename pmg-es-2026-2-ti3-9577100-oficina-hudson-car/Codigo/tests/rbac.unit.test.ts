// Testes de RBAC (regra de ouro nº 2: financeiro só ADMIN).
// Mockamos a leitura de sessão para não depender de cookies/Next.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SessaoPayload } from '@/lib/session'

const lerSessaoMock = vi.fn<() => Promise<SessaoPayload | null>>()
vi.mock('@/lib/auth', () => ({
  lerSessao: () => lerSessaoMock(),
}))

import { exigirFinanceiro, exigirAdmin, exigirAutenticacao, podeVerFinanceiro } from '@/lib/rbac'
import { ApiError } from '@/lib/http'

function sessao(papel: SessaoPayload['papel']): SessaoPayload {
  return { sub: 'u1', nome: 'Fulano', cargo: 'x', papel }
}

beforeEach(() => lerSessaoMock.mockReset())

describe('podeVerFinanceiro', () => {
  it('só ADMIN vê financeiro', () => {
    expect(podeVerFinanceiro('ADMIN')).toBe(true)
    expect(podeVerFinanceiro('GESTOR')).toBe(false)
    expect(podeVerFinanceiro('OPERACIONAL')).toBe(false)
  })
})

describe('exigirAutenticacao', () => {
  it('lança 401 sem sessão', async () => {
    lerSessaoMock.mockResolvedValue(null)
    await expect(exigirAutenticacao()).rejects.toMatchObject({ code: 'NAO_AUTENTICADO' })
  })
})

describe('exigirFinanceiro / exigirAdmin', () => {
  it('ADMIN passa no financeiro', async () => {
    lerSessaoMock.mockResolvedValue(sessao('ADMIN'))
    await expect(exigirFinanceiro()).resolves.toMatchObject({ papel: 'ADMIN' })
  })

  it('GESTOR é barrado no financeiro (403)', async () => {
    lerSessaoMock.mockResolvedValue(sessao('GESTOR'))
    await expect(exigirFinanceiro()).rejects.toBeInstanceOf(ApiError)
    await expect(exigirFinanceiro()).rejects.toMatchObject({ code: 'SEM_PERMISSAO' })
  })

  it('OPERACIONAL é barrado na área admin (403)', async () => {
    lerSessaoMock.mockResolvedValue(sessao('OPERACIONAL'))
    await expect(exigirAdmin()).rejects.toMatchObject({ code: 'SEM_PERMISSAO' })
  })
})
