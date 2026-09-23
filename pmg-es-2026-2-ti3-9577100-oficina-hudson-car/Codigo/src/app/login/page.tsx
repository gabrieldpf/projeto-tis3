'use client'
// Tela de login com e-mail e senha reais.
// Credenciais de demonstração: charlles@hudsoncar.local (admin),
// ronaldo@hudsoncar.local, vitor@hudsoncar.local — senha: oficina123

import { useState, type FormEvent } from 'react'
import { useAuth } from '@/context/AuthContext'

export default function PaginaLogin() {
  const { entrar, carregando } = useAuth()

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro(null)
    setEnviando(true)

    try {
      await entrar(email.trim(), senha)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Não foi possível entrar. Tente novamente.'
      setErro(msg)
    } finally {
      setEnviando(false)
    }
  }

  // Aguarda verificação inicial de sessão (evita flash da tela de login).
  if (carregando) {
    return (
      <div className="login-tela">
        <p style={{ color: '#fff' }}>Carregando…</p>
      </div>
    )
  }

  return (
    <div className="login-tela">
      <div className="login-box">
        <div className="marca-login">
          <div className="logo">HC</div>
          <h1>Hudson Car</h1>
          <p>Sistema de gestão da oficina</p>
        </div>

        {erro && (
          <div className="erro-login" role="alert">
            {erro}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="campo-form">
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              className="input"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              disabled={enviando}
            />
          </div>

          <div className="campo-form" style={{ marginTop: 12, marginBottom: 18 }}>
            <label htmlFor="senha">Senha</label>
            <input
              id="senha"
              type="password"
              className="input"
              placeholder="••••••••"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="current-password"
              required
              disabled={enviando}
            />
          </div>

          <button
            type="submit"
            className="btn btn-entrar"
            disabled={enviando || !email || !senha}
          >
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className="dica">
          Demonstração:{' '}
          <code>charlles@hudsoncar.local</code> (admin),{' '}
          <code>ronaldo@hudsoncar.local</code> ou{' '}
          <code>vitor@hudsoncar.local</code>
          <br />
          Senha: <code>oficina123</code>
        </p>
      </div>
    </div>
  )
}
