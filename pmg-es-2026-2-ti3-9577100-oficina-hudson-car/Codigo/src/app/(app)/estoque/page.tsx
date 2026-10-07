'use client'
// Estoque — saldos, barras de nível, alertas de compra e movimentações.
// Integrado à API real.

import { useCallback, useEffect, useState } from 'react'
import {
  listarEstoque,
  listarAlertas,
  registrarMovimentacao,
  type ItemEstoqueApi,
  type AlertaCompraApi,
  ApiClientError,
} from '@/lib/api'
import {
  IconeAlerta,
  IconeComprar,
  IconeOk,
  IconeAdicionar,
} from '@/components/icons'

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

function nivel(qtd: number, minimo: number): { pct: number; cor: string } {
  const alvo = minimo * 2 || 1
  const pct = Math.min(100, Math.round((qtd / alvo) * 100))
  if (qtd <= minimo) return { pct: Math.max(pct, 6), cor: 'var(--vermelho)' }
  if (qtd <= minimo * 1.3) return { pct, cor: 'var(--amarelo)' }
  return { pct, cor: 'var(--verde)' }
}

type FiltroEstoque = 'todos' | 'alerta'
type TipoMovimentacao = 'ENTRADA' | 'SAIDA' | 'AJUSTE'

// -----------------------------------------------------------------------
// Modal: Registrar movimentação
// -----------------------------------------------------------------------

interface ModalMovimentacaoProps {
  item: ItemEstoqueApi
  onFechar: () => void
  onRegistrada: () => void
}

