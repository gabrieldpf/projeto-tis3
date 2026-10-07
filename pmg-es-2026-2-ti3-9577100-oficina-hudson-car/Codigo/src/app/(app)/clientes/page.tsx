'use client'
// Cadastro de clientes (dados que serão migrados do sistema legado).
// ~95% pessoa física; captação por indicação.
// Integrado à API real.

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  listarClientes,
  criarCliente,
  atualizarCliente,
  type ClienteApi,
  ApiClientError,
} from '@/lib/api'
import { IconeBusca, IconeAdicionar, IconeEditar } from '@/components/icons'

function formatarData(iso: string | null): string {
  if (!iso) return 'Não informado'
  return new Date(iso).toLocaleDateString('pt-BR')
}

// -----------------------------------------------------------------------
// Modal: Criar / Editar cliente
// -----------------------------------------------------------------------

interface ModalClienteProps {
  cliente?: ClienteApi // undefined = criação
  onFechar: () => void
  onSalvo: (c: ClienteApi) => void
}

function ModalCliente({ cliente, onFechar, onSalvo }: ModalClienteProps) {
  const edicao = !!cliente

  const [nome, setNome] = useState(cliente?.nome ?? '')
  const [telefone, setTelefone] = useState(cliente?.telefone ?? '')
  const [documento, setDocumento] = useState(cliente?.documento ?? '')
  const [email, setEmail] = useState(cliente?.email ?? '')
  const [observacao, setObservacao] = useState(cliente?.observacao ?? '')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const primeiroRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    primeiroRef.current?.focus()
  }, [])

  async function handleSalvar() {
    if (!nome.trim()) {
      setErro('Nome do cliente é obrigatório.')
      return
    }
    setSalvando(true)
    setErro(null)

    try {
      const dados = {
        nome: nome.trim(),
        telefone: telefone.trim() || undefined,
        documento: documento.trim() || undefined,
        email: email.trim() || undefined,
        observacao: observacao.trim() || undefined,
      }

      let salvo: ClienteApi
      if (edicao && cliente) {
        salvo = await atualizarCliente(cliente.id, {
          ...dados,
          version: cliente.version,
        })
      } else {
        salvo = await criarCliente(dados)
      }

      onSalvo(salvo)
    } catch (e) {
      if (e instanceof ApiClientError && e.code === 'CONFLITO') {
        setErro('Este cliente foi alterado por outra pessoa. Recarregue e tente novamente.')
      } else {
        const msg = e instanceof ApiClientError ? e.message : 'Não foi possível salvar.'
        setErro(msg)
      }
    } finally {
      setSalvando(false)
    }
  }

  const titulo = edicao ? 'Editar cliente' : 'Novo cliente'
  const idTitulo = edicao ? 'titulo-editar-cliente' : 'titulo-novo-cliente'

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby={idTitulo}>
      <div className="modal-box">
        <div className="modal-head">
          <h2 id={idTitulo}>{titulo}</h2>
          <button className="btn-fechar" onClick={onFechar} aria-label="Fechar">×</button>
        </div>
        <div className="modal-corpo">
          {erro && <div className="aviso vermelho" role="alert">{erro}</div>}
          <div className="form-grid">
            <div className="campo-form" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="cli-nome">Nome *</label>
              <input
                ref={primeiroRef}
                id="cli-nome"
                className="input"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                disabled={salvando}
              />
            </div>
            <div className="campo-form">
              <label htmlFor="cli-tel">Telefone</label>
              <input
                id="cli-tel"
                className="input"
                placeholder="(16) 9xxxx-xxxx"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                disabled={salvando}
              />
            </div>
            <div className="campo-form">
              <label htmlFor="cli-doc">CPF / CNPJ</label>
              <input
                id="cli-doc"
                className="input"
                value={documento}
                onChange={(e) => setDocumento(e.target.value)}
                disabled={salvando}
              />
            </div>
            <div className="campo-form" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="cli-email">E-mail</label>
              <input
                id="cli-email"
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={salvando}
              />
            </div>
            <div className="campo-form" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="cli-obs">Observação</label>
              <textarea
                id="cli-obs"
                className="input"
                rows={2}
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                disabled={salvando}
                style={{ resize: 'vertical' }}
              />
            </div>
          </div>
        </div>
        <div className="modal-rodape">
          <button className="btn secundario" onClick={onFechar} disabled={salvando}>Cancelar</button>
          <button className="btn" onClick={handleSalvar} disabled={salvando}>
            {salvando ? 'Salvando…' : edicao ? 'Salvar alterações' : 'Criar cliente'}
          </button>
        </div>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------
// Página principal
// -----------------------------------------------------------------------

export default function PaginaClientes() {
  const [busca, setBusca] = useState('')
  const [clientes, setClientes] = useState<ClienteApi[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<ClienteApi | undefined>(undefined)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const buscarClientes = useCallback(async (q: string) => {
    setCarregando(true)
    setErro(null)
    try {
      const lista = await listarClientes(q.trim() || undefined)
      setClientes(lista)
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : 'Erro ao carregar clientes.'
      setErro(msg)
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      void buscarClientes(busca)
    }, 400)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [busca, buscarClientes])

  function handleSalvo(c: ClienteApi) {
    setClientes((prev) => {
      const existe = prev.findIndex((x) => x.id === c.id)
      if (existe >= 0) {
        const nova = [...prev]
        nova[existe] = c
        return nova
      }
      return [c, ...prev]
    })
    setModalAberto(false)
    setEditando(undefined)
  }

  function abrirEdicao(c: ClienteApi) {
    setEditando(c)
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
    setEditando(undefined)
  }

  return (
    <>
      {modalAberto && (
        <ModalCliente
          cliente={editando}
          onFechar={fecharModal}
          onSalvo={handleSalvo}
        />
      )}

      <div className="acoes-topo">
        <div className="campo-busca">
          <IconeBusca className="lupa" sx={{ fontSize: 20 }} />
          <input
            placeholder="Buscar por nome, telefone ou CPF…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            aria-label="Buscar cliente"
          />
        </div>
        <button className="btn" onClick={() => { setEditando(undefined); setModalAberto(true) }}>
          <IconeAdicionar sx={{ fontSize: 18 }} /> Novo cliente
        </button>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h2>Clientes</h2>
            <p>Dados serão migrados do sistema atual (~1 ano e 3 meses)</p>
          </div>
        </div>

        {carregando ? (
          <div className="carregando">Carregando clientes…</div>
        ) : erro ? (
          <div className="aviso vermelho" style={{ margin: 16 }}>{erro}</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Telefone</th>
                <th>CPF / CNPJ</th>
                <th className="direita">Veículos</th>
                <th>Cliente desde</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.id}>
                  <td className="forte">{c.nome}</td>
                  <td className="mono">{c.telefone ?? <span className="txt-suave">Sem telefone</span>}</td>
                  <td className="mono">{c.documento ?? <span className="txt-suave">Não informado</span>}</td>
                  <td className="direita">{c._count?.veiculos ?? 0}</td>
                  <td>{formatarData(c.desde)}</td>
                  <td>
                    <button
                      className="btn secundario"
                      style={{ padding: '6px 10px', fontSize: 13 }}
                      onClick={() => abrirEdicao(c)}
                      aria-label={`Editar cliente ${c.nome}`}
                    >
                      <IconeEditar sx={{ fontSize: 15 }} /> Editar
                    </button>
                  </td>
                </tr>
              ))}
              {clientes.length === 0 && (
                <tr>
                  <td colSpan={6} className="vazio">
                    Nenhum cliente encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
