'use client'
// PainelAditivo (O1/O2): detalhe e edição de um aditivo de orçamento.
// Espelha PainelOrcamento: itens inline, seletor de peça por chassi,
// conflito 409 com "Manter o meu / Usar o da outra pessoa", ações ENVIAR/AUTORIZAR/RECUSAR.
// Editável apenas nos status RASCUNHO | AGUARDANDO_AUTORIZACAO.

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  obterAditivo,
  atualizarAditivo,
  adicionarItemAditivo,
  atualizarItemAditivo,
  removerItemAditivo,
  acaoAditivo,
  type AditivoApi,
  type ItemOrcamentoApi,
  type PecaApi,
  ApiClientError,
} from '@/lib/api'
import {
  ROTULO_FORMA_AUTORIZACAO,
  FORMAS_AUTORIZACAO,
  ROTULO_ORIGEM_PECA,
  ROTULO_STATUS_ADITIVO,
  type FormaAutorizacao,
  type StatusAditivo,
  type OrigemPeca,
} from '@/lib/constants'
import { moeda } from '@/utils/format'
import { BadgeOrcamento } from '@/components/Badges'
import { SeletorPeca } from '@/components/SeletorPeca'
import { IndicadorPresenca } from '@/components/IndicadorPresenca'
import { usePresenca } from '@/lib/usePresenca'
import {
  IconeAdicionar,
  IconeOk,
} from '@/components/icons'

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

function num(v: string): number {
  return parseFloat(v.replace(',', '.')) || 0
}

function totalItens(itens: { quantidade: number; valorUnitario: number }[]): number {
  return itens.reduce((s, it) => s + it.quantidade * it.valorUnitario, 0)
}

function formatarData(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR')
}

const EDITAVEL_STATUS: StatusAditivo[] = ['RASCUNHO', 'AGUARDANDO_AUTORIZACAO']

// -----------------------------------------------------------------------
// Bloco de conflito (O2)
// -----------------------------------------------------------------------

interface ConflitoItem {
  itemId: string
  servidor: ItemOrcamentoApi
  meu: { quantidade: number; valorUnitario: number }
}

// -----------------------------------------------------------------------
// Painel principal
// -----------------------------------------------------------------------

interface PainelAditivoProps {
  aditivoId: string
  chassiVeiculo: string | null
  onFechar: () => void
  onMudou: () => void
}