function ModalMovimentacao({ item, onFechar, onRegistrada }: ModalMovimentacaoProps) {
  const [tipo, setTipo] = useState<TipoMovimentacao>('ENTRADA')
  const [quantidade, setQuantidade] = useState('1')
  const [motivo, setMotivo] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const DESCRICAO_TIPO: Record<TipoMovimentacao, string> = {
    ENTRADA: 'Soma ao saldo atual',
    SAIDA: 'Subtrai do saldo atual (não pode ficar negativo)',
    AJUSTE: 'Define o saldo para o valor informado (correção de inventário)',
  }

  async function handleSalvar() {
    const qtd = parseFloat(quantidade.replace(',', '.'))
    if (isNaN(qtd) || qtd <= 0) {
      setErro('Informe uma quantidade maior que zero.')
      return
    }
    setSalvando(true)
    setErro(null)
    try {
      await registrarMovimentacao({
        pecaId: item.id,
        tipo,
        quantidade: qtd,
        motivo: motivo.trim() || undefined,
      })
      onRegistrada()
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : 'Não foi possível registrar a movimentação.'
      setErro(msg)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="titulo-mov">
      <div className="modal-box">
        <div className="modal-head">
          <h2 id="titulo-mov">Movimentação de estoque</h2>
          <button className="btn-fechar" onClick={onFechar} aria-label="Fechar">×</button>
        </div>
        <div className="modal-corpo">
          <p className="txt-suave" style={{ marginBottom: 14 }}>
            <strong>{item.nome}</strong>
            {item.codigo ? ` · ${item.codigo}` : ''}{' '}
            · Saldo atual: <strong>{item.quantidadeAtual} {item.unidade}</strong>
          </p>

          {erro && <div className="aviso vermelho" role="alert">{erro}</div>}

          <div className="form-grid col-1">
            <div className="campo-form">
              <label htmlFor="mov-tipo">Tipo de movimentação</label>
              <select
                id="mov-tipo"
                className="input"
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoMovimentacao)}
                disabled={salvando}
              >
                <option value="ENTRADA">Entrada (recebimento de mercadoria)</option>
                <option value="SAIDA">Saída (uso em serviço)</option>
                <option value="AJUSTE">Ajuste (correção de inventário)</option>
              </select>
              <span className="txt-suave" style={{ fontSize: 12, marginTop: 4 }}>
                {DESCRICAO_TIPO[tipo]}
              </span>
            </div>
            <div className="campo-form">
              <label htmlFor="mov-qtd">Quantidade</label>
              <input
                id="mov-qtd"
                type="number"
                min="0.01"
                step="0.01"
                className="input"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                disabled={salvando}
              />
            </div>
            <div className="campo-form">
              <label htmlFor="mov-motivo">Motivo / observação (opcional)</label>
              <input
                id="mov-motivo"
                className="input"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                disabled={salvando}
                placeholder="Ex: Compra NF 1234, uso na OS-092…"
              />
            </div>
          </div>
        </div>
        <div className="modal-rodape">
          <button className="btn secundario" onClick={onFechar} disabled={salvando}>Cancelar</button>
          <button className="btn" onClick={handleSalvar} disabled={salvando}>
            {salvando ? 'Registrando…' : 'Registrar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------
// Página principal
// -----------------------------------------------------------------------

export default function PaginaEstoque() {
  const [filtro, setFiltro] = useState<FiltroEstoque>('todos')
  const [itens, setItens] = useState<ItemEstoqueApi[]>([])
  const [alertas, setAlertas] = useState<AlertaCompraApi[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [modalItem, setModalItem] = useState<ItemEstoqueApi | null>(null)

  const carregarDados = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      const [listaItens, listaAlertas] = await Promise.all([
        listarEstoque(),
        listarAlertas(),
      ])
      setItens(listaItens)
      setAlertas(listaAlertas)
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : 'Erro ao carregar estoque.'
      setErro(msg)
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void carregarDados()
  }, [carregarDados])

  const itensFiltrados =
    filtro === 'alerta' ? itens.filter((i) => i.emAlerta) : itens

  const totalAlertas = alertas.length

  function handleMovimentacaoRegistrada() {
    setModalItem(null)
    void carregarDados()
  }

  return (
    <>
      {modalItem && (
        <ModalMovimentacao
          item={modalItem}
          onFechar={() => setModalItem(null)}
          onRegistrada={handleMovimentacaoRegistrada}
        />
      )}

      {/* Painel de alertas */}
      {totalAlertas > 0 && (
        <div className="aviso amarelo">
          <IconeAlerta sx={{ fontSize: 18 }} />
          <span>
            <strong>{totalAlertas} item(ns)</strong> no ou abaixo do estoque
            mínimo, precisam de reposição.
          </span>
        </div>
      )}

      {/* Filtros */}
      <div className="flex" style={{ marginBottom: 18 }}>
        <button
          className={`btn ${filtro === 'todos' ? '' : 'secundario'}`}
          onClick={() => setFiltro('todos')}
        >
          Todos os itens
        </button>
        <button
          className={`btn ${filtro === 'alerta' ? '' : 'secundario'}`}
          onClick={() => setFiltro('alerta')}
        >
          <IconeAlerta sx={{ fontSize: 16 }} /> Apenas alertas ({totalAlertas})
        </button>
      </div>

      {/* Lista de saldos */}
      <div className="card">
        <div className="card-head">
          <div>
            <h2>Saldos em estoque</h2>
            <p>Clique em &quot;Movimentar&quot; para dar entrada, baixa ou ajuste</p>
          </div>
        </div>

        {carregando ? (
          <div className="carregando">Carregando estoque…</div>
        ) : erro ? (
          <div className="aviso vermelho" style={{ margin: 16 }}>{erro}</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Peça</th>
                <th>Subcategoria</th>
                <th>Fornecedor</th>
                <th>Nível</th>
                <th className="direita">Em estoque</th>
                <th className="direita">Mínimo</th>
                <th>Situação</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {itensFiltrados.map((item) => {
                const n = nivel(item.quantidadeAtual, item.estoqueMinimo)
                return (
                  <tr key={item.id} className={item.emAlerta ? 'linha-alerta' : ''}>
                    <td className="forte">
                      {item.nome}
                      {item.codigo && (
                        <>
                          <br />
                          <span className="mono txt-suave">{item.codigo}</span>
                        </>
                      )}
                    </td>
                    <td className="txt-suave">{item.subcategoria ?? 'Sem subcategoria'}</td>
                    <td className="txt-suave">{item.fornecedor?.nome ?? 'Sem fornecedor'}</td>
                    <td>
                      <div className="barra">
                        <span style={{ width: `${n.pct}%`, background: n.cor }} />
                      </div>
                    </td>
                    <td className="direita forte">
                      {item.quantidadeAtual} {item.unidade}
                    </td>
                    <td className="direita">
                      {item.estoqueMinimo} {item.unidade}
                    </td>
                    <td>
                      {item.emAlerta ? (
                        <span className="badge vermelho">
                          <IconeComprar fontSize="inherit" /> Comprar
                        </span>
                      ) : (
                        <span className="badge verde">
                          <IconeOk fontSize="inherit" /> Ok
                        </span>
                      )}
                    </td>
                    <td>
                      <button
                        className="btn secundario"
                        style={{ padding: '6px 10px', fontSize: 13 }}
                        onClick={() => setModalItem(item)}
                        aria-label={`Movimentar estoque de ${item.nome}`}
                      >
                        <IconeAdicionar sx={{ fontSize: 15 }} /> Movimentar
                      </button>
                    </td>
                  </tr>
                )
              })}
              {itensFiltrados.length === 0 && (
                <tr>
                  <td colSpan={8} className="vazio">
                    {filtro === 'alerta' ? 'Nenhum item em alerta.' : 'Nenhum item no estoque.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Painel de alertas de compra detalhado */}
      {totalAlertas > 0 && !carregando && (
        <div className="card">
          <div className="card-head">
            <div>
              <h2>
                <IconeAlerta sx={{ fontSize: 18, verticalAlign: '-3px', color: 'var(--amarelo)' }} />{' '}
                Lista de compras
              </h2>
              <p>Itens que precisam de reposição urgente</p>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Peça</th>
                <th>Fornecedor</th>
                <th className="direita">Saldo atual</th>
                <th className="direita">Mínimo</th>
                <th className="direita">Faltam</th>
              </tr>
            </thead>
            <tbody>
              {alertas.map((a) => (
                <tr key={a.id} className="linha-alerta">
                  <td className="forte">
                    {a.nome}
                    {a.codigo && <span className="mono txt-suave"> · {a.codigo}</span>}
                  </td>
                  <td>{a.fornecedor?.nome ?? <span className="txt-suave">Sem fornecedor</span>}</td>
                  <td className="direita">{a.quantidadeAtual} {a.unidade}</td>
                  <td className="direita">{a.estoqueMinimo} {a.unidade}</td>
                  <td className="direita forte" style={{ color: 'var(--vermelho)' }}>
                    {a.faltam} {a.unidade}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
