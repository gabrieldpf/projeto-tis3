'use client'
// Orçamentos — ligados à API real.
// J1: montar orçamento com peça (busca pelo CHASSI do veículo) e mão de obra,
//     total na hora; o item de peça copia o preço do dia (regra de ouro nº 3).
// J2: edição simultânea — ao salvar um item com versão velha, a API devolve 409
//     e a tela MOSTRA o valor salvo pela outra pessoa + o que você digitou; você
//     escolhe o que manter. Nada é descartado em silêncio (regra de ouro nº 4).
// G3: enviar / autorizar / recusar o orçamento.

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  listarOrcamentos,
  obterOrcamento,
  criarOrcamento,
  adicionarItemOrcamento,
  atualizarItemOrcamento,
  removerItemOrcamento,
  acaoOrcamento,
  listarClientes,
  listarVeiculos,
  listarPecas,
  type OrcamentoApi,
  type ItemOrcamentoApi,
  type ClienteApi,
  type VeiculoApi,
  type PecaApi,
  type ItemEntradaApi,
  ApiClientError,
} from '@/lib/api'
import { moeda } from '@/utils/format'
import { BadgeOrcamento } from '@/components/Badges'
import {
  ROTULO_FORMA_AUTORIZACAO,
  FORMAS_AUTORIZACAO,
  type FormaAutorizacao,
} from '@/lib/constants'
import { IconeBusca, IconeAdicionar, IconeEditar } from '@/components/icons'

function formatarData(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR')
}
function totalItens(itens: { quantidade: number; valorUnitario: number }[]): number {
  return itens.reduce((s, it) => s + it.quantidade * it.valorUnitario, 0)
}
function num(v: string): number {
  return parseFloat(v.replace(',', '.')) || 0
}
const EDITAVEL = ['RASCUNHO', 'AGUARDANDO_AUTORIZACAO']

const FILTROS: { valor: string; texto: string }[] = [
  { valor: 'todos', texto: 'Todos' },
  { valor: 'RASCUNHO', texto: 'Rascunho' },
  { valor: 'AGUARDANDO_AUTORIZACAO', texto: 'Aguardando' },
  { valor: 'AUTORIZADO', texto: 'Autorizados' },
  { valor: 'RECUSADO', texto: 'Recusados' },
]

// =======================================================================
// Seletor de peça por CHASSI (reaproveita a busca da Sprint 1)
// =======================================================================

