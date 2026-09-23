'use client'
// Fornecedores — lista, criação e edição.
// Integrado à API real.

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  listarFornecedores,
  criarFornecedor,
  atualizarFornecedor,
  type FornecedorApi,
  ApiClientError,
} from '@/lib/api'
import { IconeBusca, IconeAdicionar, IconeEditar } from '@/components/icons'

// -----------------------------------------------------------------------
// Modal: Criar / Editar fornecedor
// -----------------------------------------------------------------------

interface ModalFornecedorProps {
  fornecedor?: FornecedorApi // undefined = criação
  onFechar: () => void
  onSalvo: (f: FornecedorApi) => void
}

function ModalFornecedor({ fornecedor, onFechar, onSalvo }: ModalFornecedorProps) {
  const edicao = !!fornecedor

  const [nome, setNome] = useState(fornecedor?.nome ?? '')
  const [documento, setDocumento] = useState(fornecedor?.documento ?? '')
  const [telefone, setTelefone] = useState(fornecedor?.telefone ?? '')
  const [email, setEmail] = useState(fornecedor?.email ?? '')
  const [categoria, setCategoria] = useState(fornecedor?.categoria ?? '')
  const [observacao, setObservacao] = useState(fornecedor?.observacao ?? '')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const primeiroInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    primeiroInputRef.current?.focus()
  }, [])

  async function handleSalvar() {
    if (!nome.trim()) {
      setErro('Nome do fornecedor é obrigatório.')
      return
    }
    setSalvando(true)
    setErro(null)

    try {
      const dados = {
        nome: nome.trim(),
        documento: documento.trim() || undefined,
        telefone: telefone.trim() || undefined,
        email: email.trim() || undefined,
        categoria: categoria.trim() || undefined,
        observacao: observacao.trim() || undefined,
      }

      let salvo: FornecedorApi
      if (edicao && fornecedor) {
        salvo = await atualizarFornecedor(fornecedor.id, {
          ...dados,
          version: fornecedor.version,
        })
      } else {
        salvo = await criarFornecedor(dados)
      }

      onSalvo(salvo)
    } catch (e) {
      if (e instanceof ApiClientError && e.code === 'CONFLITO') {
        setErro('Registro desatualizado — recarregue a página e tente novamente.')
      } else {
        const msg = e instanceof ApiClientError ? e.message : 'Não foi possível salvar.'
        setErro(msg)
      }
    } finally {
      setSalvando(false)
    }
  }

  const titulo = edicao ? 'Editar fornecedor' : 'Novo fornecedor'

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="titulo-forn">
      <div className="modal-box">
        <div className="modal-head">
          <h2 id="titulo-forn">{titulo}</h2>
          <button className="btn-fechar" onClick={onFechar} aria-label="Fechar">×</button>
        </div>
        <div className="modal-corpo">
          {erro && <div className="aviso vermelho" role="alert">{erro}</div>}
          <div className="form-grid">
            <div className="campo-form" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="forn-nome">Nome *</label>
              <input
                ref={primeiroInputRef}
                id="forn-nome"
                className="input"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                disabled={salvando}
              />
            </div>
            <div className="campo-form">
              <label htmlFor="forn-categoria">Categoria</label>
              <input
                id="forn-categoria"
                className="input"
                placeholder="Ex: Peças gerais, Lubrificantes…"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                disabled={salvando}
              />
            </div>
            <div className="campo-form">
              <label htmlFor="forn-doc">CNPJ / CPF</label>
              <input
                id="forn-doc"
                className="input"
                value={documento}
                onChange={(e) => setDocumento(e.target.value)}
                disabled={salvando}
              />
            </div>
            <div className="campo-form">
              <label htmlFor="forn-tel">Telefone</label>
              <input
                id="forn-tel"
                className="input"
                placeholder="(16) 9xxxx-xxxx"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                disabled={salvando}
              />
            </div>
            <div className="campo-form">
              <label htmlFor="forn-email">E-mail</label>
              <input
                id="forn-email"
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={salvando}
              />
            </div>
            <div className="campo-form" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="forn-obs">Observação</label>
              <textarea
                id="forn-obs"
                className="input"
                rows={3}
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
            {salvando ? 'Salvando…' : edicao ? 'Salvar alterações' : 'Criar fornecedor'}
          </button>
        </div>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------
