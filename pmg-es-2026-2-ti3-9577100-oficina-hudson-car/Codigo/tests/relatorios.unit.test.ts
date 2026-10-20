// RBAC + relatórios: exigirFinanceiro barra GESTOR/OPERACIONAL, deixa ADMIN passar.
// Segue o mesmo padrão de rbac.unit.test.ts (mock da sessão, sem banco).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SessaoPayload } from '@/lib/session'

const lerSessaoMock = vi.fn<() => Promise<SessaoPayload | null>>()
vi.mock('@/lib/auth', () => ({
  lerSessao: () => lerSessaoMock(),
}))

import { exigirFinanceiro } from '@/lib/rbac'
import { ApiError } from '@/lib/http'

function sessao(papel: SessaoPayload['papel']): SessaoPayload {
  return { sub: 'u1', nome: 'Fulano', cargo: 'x', papel }
}

beforeEach(() => lerSessaoMock.mockReset())

describe('exigirFinanceiro — regra de ouro nº 2', () => {
  it('ADMIN tem acesso ao financeiro', async () => {
    lerSessaoMock.mockResolvedValue(sessao('ADMIN'))
    await expect(exigirFinanceiro()).resolves.toMatchObject({ papel: 'ADMIN' })
  })

  it('GESTOR é barrado no financeiro (403 SEM_PERMISSAO)', async () => {
    lerSessaoMock.mockResolvedValue(sessao('GESTOR'))
    await expect(exigirFinanceiro()).rejects.toBeInstanceOf(ApiError)
    await expect(exigirFinanceiro()).rejects.toMatchObject({
      code: 'SEM_PERMISSAO',
      status: 403,
    })
  })

  it('OPERACIONAL é barrado no financeiro (403 SEM_PERMISSAO)', async () => {
    lerSessaoMock.mockResolvedValue(sessao('OPERACIONAL'))
    await expect(exigirFinanceiro()).rejects.toBeInstanceOf(ApiError)
    await expect(exigirFinanceiro()).rejects.toMatchObject({
      code: 'SEM_PERMISSAO',
      status: 403,
    })
  })

  it('sem sessão → NAO_AUTENTICADO (401)', async () => {
    lerSessaoMock.mockResolvedValue(null)
    await expect(exigirFinanceiro()).rejects.toMatchObject({ code: 'NAO_AUTENTICADO' })
  })
})