function SeletorPeca({
  chassi,
  onEscolher,
  disabled,
}: {
  chassi: string | null
  onEscolher: (p: PecaApi) => void
  disabled?: boolean
}) {
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState<PecaApi[]>([])
  const [aberto, setAberto] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (!busca.trim()) {
      setResultados([])
      return
    }
    timer.current = setTimeout(async () => {
      try {
        const r = await listarPecas({ q: busca.trim(), chassi: chassi?.trim() || undefined })
        setResultados(r.slice(0, 8))
        setAberto(true)
      } catch {
        setResultados([])
      }
    }, 350)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [busca, chassi])

  return (
    <div style={{ position: 'relative' }}>
      <input
        className="input"
        placeholder={chassi ? 'Buscar peça (filtra pelo chassi)…' : 'Buscar peça…'}
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        onFocus={() => resultados.length && setAberto(true)}
        disabled={disabled}
        aria-label="Buscar peça"
      />
      {aberto && resultados.length > 0 && (
        <div
          style={{
            position: 'absolute',
            zIndex: 20,
            top: '100%',
            left: 0,
            right: 0,
            background: '#fff',
            border: '1px solid #e3e8ef',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,.1)',
            maxHeight: 220,
            overflowY: 'auto',
          }}
        >
          {resultados.map((p) => (
            <button
              key={p.id}
              type="button"
              className="item-dropdown"
              onClick={() => {
                onEscolher(p)
                setBusca('')
                setResultados([])
                setAberto(false)
              }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '8px 12px',
                border: 'none',
                borderBottom: '1px solid #f1f4f8',
                background: 'transparent',
                cursor: 'pointer',
              }}
            >
              <strong>{p.nome}</strong>{' '}
              <span className="txt-suave">· {moeda(p.precoDia)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// =======================================================================
// Modal: Novo orçamento
// =======================================================================

interface ItemRascunho {
  tipo: 'PECA' | 'MAO_DE_OBRA'
  pecaId?: string
  descricao: string
  quantidade: string
  valorUnitario: string
}

function ModalNovoOrcamento({
  clientes,
  veiculos,
  onFechar,
  onCriado,
}: {
  clientes: ClienteApi[]
  veiculos: VeiculoApi[]
  onFechar: () => void
  onCriado: (o: OrcamentoApi) => void
}) {
  const [clienteId, setClienteId] = useState('')
  const [veiculoId, setVeiculoId] = useState('')
  const [observacao, setObservacao] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [itens, setItens] = useState<ItemRascunho[]>([])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const veiculosDoCliente = veiculos.filter((v) => v.clienteId === clienteId)
  const veiculoSel = veiculos.find((v) => v.id === veiculoId) ?? null

  function addPeca(p: PecaApi) {
    setItens((prev) => [
      ...prev,
      { tipo: 'PECA', pecaId: p.id, descricao: p.nome, quantidade: '1', valorUnitario: String(p.precoDia) },
    ])
  }
  function addMaoDeObra() {
    setItens((prev) => [...prev, { tipo: 'MAO_DE_OBRA', descricao: '', quantidade: '1', valorUnitario: '0' }])
  }
  function atualizar(i: number, campo: keyof ItemRascunho, valor: string) {
    setItens((prev) => prev.map((it, idx) => (idx === i ? { ...it, [campo]: valor } : it)))
  }
  function remover(i: number) {
    setItens((prev) => prev.filter((_, idx) => idx !== i))
  }

  const total = itens.reduce((s, it) => s + num(it.quantidade) * num(it.valorUnitario), 0)

  async function handleSalvar() {
    if (!clienteId) return setErro('Selecione o cliente.')
    if (!veiculoId) return setErro('Selecione o veículo.')
    const itensLimpos: ItemEntradaApi[] = itens
      .filter((it) => it.descricao.trim())
      .map((it) => ({
        tipo: it.tipo,
        pecaId: it.pecaId,
        descricao: it.descricao.trim(),
        quantidade: num(it.quantidade) || 1,
        valorUnitario: num(it.valorUnitario),
      }))
    setSalvando(true)
    setErro(null)
    try {
      const criado = await criarOrcamento({
        clienteId,
        veiculoId,
        observacao: observacao.trim() || undefined,
        responsavel: responsavel.trim() || undefined,
        itens: itensLimpos,
      })
      onCriado(criado)
    } catch (e) {
      setErro(e instanceof ApiClientError ? e.message : 'Não foi possível criar o orçamento.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="t-novo-orc">
      <div className="modal-box" style={{ maxWidth: 720 }}>
        <div className="modal-head">
          <h2 id="t-novo-orc">Novo orçamento</h2>
          <button className="btn-fechar" onClick={onFechar} aria-label="Fechar">×</button>
        </div>
        <div className="modal-corpo">
          {erro && <div className="aviso vermelho" role="alert">{erro}</div>}
          {clientes.length === 0 && (
            <div className="aviso amarelo">Cadastre um cliente e um veículo antes de criar um orçamento.</div>
          )}
          <div className="form-grid">
            <div className="campo-form">
              <label htmlFor="o-cli">Cliente *</label>
              <select id="o-cli" className="input" value={clienteId} onChange={(e) => { setClienteId(e.target.value); setVeiculoId('') }} disabled={salvando}>
                <option value="">Selecione…</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div className="campo-form">
              <label htmlFor="o-vei">Veículo *</label>
              <select id="o-vei" className="input" value={veiculoId} onChange={(e) => setVeiculoId(e.target.value)} disabled={salvando || !clienteId}>
                <option value="">{clienteId ? 'Selecione…' : 'Escolha o cliente primeiro'}</option>
                {veiculosDoCliente.map((v) => (
                  <option key={v.id} value={v.id}>{[v.marca, v.modelo].filter(Boolean).join(' ')} {v.placa ? `· ${v.placa}` : ''}</option>
                ))}
              </select>
            </div>
            <div className="campo-form">
              <label htmlFor="o-resp">Responsável</label>
              <input id="o-resp" className="input" placeholder="Mecânico principal" value={responsavel} onChange={(e) => setResponsavel(e.target.value)} disabled={salvando} />
            </div>
            <div className="campo-form">
              <label htmlFor="o-obs">Observação</label>
              <input id="o-obs" className="input" value={observacao} onChange={(e) => setObservacao(e.target.value)} disabled={salvando} />
            </div>
          </div>

          <h3 style={{ margin: '18px 0 8px', fontSize: 15 }}>Itens</h3>
          {veiculoId ? (
            <div className="campo-form" style={{ marginBottom: 12 }}>
              <label>Adicionar peça {veiculoSel?.chassi ? '(busca filtrada pelo chassi)' : ''}</label>
              <SeletorPeca chassi={veiculoSel?.chassi ?? null} onEscolher={addPeca} disabled={salvando} />
            </div>
          ) : (
            <p className="txt-suave" style={{ marginBottom: 12 }}>Selecione o veículo para buscar peças pelo chassi.</p>
          )}

          {itens.map((it, i) => (
            <div key={i} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid #eef1f5' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                <span className={`badge ${it.tipo === 'PECA' ? 'azul' : 'cinza'}`}>{it.tipo === 'PECA' ? 'Peça' : 'Mão de obra'}</span>
                <input className="input" style={{ flex: 1 }} placeholder="Descrição" value={it.descricao} onChange={(e) => atualizar(i, 'descricao', e.target.value)} disabled={salvando} aria-label="Descrição do item" />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="input" style={{ flex: '1 1 90px' }} type="number" min="0" step="0.01" placeholder="Qtd" value={it.quantidade} onChange={(e) => atualizar(i, 'quantidade', e.target.value)} disabled={salvando} aria-label="Quantidade" />
                <input className="input" style={{ flex: '1 1 120px' }} type="number" min="0" step="0.01" placeholder="Valor unit." value={it.valorUnitario} onChange={(e) => atualizar(i, 'valorUnitario', e.target.value)} disabled={salvando} aria-label="Valor unitário" />
                <span className="forte" style={{ alignSelf: 'center', minWidth: 90, textAlign: 'right' }}>{moeda(num(it.quantidade) * num(it.valorUnitario))}</span>
                <button className="btn secundario" style={{ padding: '6px 10px' }} onClick={() => remover(i)} disabled={salvando} aria-label="Remover item">×</button>
              </div>
            </div>
          ))}

          <button className="btn secundario" onClick={addMaoDeObra} disabled={salvando}>
            <IconeAdicionar sx={{ fontSize: 16 }} /> Adicionar mão de obra
          </button>

          <p className="txt-suave" style={{ marginTop: 14, textAlign: 'right' }}>
            Total: <strong>{moeda(total)}</strong>
          </p>
        </div>
        <div className="modal-rodape">
          <button className="btn secundario" onClick={onFechar} disabled={salvando}>Cancelar</button>
          <button className="btn" onClick={handleSalvar} disabled={salvando || clientes.length === 0}>
            {salvando ? 'Salvando…' : 'Criar orçamento'}
          </button>
        </div>
      </div>
    </div>
  )
}

// =======================================================================
// Painel de detalhe / edição do orçamento (itens + ações)
// =======================================================================

interface ConflitoItem {
  itemId: string
  servidor: ItemOrcamentoApi
  meu: { quantidade: number; valorUnitario: number }
}

function PainelOrcamento({
  orcamentoId,
  onFechar,
  onMudou,
}: {
  orcamentoId: string
  onFechar: () => void
  onMudou: () => void
}) {
  const [orc, setOrc] = useState<OrcamentoApi | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [salvandoItem, setSalvandoItem] = useState<string | null>(null)
  const [conflito, setConflito] = useState<ConflitoItem | null>(null)
  const [acaoPendente, setAcaoPendente] = useState(false)
  const [forma, setForma] = useState<FormaAutorizacao>('PRESENCIAL')

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      setOrc(await obterOrcamento(orcamentoId))
      setErro(null)
    } catch (e) {
      setErro(e instanceof ApiClientError ? e.message : 'Erro ao carregar orçamento.')
    } finally {
      setCarregando(false)
    }
  }, [orcamentoId])

  useEffect(() => { void carregar() }, [carregar])

  const editavel = orc ? EDITAVEL.includes(orc.status) : false

  function setItemLocal(itemId: string, patch: Partial<ItemOrcamentoApi>) {
    setOrc((o) => (o ? { ...o, itens: o.itens.map((it) => (it.id === itemId ? { ...it, ...patch } : it)) } : o))
  }

  async function salvarItem(item: ItemOrcamentoApi, versionParaUsar?: number) {
    setSalvandoItem(item.id)
    setErro(null)
    try {
      const atualizado = await atualizarItemOrcamento(orcamentoId, item.id, {
        descricao: item.descricao,
        quantidade: item.quantidade,
        valorUnitario: item.valorUnitario,
        version: versionParaUsar ?? item.version,
      })
      setItemLocal(item.id, atualizado)
      setConflito(null)
      onMudou()
    } catch (e) {
      if (e instanceof ApiClientError && e.code === 'CONFLITO' && e.detalhes) {
        // J2: a outra pessoa salvou antes. Mostramos o valor dela x o seu.
        setConflito({
          itemId: item.id,
          servidor: e.detalhes as ItemOrcamentoApi,
          meu: { quantidade: item.quantidade, valorUnitario: item.valorUnitario },
        })
      } else {
        setErro(e instanceof ApiClientError ? e.message : 'Não foi possível salvar o item.')
      }
    } finally {
      setSalvandoItem(null)
    }
  }

  // J2 — resolver conflito mantendo o MEU valor (reenvia com a versão do servidor).
  async function manterMeu() {
    if (!conflito || !orc) return
    const item = orc.itens.find((it) => it.id === conflito.itemId)
    if (!item) return
    await salvarItem({ ...item, ...conflito.meu }, conflito.servidor.version)
  }
  // J2 — adotar o valor da outra pessoa.
  function usarDoServidor() {
    if (!conflito) return
    setItemLocal(conflito.itemId, {
      quantidade: conflito.servidor.quantidade,
      valorUnitario: conflito.servidor.valorUnitario,
      descricao: conflito.servidor.descricao,
      version: conflito.servidor.version,
    })
    setConflito(null)
    onMudou()
  }

  async function removerIt(itemId: string) {
    setSalvandoItem(itemId)
    try {
      await removerItemOrcamento(orcamentoId, itemId)
      setOrc((o) => (o ? { ...o, itens: o.itens.filter((it) => it.id !== itemId) } : o))
      onMudou()
    } catch (e) {
      setErro(e instanceof ApiClientError ? e.message : 'Não foi possível remover o item.')
    } finally {
      setSalvandoItem(null)
    }
  }

  async function addMaoDeObra() {
    try {
      const item = await adicionarItemOrcamento(orcamentoId, {
        tipo: 'MAO_DE_OBRA', descricao: 'Mão de obra', quantidade: 1, valorUnitario: 0,
      })
      setOrc((o) => (o ? { ...o, itens: [...o.itens, item] } : o))
      onMudou()
    } catch (e) {
      setErro(e instanceof ApiClientError ? e.message : 'Não foi possível adicionar o item.')
    }
  }
  async function addPeca(p: PecaApi) {
    try {
      const item = await adicionarItemOrcamento(orcamentoId, {
        tipo: 'PECA', pecaId: p.id, descricao: p.nome, quantidade: 1, valorUnitario: p.precoDia,
      })
      setOrc((o) => (o ? { ...o, itens: [...o.itens, item] } : o))
      onMudou()
    } catch (e) {
      setErro(e instanceof ApiClientError ? e.message : 'Não foi possível adicionar a peça.')
    }
  }

  async function executar(acao: 'ENVIAR' | 'AUTORIZAR' | 'RECUSAR') {
    if (!orc) return
    setAcaoPendente(true)
    setErro(null)
    try {
      const atualizado = await acaoOrcamento(orc.id, {
        acao,
        formaAutorizacao: acao === 'AUTORIZAR' ? forma : undefined,
        version: orc.version,
      })
      setOrc(atualizado)
      onMudou()
    } catch (e) {
      setErro(e instanceof ApiClientError ? e.message : 'Não foi possível concluir a ação.')
    } finally {
      setAcaoPendente(false)
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="t-det-orc">
      <div className="modal-box" style={{ maxWidth: 760 }}>
        <div className="modal-head">
          <h2 id="t-det-orc">{orc ? orc.numero : 'Orçamento'}</h2>
          <button className="btn-fechar" onClick={onFechar} aria-label="Fechar">×</button>
        </div>
        <div className="modal-corpo">
          {carregando ? (
            <div className="carregando">Carregando…</div>
          ) : !orc ? (
            <div className="aviso vermelho">{erro ?? 'Orçamento não encontrado.'}</div>
          ) : (
            <>
              {erro && <div className="aviso vermelho" role="alert">{erro}</div>}
              <div className="flex" style={{ justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 12 }}>
                <div>
                  <BadgeOrcamento status={orc.status} />{' '}
                  <span className="txt-suave">
                    {orc.cliente?.nome} · {[orc.veiculo?.marca, orc.veiculo?.modelo].filter(Boolean).join(' ')}
                    {orc.veiculo?.placa ? ` · ${orc.veiculo.placa}` : ''}
                  </span>
                </div>
                {orc.autorizadoEm && (
                  <span className="txt-suave">
                    Autorizado em {formatarData(orc.autorizadoEm)}
                    {orc.formaAutorizacao ? ` (${ROTULO_FORMA_AUTORIZACAO[orc.formaAutorizacao]})` : ''}
                  </span>
                )}
              </div>

              {!editavel && (
                <div className="aviso azul" style={{ marginBottom: 12 }}>
                  Este orçamento está <strong>&nbsp;{orc.status === 'AUTORIZADO' ? 'autorizado' : 'recusado'}</strong>&nbsp;e não pode mais ser editado.
                </div>
              )}

              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Tipo</th>
                    <th className="direita">Qtd</th>
                    <th className="direita">Valor unit.</th>
                    <th className="direita">Subtotal</th>
                    {editavel && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {orc.itens.map((it) => (
                    <tr key={it.id}>
                      <td>
                        {editavel ? (
                          <input className="input" value={it.descricao} onChange={(e) => setItemLocal(it.id, { descricao: e.target.value })} aria-label="Descrição" />
                        ) : it.descricao}
                      </td>
                      <td><span className={`badge ${it.tipo === 'PECA' ? 'azul' : 'cinza'}`}>{it.tipo === 'PECA' ? 'Peça' : 'Mão de obra'}</span></td>
                      <td className="direita">
                        {editavel ? (
                          <input className="input" type="number" min="0" step="0.01" style={{ width: 80, textAlign: 'right' }} value={it.quantidade} onChange={(e) => setItemLocal(it.id, { quantidade: num(e.target.value) })} aria-label="Quantidade" />
                        ) : it.quantidade}
                      </td>
                      <td className="direita">
                        {editavel ? (
                          <input className="input" type="number" min="0" step="0.01" style={{ width: 100, textAlign: 'right' }} value={it.valorUnitario} onChange={(e) => setItemLocal(it.id, { valorUnitario: num(e.target.value) })} aria-label="Valor unitário" />
                        ) : moeda(it.valorUnitario)}
                      </td>
                      <td className="direita forte">{moeda(it.quantidade * it.valorUnitario)}</td>
                      {editavel && (
                        <td>
                          <div className="flex" style={{ gap: 4 }}>
                            <button className="btn secundario" style={{ padding: '4px 8px', fontSize: 12 }} disabled={salvandoItem === it.id} onClick={() => salvarItem(it)}>
                              {salvandoItem === it.id ? '…' : 'Salvar'}
                            </button>
                            <button className="btn secundario" style={{ padding: '4px 8px', fontSize: 12 }} disabled={salvandoItem === it.id} onClick={() => removerIt(it.id)} aria-label="Remover">×</button>
                          </div>
                          {conflito && conflito.itemId === it.id && (
                            <div className="aviso amarelo" style={{ marginTop: 6 }}>
                              <div>
                                <strong>Edição simultânea:</strong> outra pessoa salvou{' '}
                                <strong>{conflito.servidor.quantidade} × {moeda(conflito.servidor.valorUnitario)}</strong>.
                                Você digitou <strong>{conflito.meu.quantidade} × {moeda(conflito.meu.valorUnitario)}</strong>.
                              </div>
                              <div className="flex" style={{ marginTop: 6, gap: 6 }}>
                                <button className="btn" style={{ padding: '4px 10px', fontSize: 12 }} onClick={manterMeu}>Manter o meu</button>
                                <button className="btn secundario" style={{ padding: '4px 10px', fontSize: 12 }} onClick={usarDoServidor}>Usar o da outra pessoa</button>
                              </div>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                  {orc.itens.length === 0 && (
                    <tr><td colSpan={editavel ? 6 : 5} className="vazio">Sem itens.</td></tr>
                  )}
                  <tr>
                    <td colSpan={4} className="direita forte">Total</td>
                    <td className="direita forte">{moeda(totalItens(orc.itens))}</td>
                    {editavel && <td></td>}
                  </tr>
                </tbody>
              </table>

              {editavel && (
                <div style={{ marginTop: 14 }}>
                  <div className="campo-form" style={{ marginBottom: 8 }}>
                    <label>Adicionar peça {orc.veiculo?.chassi ? '(busca pelo chassi)' : ''}</label>
                    <SeletorPeca chassi={orc.veiculo?.chassi ?? null} onEscolher={addPeca} />
                  </div>
                  <button className="btn secundario" onClick={addMaoDeObra}>
                    <IconeAdicionar sx={{ fontSize: 16 }} /> Adicionar mão de obra
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {orc && editavel && (
          <div className="modal-rodape" style={{ flexWrap: 'wrap', gap: 8 }}>
            {orc.status === 'RASCUNHO' && (
              <button className="btn secundario" onClick={() => executar('ENVIAR')} disabled={acaoPendente}>
                Enviar p/ autorização
              </button>
            )}
            <select className="input" style={{ maxWidth: 150 }} value={forma} onChange={(e) => setForma(e.target.value as FormaAutorizacao)} aria-label="Forma de autorização">
              {FORMAS_AUTORIZACAO.map((f) => <option key={f} value={f}>{ROTULO_FORMA_AUTORIZACAO[f]}</option>)}
            </select>
            <button className="btn" onClick={() => executar('AUTORIZAR')} disabled={acaoPendente}>Autorizar</button>
            <button className="btn secundario" onClick={() => executar('RECUSAR')} disabled={acaoPendente}>Recusar</button>
          </div>
        )}
      </div>
    </div>
  )
}

// =======================================================================
// Página principal
// =======================================================================

export default function PaginaOrcamentos() {
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [orcamentos, setOrcamentos] = useState<OrcamentoApi[]>([])
  const [clientes, setClientes] = useState<ClienteApi[]>([])
  const [veiculos, setVeiculos] = useState<VeiculoApi[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [modalNovo, setModalNovo] = useState(false)
  const [abertoId, setAbertoId] = useState<string | null>(null)

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const buscar = useCallback(async (q: string, f: string) => {
    setCarregando(true)
    setErro(null)
    try {
      setOrcamentos(await listarOrcamentos({ q: q.trim() || undefined, status: f === 'todos' ? undefined : f }))
    } catch (e) {
      setErro(e instanceof ApiClientError ? e.message : 'Erro ao carregar orçamentos.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void listarClientes().then(setClientes).catch(() => {})
    void listarVeiculos().then(setVeiculos).catch(() => {})
  }, [])

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void buscar(busca, filtro), 400)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [busca, filtro, buscar])

  function handleCriado(o: OrcamentoApi) {
    setModalNovo(false)
    setOrcamentos((prev) => [o, ...prev])
    setAbertoId(o.id)
  }

  return (
    <>
      {modalNovo && (
        <ModalNovoOrcamento clientes={clientes} veiculos={veiculos} onFechar={() => setModalNovo(false)} onCriado={handleCriado} />
      )}
      {abertoId && (
        <PainelOrcamento orcamentoId={abertoId} onFechar={() => setAbertoId(null)} onMudou={() => void buscar(busca, filtro)} />
      )}

      <div className="acoes-topo">
        <div className="campo-busca">
          <IconeBusca className="lupa" sx={{ fontSize: 20 }} />
          <input placeholder="Buscar por nº, cliente, placa ou modelo…" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar orçamento" />
        </div>
        <button className="btn" onClick={() => setModalNovo(true)}>
          <IconeAdicionar sx={{ fontSize: 18 }} /> Novo orçamento
        </button>
      </div>

      <div className="flex" style={{ flexWrap: 'wrap', marginBottom: 18 }}>
        {FILTROS.map((f) => (
          <button key={f.valor} className={`btn ${filtro === f.valor ? '' : 'secundario'}`} onClick={() => setFiltro(f.valor)}>
            {f.texto}
          </button>
        ))}
      </div>

      <div className="card">
        {carregando ? (
          <div className="carregando">Carregando orçamentos…</div>
        ) : erro ? (
          <div className="aviso vermelho" style={{ margin: 16 }}>{erro}</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Orçamento</th>
                <th>Cliente</th>
                <th>Veículo</th>
                <th>Criado</th>
                <th>Status</th>
                <th className="direita">Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orcamentos.map((o) => (
                <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => setAbertoId(o.id)}>
                  <td className="mono forte">{o.numero}</td>
                  <td>{o.cliente?.nome ?? 'Sem cliente'}</td>
                  <td>
                    {[o.veiculo?.marca, o.veiculo?.modelo].filter(Boolean).join(' ')}{' '}
                    {o.veiculo?.placa && <span className="mono">· {o.veiculo.placa}</span>}
                  </td>
                  <td>{formatarData(o.createdAt)}</td>
                  <td><BadgeOrcamento status={o.status} /></td>
                  <td className="direita forte">{moeda(totalItens(o.itens))}</td>
                  <td>
                    <button className="btn secundario" style={{ padding: '6px 10px', fontSize: 13 }} onClick={(e) => { e.stopPropagation(); setAbertoId(o.id) }} aria-label={`Abrir ${o.numero}`}>
                      <IconeEditar sx={{ fontSize: 15 }} /> Abrir
                    </button>
                  </td>
                </tr>
              ))}
              {orcamentos.length === 0 && (
                <tr><td colSpan={7} className="vazio">Nenhum orçamento encontrado.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
