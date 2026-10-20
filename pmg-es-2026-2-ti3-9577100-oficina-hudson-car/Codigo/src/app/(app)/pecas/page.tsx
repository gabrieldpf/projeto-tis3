'use client'
// Peças & Fornecedores — maior dor do cliente (prioridade nº 2).
// Destaques: busca por CHASSI (para não errar a peça) e "preço do dia"
// (atualizado manualmente; nunca fixo — regra de ouro nº 3).
// Integrado à API real.

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  listarPecas,
  criarPeca,
  atualizarPrecoDia,
  atualizarPeca,
  type PecaApi,
  ApiClientError,
} from '@/lib/api'
import { moeda } from '@/utils/format'
import { UNIDADES } from '@/lib/constants'
import {
  IconeBusca,
  IconeAdicionar,
  IconeVeiculo,
  IconeDica,
  IconeEditar,
} from '@/components/icons'

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

function formatarData(iso: string | null): string {
  if (!iso) return 'Nunca'
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR')
}

// -----------------------------------------------------------------------
// Modal: Atualizar preço do dia
// -----------------------------------------------------------------------

interface ModalPrecoDiaProps {
  peca: PecaApi
  onFechar: () => void
  onSalvo: (pecaAtualizada: PecaApi) => void
}

function ModalPrecoDia({ peca, onFechar, onSalvo }: ModalPrecoDiaProps) {
  const [preco, setPreco] = useState(peca.precoDia.toString())
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  async function handleSalvar() {
    const valor = parseFloat(preco.replace(',', '.'))
    if (isNaN(valor) || valor < 0) {
      setErro('Informe um valor válido (maior ou igual a zero).')
      return
    }
    setSalvando(true)
    setErro(null)
    try {
      const atualizada = await atualizarPrecoDia(peca.id, valor)
      onSalvo(atualizada)
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : 'Não foi possível salvar.'
      setErro(msg)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="titulo-preco-dia">
      <div className="modal-box">
        <div className="modal-head">
          <h2 id="titulo-preco-dia">Atualizar preço do dia</h2>
          <button className="btn-fechar" onClick={onFechar} aria-label="Fechar">×</button>
        </div>
        <div className="modal-corpo">
          <p className="txt-suave" style={{ marginBottom: 14 }}>
            <strong>{peca.nome}</strong>
            {peca.codigo ? ` · ${peca.codigo}` : ''}
          </p>
          {erro && (
            <div className="aviso vermelho" role="alert">{erro}</div>
          )}
          <div className="campo-form">
            <label htmlFor="preco-dia">Novo preço (R$)</label>
            <input
              ref={inputRef}
              id="preco-dia"
              type="number"
              min="0"
              step="0.01"
              className="input"
              value={preco}
              onChange={(e) => setPreco(e.target.value)}
              disabled={salvando}
            />
          </div>
          <p className="txt-suave" style={{ marginTop: 8 }}>
            Preço atual: <strong>{moeda(peca.precoDia)}</strong>
            {peca.precoDiaAtualizadoEm && ` · atualizado em ${formatarData(peca.precoDiaAtualizadoEm)}`}
          </p>
        </div>
        <div className="modal-rodape">
          <button className="btn secundario" onClick={onFechar} disabled={salvando}>
            Cancelar
          </button>
          <button className="btn" onClick={handleSalvar} disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar preço'}
          </button>
        </div>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------
// Modal: Nova peça
// -----------------------------------------------------------------------

interface ModalNovaPecaProps {
  onFechar: () => void
  onCriada: (peca: PecaApi) => void
}

function ModalNovaPeca({ onFechar, onCriada }: ModalNovaPecaProps) {
  const [nome, setNome] = useState('')
  const [codigo, setCodigo] = useState('')
  const [categoria, setCategoria] = useState('')
  const [subcategoria, setSubcategoria] = useState('')
  const [unidade, setUnidade] = useState<string>('UN')
  const [fornecedorId, setFornecedorId] = useState('')
  const [precoDia, setPrecoDia] = useState('0')
  const [estoqueMinimo, setEstoqueMinimo] = useState('0')
  const [quantidadeInicial, setQuantidadeInicial] = useState('0')
  // Chassi: lista editável de strings
  const [chassisTexto, setChassisTexto] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function handleSalvar() {
    if (!nome.trim()) { setErro('Nome da peça é obrigatório.'); return }
    if (!categoria.trim()) { setErro('Categoria é obrigatória.'); return }

    const chassisList = chassisTexto
      .split(/[\n,;]/)
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s.length > 0)
      .map((chassi) => ({ chassi }))

    setSalvando(true)
    setErro(null)
    try {
      const criada = await criarPeca({
        nome: nome.trim(),
        codigo: codigo.trim() || undefined,
        categoria: categoria.trim(),
        subcategoria: subcategoria.trim() || undefined,
        unidade,
        fornecedorId: fornecedorId.trim() || undefined,
        precoDia: parseFloat(precoDia.replace(',', '.')) || 0,
        estoqueMinimo: parseInt(estoqueMinimo, 10) || 0,
        quantidadeInicial: parseInt(quantidadeInicial, 10) || 0,
        chassisCompativeis: chassisList.length > 0 ? chassisList : undefined,
      })
      onCriada(criada)
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : 'Não foi possível criar a peça.'
      setErro(msg)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="titulo-nova-peca">
      <div className="modal-box" style={{ maxWidth: 580 }}>
        <div className="modal-head">
          <h2 id="titulo-nova-peca">Nova peça</h2>
          <button className="btn-fechar" onClick={onFechar} aria-label="Fechar">×</button>
        </div>
        <div className="modal-corpo">
          {erro && <div className="aviso vermelho" role="alert">{erro}</div>}
          <div className="form-grid">
            <div className="campo-form" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="np-nome">Nome *</label>
              <input id="np-nome" className="input" value={nome} onChange={(e) => setNome(e.target.value)} disabled={salvando} />
            </div>
            <div className="campo-form">
              <label htmlFor="np-codigo">Código</label>
              <input id="np-codigo" className="input" value={codigo} onChange={(e) => setCodigo(e.target.value)} disabled={salvando} />
            </div>
            <div className="campo-form">
              <label htmlFor="np-unidade">Unidade</label>
              <select id="np-unidade" className="input" value={unidade} onChange={(e) => setUnidade(e.target.value)} disabled={salvando}>
                {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="campo-form">
              <label htmlFor="np-categoria">Categoria *</label>
              <input id="np-categoria" className="input" value={categoria} onChange={(e) => setCategoria(e.target.value)} disabled={salvando} />
            </div>
            <div className="campo-form">
              <label htmlFor="np-subcategoria">Subcategoria</label>
              <input id="np-subcategoria" className="input" value={subcategoria} onChange={(e) => setSubcategoria(e.target.value)} disabled={salvando} />
            </div>
            <div className="campo-form">
              <label htmlFor="np-preco">Preço do dia (R$)</label>
              <input id="np-preco" type="number" min="0" step="0.01" className="input" value={precoDia} onChange={(e) => setPrecoDia(e.target.value)} disabled={salvando} />
            </div>
            <div className="campo-form">
              <label htmlFor="np-fornecedor">ID do fornecedor</label>
              <input id="np-fornecedor" className="input" placeholder="Opcional" value={fornecedorId} onChange={(e) => setFornecedorId(e.target.value)} disabled={salvando} />
            </div>
            <div className="campo-form">
              <label htmlFor="np-minimo">Estoque mínimo</label>
              <input id="np-minimo" type="number" min="0" className="input" value={estoqueMinimo} onChange={(e) => setEstoqueMinimo(e.target.value)} disabled={salvando} />
            </div>
            <div className="campo-form">
              <label htmlFor="np-inicial">Quantidade inicial</label>
              <input id="np-inicial" type="number" min="0" className="input" value={quantidadeInicial} onChange={(e) => setQuantidadeInicial(e.target.value)} disabled={salvando} />
            </div>
            <div className="campo-form" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="np-chassi">Chassi(s) compatíveis (um por linha, vírgula ou ponto-e-vírgula)</label>
              <textarea
                id="np-chassi"
                className="input"
                rows={3}
                value={chassisTexto}
                onChange={(e) => setChassisTexto(e.target.value)}
                disabled={salvando}
                placeholder="Ex: 9BWZZZ377VT004251"
                style={{ resize: 'vertical' }}
              />
            </div>
          </div>
        </div>
        <div className="modal-rodape">
          <button className="btn secundario" onClick={onFechar} disabled={salvando}>Cancelar</button>
          <button className="btn" onClick={handleSalvar} disabled={salvando}>
            {salvando ? 'Salvando…' : 'Criar peça'}
          </button>
        </div>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------
// Modal: Editar peça (dados cadastrais — preço do dia tem modal próprio)
// -----------------------------------------------------------------------

interface ModalEditarPecaProps {
  peca: PecaApi
  onFechar: () => void
  onSalvo: (peca: PecaApi) => void
}

function ModalEditarPeca({ peca, onFechar, onSalvo }: ModalEditarPecaProps) {
  const [nome, setNome] = useState(peca.nome)
  const [codigo, setCodigo] = useState(peca.codigo ?? '')
  const [categoria, setCategoria] = useState(peca.categoria)
  const [subcategoria, setSubcategoria] = useState(peca.subcategoria ?? '')
  const [unidade, setUnidade] = useState<string>(peca.unidade)
  const [fornecedorId, setFornecedorId] = useState(peca.fornecedorId ?? '')
  const [estoqueMinimo, setEstoqueMinimo] = useState(peca.estoqueMinimo.toString())
  const [chassisTexto, setChassisTexto] = useState(
    (peca.chassisCompativeis ?? []).map((c) => c.chassi).join('\n'),
  )
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const primeiroRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    primeiroRef.current?.focus()
  }, [])

  async function handleSalvar() {
    if (!nome.trim()) { setErro('Nome da peça é obrigatório.'); return }
    if (!categoria.trim()) { setErro('Categoria é obrigatória.'); return }

    const chassisList = chassisTexto
      .split(/[\n,;]/)
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s.length > 0)
      .map((chassi) => ({ chassi }))

    setSalvando(true)
    setErro(null)
    try {
      const atualizada = await atualizarPeca(peca.id, {
        nome: nome.trim(),
        codigo: codigo.trim(),
        categoria: categoria.trim(),
        subcategoria: subcategoria.trim(),
        unidade,
        fornecedorId: fornecedorId.trim() || null,
        estoqueMinimo: parseInt(estoqueMinimo, 10) || 0,
        chassisCompativeis: chassisList,
        version: peca.version,
      })
      onSalvo(atualizada)
    } catch (e) {
      if (e instanceof ApiClientError && e.code === 'CONFLITO') {
        setErro('Esta peça foi alterada por outra pessoa. Recarregue e tente novamente.')
      } else {
        const msg = e instanceof ApiClientError ? e.message : 'Não foi possível salvar.'
        setErro(msg)
      }
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="titulo-editar-peca">
      <div className="modal-box" style={{ maxWidth: 580 }}>
        <div className="modal-head">
          <h2 id="titulo-editar-peca">Editar peça</h2>
          <button className="btn-fechar" onClick={onFechar} aria-label="Fechar">×</button>
        </div>
        <div className="modal-corpo">
          {erro && <div className="aviso vermelho" role="alert">{erro}</div>}
          <div className="form-grid">
            <div className="campo-form" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="ep-nome">Nome *</label>
              <input ref={primeiroRef} id="ep-nome" className="input" value={nome} onChange={(e) => setNome(e.target.value)} disabled={salvando} />
            </div>
            <div className="campo-form">
              <label htmlFor="ep-codigo">Código</label>
              <input id="ep-codigo" className="input" value={codigo} onChange={(e) => setCodigo(e.target.value)} disabled={salvando} />
            </div>
            <div className="campo-form">
              <label htmlFor="ep-unidade">Unidade</label>
              <select id="ep-unidade" className="input" value={unidade} onChange={(e) => setUnidade(e.target.value)} disabled={salvando}>
                {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="campo-form">
              <label htmlFor="ep-categoria">Categoria *</label>
              <input id="ep-categoria" className="input" value={categoria} onChange={(e) => setCategoria(e.target.value)} disabled={salvando} />
            </div>
            <div className="campo-form">
              <label htmlFor="ep-subcategoria">Subcategoria</label>
              <input id="ep-subcategoria" className="input" value={subcategoria} onChange={(e) => setSubcategoria(e.target.value)} disabled={salvando} />
            </div>
            <div className="campo-form">
              <label htmlFor="ep-fornecedor">ID do fornecedor</label>
              <input id="ep-fornecedor" className="input" placeholder="Opcional" value={fornecedorId} onChange={(e) => setFornecedorId(e.target.value)} disabled={salvando} />
            </div>
            <div className="campo-form">
              <label htmlFor="ep-minimo">Estoque mínimo</label>
              <input id="ep-minimo" type="number" min="0" className="input" value={estoqueMinimo} onChange={(e) => setEstoqueMinimo(e.target.value)} disabled={salvando} />
            </div>
            <div className="campo-form" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="ep-chassi">Chassi(s) compatíveis (um por linha, vírgula ou ponto-e-vírgula)</label>
              <textarea
                id="ep-chassi"
                className="input"
                rows={3}
                value={chassisTexto}
                onChange={(e) => setChassisTexto(e.target.value)}
                disabled={salvando}
                placeholder="Ex: 9BWZZZ377VT004251"
                style={{ resize: 'vertical' }}
              />
            </div>
          </div>
          <p className="txt-suave" style={{ marginTop: 10 }}>
            O preço do dia é alterado no botão <strong>&quot;Preço&quot;</strong> (endpoint próprio com auditoria).
          </p>
        </div>
        <div className="modal-rodape">
          <button className="btn secundario" onClick={onFechar} disabled={salvando}>Cancelar</button>
          <button className="btn" onClick={handleSalvar} disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar alterações'}
          </button>
        </div>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------
// Página principal
// -----------------------------------------------------------------------

export default function PaginaPecas() {
  const [busca, setBusca] = useState('')
  const [chassi, setChassi] = useState('')
  const [pecas, setPecas] = useState<PecaApi[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const [modalPreco, setModalPreco] = useState<PecaApi | null>(null)
  const [modalEditar, setModalEditar] = useState<PecaApi | null>(null)
  const [modalNova, setModalNova] = useState(false)

  // Debounce da busca para não disparar request a cada tecla
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const buscarPecas = useCallback(async (q: string, ch: string) => {
    setCarregando(true)
    setErro(null)
    try {
      const resultado = await listarPecas({
        q: q.trim() || undefined,
        chassi: ch.trim() || undefined,
      })
      setPecas(resultado)
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : 'Erro ao carregar peças.'
      setErro(msg)
    } finally {
      setCarregando(false)
    }
  }, [])

  // Carrega na montagem e quando os filtros mudam (debounce 400 ms)
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      void buscarPecas(busca, chassi)
    }, 400)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [busca, chassi, buscarPecas])

  function handlePrecoDiaSalvo(atualizada: PecaApi) {
    setPecas((prev) => prev.map((p) => (p.id === atualizada.id ? atualizada : p)))
    setModalPreco(null)
  }

  function handlePecaEditada(atualizada: PecaApi) {
    setPecas((prev) => prev.map((p) => (p.id === atualizada.id ? atualizada : p)))
    setModalEditar(null)
  }

  function handlePecaCriada(nova: PecaApi) {
    // Recarrega lista para garantir ordenação correta
    setModalNova(false)
    void buscarPecas(busca, chassi)
    // Inserção otimista imediata
    setPecas((prev) => [nova, ...prev])
  }

  return (
    <>
      {modalPreco && (
        <ModalPrecoDia
          peca={modalPreco}
          onFechar={() => setModalPreco(null)}
          onSalvo={handlePrecoDiaSalvo}
        />
      )}
      {modalEditar && (
        <ModalEditarPeca
          peca={modalEditar}
          onFechar={() => setModalEditar(null)}
          onSalvo={handlePecaEditada}
        />
      )}
      {modalNova && (
        <ModalNovaPeca
          onFechar={() => setModalNova(false)}
          onCriada={handlePecaCriada}
        />
      )}

      <div className="aviso azul">
        <IconeDica sx={{ fontSize: 18 }} />
        <span>
          <strong>Dica:</strong> busque pelo <strong>chassi</strong> do veículo
          para encontrar a peça exata e evitar erro de compatibilidade.
        </span>
      </div>

      <div className="acoes-topo">
        <div className="campo-busca">
          <IconeBusca className="lupa" sx={{ fontSize: 20 }} />
          <input
            placeholder="Buscar peça por nome ou código…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            aria-label="Buscar peça por nome ou código"
          />
        </div>
        <div className="campo-busca" style={{ maxWidth: 320 }}>
          <IconeVeiculo className="lupa" sx={{ fontSize: 20 }} />
          <input
            placeholder="Filtrar por chassi…"
            value={chassi}
            onChange={(e) => setChassi(e.target.value)}
            aria-label="Filtrar por chassi do veículo"
          />
        </div>
        <button className="btn" onClick={() => setModalNova(true)}>
          <IconeAdicionar sx={{ fontSize: 18 }} /> Nova peça
        </button>
      </div>

      {chassi.trim() && (
        <p className="txt-suave" style={{ marginBottom: 14 }}>
          Mostrando peças compatíveis com chassi <strong>{chassi.trim().toUpperCase()}</strong>.
          {' '}{!carregando && `(${pecas.length} resultado(s))`}
        </p>
      )}

      <div className="card">
        <div className="card-head">
          <div>
            <h2>Peças</h2>
            <p>Preço do dia · atualizado manualmente pelo administrador</p>
          </div>
        </div>

        {carregando ? (
          <div className="carregando">Carregando peças…</div>
        ) : erro ? (
          <div className="aviso vermelho" style={{ margin: 16 }}>{erro}</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Peça</th>
                <th>Categoria</th>
                <th>Fornecedor</th>
                <th className="direita">Preço do dia</th>
                <th>Atualizado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pecas.map((p) => (
                <tr key={p.id}>
                  <td className="mono">{p.codigo ?? 'Sem código'}</td>
                  <td className="forte">{p.nome}</td>
                  <td>
                    {p.categoria}
                    {p.subcategoria && (
                      <>
                        <br />
                        <span className="txt-suave">{p.subcategoria}</span>
                      </>
                    )}
                  </td>
                  <td>{p.fornecedor?.nome ?? <span className="txt-suave">Sem fornecedor</span>}</td>
                  <td className="direita forte">{moeda(p.precoDia)}</td>
                  <td className="txt-suave">{formatarData(p.precoDiaAtualizadoEm)}</td>
                  <td>
                    <div className="flex" style={{ gap: 6, justifyContent: 'flex-end' }}>
                      <button
                        className="btn secundario"
                        style={{ padding: '6px 10px', fontSize: 13 }}
                        onClick={() => setModalEditar(p)}
                        aria-label={`Editar dados da peça ${p.nome}`}
                      >
                        <IconeEditar sx={{ fontSize: 15 }} /> Editar
                      </button>
                      <button
                        className="btn secundario"
                        style={{ padding: '6px 10px', fontSize: 13 }}
                        onClick={() => setModalPreco(p)}
                        aria-label={`Atualizar preço do dia de ${p.nome}`}
                      >
                        <IconeEditar sx={{ fontSize: 15 }} /> Preço
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {pecas.length === 0 && (
                <tr>
                  <td colSpan={7} className="vazio">
                    Nenhuma peça encontrada com esses filtros.
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