export function PainelAditivo({ aditivoId, chassiVeiculo, onFechar, onMudou }: PainelAditivoProps) {
  const [aditivo, setAditivo] = useState<AditivoApi | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)
  const [salvandoItem, setSalvandoItem] = useState<string | null>(null)
  const [conflito, setConflito] = useState<ConflitoItem | null>(null)
  const [acaoPendente, setAcaoPendente] = useState(false)
  const [forma, setForma] = useState<FormaAutorizacao>('PRESENCIAL')
  const primeiroRef = useRef<HTMLInputElement>(null)

  // O3 — presença de edição
  const { outros } = usePresenca('ADITIVO', aditivoId)

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      setAditivo(await obterAditivo(aditivoId))
      setErro(null)
    } catch (e) {
      setErro(e instanceof ApiClientError ? e.message : 'Erro ao carregar aditivo.')
    } finally {
      setCarregando(false)
    }
  }, [aditivoId])

  useEffect(() => {
    void carregar()
  }, [carregar])

  useEffect(() => {
    if (!carregando) {
      primeiroRef.current?.focus()
    }
  }, [carregando])

  const editavel = aditivo ? EDITAVEL_STATUS.includes(aditivo.status as StatusAditivo) : false

  function setItemLocal(itemId: string, patch: Partial<ItemOrcamentoApi>) {
    setAditivo((a) =>
      a ? { ...a, itens: a.itens.map((it) => (it.id === itemId ? { ...it, ...patch } : it)) } : a,
    )
  }

  async function salvarItem(item: ItemOrcamentoApi, versionParaUsar?: number) {
    setSalvandoItem(item.id)
    setErro(null)
    try {
      const atualizado = await atualizarItemAditivo(aditivoId, item.id, {
        descricao: item.descricao,
        quantidade: item.quantidade,
        valorUnitario: item.valorUnitario,
        origemPeca: (item.origemPeca as OrigemPeca) ?? undefined,
        garantiaDias: item.garantiaDias,
        version: versionParaUsar ?? item.version,
      })
      setItemLocal(item.id, atualizado)
      setConflito(null)
      onMudou()
    } catch (e) {
      if (e instanceof ApiClientError && e.code === 'CONFLITO' && e.detalhes) {
        // O2: outra pessoa salvou antes. Mostrar valor dela x o digitado.
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

  // O2 — manter o valor digitado (reenvia com a versão do servidor).
  async function manterMeu() {
    if (!conflito || !aditivo) return
    const item = aditivo.itens.find((it) => it.id === conflito.itemId)
    if (!item) return
    await salvarItem({ ...item, ...conflito.meu }, conflito.servidor.version)
  }

  // O2 — adotar o valor da outra pessoa.
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
      await removerItemAditivo(aditivoId, itemId)
      setAditivo((a) => (a ? { ...a, itens: a.itens.filter((it) => it.id !== itemId) } : a))
      onMudou()
    } catch (e) {
      setErro(e instanceof ApiClientError ? e.message : 'Não foi possível remover o item.')
    } finally {
      setSalvandoItem(null)
    }
  }

  async function addMaoDeObra() {
    try {
      const item = await adicionarItemAditivo(aditivoId, {
        tipo: 'MAO_DE_OBRA',
        descricao: 'Mão de obra',
        quantidade: 1,
        valorUnitario: 0,
      })
      setAditivo((a) => (a ? { ...a, itens: [...a.itens, item] } : a))
      onMudou()
    } catch (e) {
      setErro(e instanceof ApiClientError ? e.message : 'Não foi possível adicionar o item.')
    }
  }

  async function addPeca(p: PecaApi) {
    try {
      const item = await adicionarItemAditivo(aditivoId, {
        tipo: 'PECA',
        pecaId: p.id,
        descricao: p.nome,
        quantidade: 1,
        valorUnitario: p.precoDia,
      })
      setAditivo((a) => (a ? { ...a, itens: [...a.itens, item] } : a))
      onMudou()
    } catch (e) {
      setErro(e instanceof ApiClientError ? e.message : 'Não foi possível adicionar a peça.')
    }
  }

  async function executarAcao(acao: 'ENVIAR' | 'AUTORIZAR' | 'RECUSAR') {
    if (!aditivo) return
    setAcaoPendente(true)
    setErro(null)
    setSucesso(null)
    try {
      const atualizado = await acaoAditivo(aditivo.id, {
        acao,
        formaAutorizacao: acao === 'AUTORIZAR' ? forma : undefined,
        version: aditivo.version,
      })
      setAditivo(atualizado)
      if (acao === 'AUTORIZAR') setSucesso('Aditivo autorizado com sucesso.')
      if (acao === 'RECUSAR') setSucesso('Aditivo recusado.')
      onMudou()
    } catch (e) {
      if (e instanceof ApiClientError && e.code === 'CONFLITO') {
        setErro('Aditivo foi alterado por outra pessoa. Recarregue e tente novamente.')
      } else {
        setErro(e instanceof ApiClientError ? e.message : 'Não foi possível concluir a ação.')
      }
    } finally {
      setAcaoPendente(false)
    }
  }

  async function salvarObservacao(observacao: string) {
    if (!aditivo) return
    try {
      const atualizado = await atualizarAditivo(aditivo.id, { observacao, version: aditivo.version })
      setAditivo(atualizado)
      onMudou()
    } catch (e) {
      setErro(e instanceof ApiClientError ? e.message : 'Não foi possível salvar a observação.')
    }
  }

  const idTitulo = `titulo-aditivo-${aditivoId}`

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby={idTitulo}>
      <div className="modal-box" style={{ maxWidth: 800 }}>
        <div className="modal-head">
          <h2 id={idTitulo}>
            {aditivo ? `Aditivo #${aditivo.numero}` : 'Aditivo'}
          </h2>
          <button className="btn-fechar" onClick={onFechar} aria-label="Fechar">
            ×
          </button>
        </div>

        <div className="modal-corpo">
          {carregando ? (
            <div className="carregando">Carregando aditivo…</div>
          ) : !aditivo ? (
            <div className="aviso vermelho" role="alert">
              {erro ?? 'Aditivo não encontrado.'}
            </div>
          ) : (
            <>
              {/* O3 — indicador de presença */}
              <IndicadorPresenca outros={outros} />

              {erro && (
                <div className="aviso vermelho" role="alert">
                  {erro}
                </div>
              )}
              {sucesso && (
                <div className="aviso azul">
                  <IconeOk sx={{ fontSize: 16, verticalAlign: '-2px' }} /> {sucesso}
                </div>
              )}

              {/* Cabeçalho do aditivo */}
              <div
                className="flex"
                style={{ justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 12 }}
              >
                <div>
                  <BadgeOrcamento status={aditivo.status} />{' '}
                  <span className="txt-suave">{ROTULO_STATUS_ADITIVO[aditivo.status as StatusAditivo]}</span>
                </div>
                {aditivo.autorizadoEm && (
                  <span className="txt-suave">
                    Autorizado em {formatarData(aditivo.autorizadoEm)}
                    {aditivo.formaAutorizacao
                      ? ` (${ROTULO_FORMA_AUTORIZACAO[aditivo.formaAutorizacao]})`
                      : ''}
                  </span>
                )}
              </div>

              {!editavel && (
                <div className="aviso azul" style={{ marginBottom: 12 }}>
                  Este aditivo está{' '}
                  <strong>
                    {aditivo.status === 'AUTORIZADO' ? 'autorizado' : ROTULO_STATUS_ADITIVO[aditivo.status as StatusAditivo].toLowerCase()}
                  </strong>{' '}
                  e não pode mais ser editado.
                </div>
              )}

              {/* Observação */}
              {editavel && (
                <div className="campo-form" style={{ marginBottom: 14 }}>
                  <label htmlFor={`adi-obs-${aditivoId}`}>Observação</label>
                  <input
                    ref={primeiroRef}
                    id={`adi-obs-${aditivoId}`}
                    className="input"
                    defaultValue={aditivo.observacao ?? ''}
                    onBlur={(e) => {
                      if (e.target.value !== (aditivo.observacao ?? '')) {
                        void salvarObservacao(e.target.value)
                      }
                    }}
                    aria-label="Observação do aditivo"
                  />
                </div>
              )}

              {/* Tabela de itens */}
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Tipo</th>
                    <th>Origem</th>
                    <th>Garantia</th>
                    <th className="direita">Qtd</th>
                    <th className="direita">Valor unit.</th>
                    <th className="direita">Subtotal</th>
                    {editavel && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {aditivo.itens.map((it) => (
                    <tr key={it.id}>
                      <td>
                        {editavel ? (
                          <input
                            className="input"
                            value={it.descricao}
                            onChange={(e) => setItemLocal(it.id, { descricao: e.target.value })}
                            aria-label={`Descrição de ${it.descricao}`}
                          />
                        ) : (
                          it.descricao
                        )}
                      </td>
                      <td>
                        <span className={`badge ${it.tipo === 'PECA' ? 'azul' : 'cinza'}`}>
                          {it.tipo === 'PECA' ? 'Peça' : 'M.O.'}
                        </span>
                      </td>
                      <td>
                        {it.tipo === 'PECA' ? (
                          editavel ? (
                            <select
                              className="input"
                              style={{ minWidth: 120 }}
                              value={it.origemPeca ?? 'ESTOQUE'}
                              onChange={(e) =>
                                setItemLocal(it.id, { origemPeca: e.target.value as 'ESTOQUE' | 'COMPRA_AVULSA' })
                              }
                              aria-label={`Origem da peça ${it.descricao}`}
                            >
                              <option value="ESTOQUE">{ROTULO_ORIGEM_PECA.ESTOQUE}</option>
                              <option value="COMPRA_AVULSA">{ROTULO_ORIGEM_PECA.COMPRA_AVULSA}</option>
                            </select>
                          ) : it.origemPeca ? (
                            ROTULO_ORIGEM_PECA[it.origemPeca as OrigemPeca]
                          ) : (
                            '—'
                          )
                        ) : (
                          <span className="txt-suave">—</span>
                        )}
                      </td>
                      <td>
                        {editavel ? (
                          <input
                            className="input"
                            type="number"
                            min="0"
                            style={{ width: 70 }}
                            value={it.garantiaDias ?? ''}
                            placeholder="dias"
                            onChange={(e) =>
                              setItemLocal(it.id, {
                                garantiaDias: e.target.value ? parseInt(e.target.value, 10) : null,
                              })
                            }
                            aria-label={`Garantia em dias de ${it.descricao}`}
                          />
                        ) : it.garantiaDias ? (
                          `${it.garantiaDias}d`
                        ) : (
                          <span className="txt-suave">—</span>
                        )}
                      </td>
                      <td className="direita">
                        {editavel ? (
                          <input
                            className="input"
                            type="number"
                            min="0"
                            step="0.01"
                            style={{ width: 80, textAlign: 'right' }}
                            value={it.quantidade}
                            onChange={(e) =>
                              setItemLocal(it.id, { quantidade: num(e.target.value) })
                            }
                            aria-label={`Quantidade de ${it.descricao}`}
                          />
                        ) : (
                          it.quantidade
                        )}
                      </td>
                      <td className="direita">
                        {editavel ? (
                          <input
                            className="input"
                            type="number"
                            min="0"
                            step="0.01"
                            style={{ width: 100, textAlign: 'right' }}
                            value={it.valorUnitario}
                            onChange={(e) =>
                              setItemLocal(it.id, { valorUnitario: num(e.target.value) })
                            }
                            aria-label={`Valor unitário de ${it.descricao}`}
                          />
                        ) : (
                          moeda(it.valorUnitario)
                        )}
                      </td>
                      <td className="direita forte">
                        {moeda(it.quantidade * it.valorUnitario)}
                      </td>
                      {editavel && (
                        <td>
                          <div className="flex" style={{ gap: 4 }}>
                            <button
                              className="btn secundario"
                              style={{ padding: '4px 8px', fontSize: 12 }}
                              disabled={salvandoItem === it.id}
                              onClick={() => salvarItem(it)}
                              aria-label={`Salvar ${it.descricao}`}
                            >
                              {salvandoItem === it.id ? '…' : 'Salvar'}
                            </button>
                            <button
                              className="btn secundario"
                              style={{ padding: '4px 8px', fontSize: 12 }}
                              disabled={salvandoItem === it.id}
                              onClick={() => removerIt(it.id)}
                              aria-label={`Remover ${it.descricao}`}
                            >
                              ×
                            </button>
                          </div>
                          {/* O2 — bloco de conflito */}
                          {conflito && conflito.itemId === it.id && (
                            <div className="aviso amarelo" style={{ marginTop: 6 }}>
                              <div>
                                <strong>Edição simultânea:</strong> outra pessoa salvou{' '}
                                <strong>
                                  {conflito.servidor.quantidade} ×{' '}
                                  {moeda(conflito.servidor.valorUnitario)}
                                </strong>
                                . Você digitou{' '}
                                <strong>
                                  {conflito.meu.quantidade} × {moeda(conflito.meu.valorUnitario)}
                                </strong>
                                .
                              </div>
                              <div className="flex" style={{ marginTop: 6, gap: 6 }}>
                                <button
                                  className="btn"
                                  style={{ padding: '4px 10px', fontSize: 12 }}
                                  onClick={manterMeu}
                                >
                                  Manter o meu
                                </button>
                                <button
                                  className="btn secundario"
                                  style={{ padding: '4px 10px', fontSize: 12 }}
                                  onClick={usarDoServidor}
                                >
                                  Usar o da outra pessoa
                                </button>
                              </div>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                  {aditivo.itens.length === 0 && (
                    <tr>
                      <td colSpan={editavel ? 8 : 7} className="vazio">
                        Sem itens.
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td colSpan={editavel ? 6 : 5} className="direita forte">
                      Total
                    </td>
                    <td className="direita forte">{moeda(totalItens(aditivo.itens))}</td>
                    {editavel && <td></td>}
                  </tr>
                </tbody>
              </table>

              {/* Adicionar peça / mão de obra */}
              {editavel && (
                <div style={{ marginTop: 14 }}>
                  <div className="campo-form" style={{ marginBottom: 8 }}>
                    <label>
                      Adicionar peça{chassiVeiculo ? ' (busca pelo chassi)' : ''}
                    </label>
                    <SeletorPeca chassi={chassiVeiculo} onEscolher={addPeca} />
                  </div>
                  <button className="btn secundario" onClick={addMaoDeObra}>
                    <IconeAdicionar sx={{ fontSize: 16 }} /> Adicionar mão de obra
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Rodapé com ações */}
        {aditivo && editavel && (
          <div className="modal-rodape" style={{ flexWrap: 'wrap', gap: 8 }}>
            {aditivo.status === 'RASCUNHO' && (
              <button
                className="btn secundario"
                onClick={() => executarAcao('ENVIAR')}
                disabled={acaoPendente}
              >
                Enviar p/ autorização
              </button>
            )}
            <select
              className="input"
              style={{ maxWidth: 150 }}
              value={forma}
              onChange={(e) => setForma(e.target.value as FormaAutorizacao)}
              aria-label="Forma de autorização"
            >
              {FORMAS_AUTORIZACAO.map((f) => (
                <option key={f} value={f}>
                  {ROTULO_FORMA_AUTORIZACAO[f]}
                </option>
              ))}
            </select>
            <button
              className="btn"
              onClick={() => executarAcao('AUTORIZAR')}
              disabled={acaoPendente}
            >
              Autorizar
            </button>
            <button
              className="btn secundario"
              onClick={() => executarAcao('RECUSAR')}
              disabled={acaoPendente}
            >
              Recusar
            </button>
          </div>
        )}
        {aditivo && !editavel && (
          <div className="modal-rodape">
            <button className="btn secundario" onClick={onFechar}>
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