// Página principal
// -----------------------------------------------------------------------

export default function PaginaFornecedores() {
  const [busca, setBusca] = useState('')
  const [fornecedores, setFornecedores] = useState<FornecedorApi[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<FornecedorApi | undefined>(undefined)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const buscarFornecedores = useCallback(async (q: string) => {
    setCarregando(true)
    setErro(null)
    try {
      const lista = await listarFornecedores(q.trim() || undefined)
      setFornecedores(lista)
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : 'Erro ao carregar fornecedores.'
      setErro(msg)
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      void buscarFornecedores(busca)
    }, 400)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [busca, buscarFornecedores])

  function handleSalvo(f: FornecedorApi) {
    setFornecedores((prev) => {
      const existe = prev.findIndex((x) => x.id === f.id)
      if (existe >= 0) {
        const nova = [...prev]
        nova[existe] = f
        return nova
      }
      return [f, ...prev]
    })
    setModalAberto(false)
    setEditando(undefined)
  }

  function abrirEdicao(f: FornecedorApi) {
    setEditando(f)
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
    setEditando(undefined)
  }

  function formatarData(iso: string): string {
    return new Date(iso).toLocaleDateString('pt-BR')
  }

  return (
    <>
      {modalAberto && (
        <ModalFornecedor
          fornecedor={editando}
          onFechar={fecharModal}
          onSalvo={handleSalvo}
        />
      )}

      <div className="acoes-topo">
        <div className="campo-busca">
          <IconeBusca className="lupa" sx={{ fontSize: 20 }} />
          <input
            placeholder="Buscar fornecedor por nome…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            aria-label="Buscar fornecedor"
          />
        </div>
        <button className="btn" onClick={() => { setEditando(undefined); setModalAberto(true) }}>
          <IconeAdicionar sx={{ fontSize: 18 }} /> Novo fornecedor
        </button>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h2>Fornecedores</h2>
            <p>~20–25 fornecedores; ~80% das peças compradas sob demanda</p>
          </div>
        </div>

        {carregando ? (
          <div className="carregando">Carregando fornecedores…</div>
        ) : erro ? (
          <div className="aviso vermelho" style={{ margin: 16 }}>{erro}</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Fornecedor</th>
                <th>Categoria</th>
                <th>Telefone</th>
                <th>E-mail</th>
                <th>Cadastrado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {fornecedores.map((f) => (
                <tr key={f.id}>
                  <td className="forte">
                    {f.nome}
                    {f.documento && (
                      <>
                        <br />
                        <span className="mono txt-suave">{f.documento}</span>
                      </>
                    )}
                  </td>
                  <td>{f.categoria ?? <span className="txt-suave">—</span>}</td>
                  <td className="mono">{f.telefone ?? <span className="txt-suave">—</span>}</td>
                  <td className="txt-suave">{f.email ?? '—'}</td>
                  <td className="txt-suave">{formatarData(f.createdAt)}</td>
                  <td>
                    <button
                      className="btn secundario"
                      style={{ padding: '6px 10px', fontSize: 13 }}
                      onClick={() => abrirEdicao(f)}
                      aria-label={`Editar fornecedor ${f.nome}`}
                    >
                      <IconeEditar sx={{ fontSize: 15 }} /> Editar
                    </button>
                  </td>
                </tr>
              ))}
              {fornecedores.length === 0 && (
                <tr>
                  <td colSpan={6} className="vazio">
                    Nenhum fornecedor encontrado.
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
