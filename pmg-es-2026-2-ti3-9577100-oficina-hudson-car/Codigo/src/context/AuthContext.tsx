'use client'
// Contexto de autenticação real via API.
// Regra de ouro nº 2: dados financeiros são visíveis SOMENTE ao admin.
// O papel vem da sessão JWT no servidor — não pode ser falsificado no cliente.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'

export interface UsuarioSessao {
  id: string
  nome: string
  cargo: string
  papel: 'ADMIN' | 'GESTOR' | 'OPERACIONAL'
}

interface AuthContextValue {
  usuario: UsuarioSessao | null
  ehAdmin: boolean
  carregando: boolean
  entrar: (email: string, senha: string) => Promise<void>
  sair: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [usuario, setUsuario] = useState<UsuarioSessao | null>(null)
  const [carregando, setCarregando] = useState(true)

  // Verifica sessão ao montar (cookie httpOnly — o browser envia automaticamente).
  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(async (res) => {
        if (res.ok) {
          const dados = (await res.json()) as UsuarioSessao
          setUsuario(dados)
        } else {
          setUsuario(null)
        }
      })
      .catch(() => setUsuario(null))
      .finally(() => setCarregando(false))
  }, [])

  const entrar = useCallback(
    async (email: string, senha: string): Promise<void> => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, senha }),
      })

      if (!res.ok) {
        const corpo = (await res.json().catch(() => ({}))) as { message?: string }
        throw new Error(corpo.message ?? 'E-mail ou senha inválidos.')
      }

      const dados = (await res.json()) as UsuarioSessao
      setUsuario(dados)
      router.push('/')
    },
    [router],
  )

  const sair = useCallback(async (): Promise<void> => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {
      // Ignora erro de rede; faz logout local de qualquer forma.
    })
    setUsuario(null)
    router.push('/login')
  }, [router])

  const value = useMemo<AuthContextValue>(
    () => ({
      usuario,
      ehAdmin: usuario?.papel === 'ADMIN',
      carregando,
      entrar,
      sair,
    }),
    [usuario, carregando, entrar, sair],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}
