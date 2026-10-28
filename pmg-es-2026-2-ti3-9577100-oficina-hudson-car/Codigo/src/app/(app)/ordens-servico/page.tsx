'use client'
// Ordens de serviço — Sprint 3.
// N1: marcar PRONTA via marcarOSPronta (baixa de estoque + pendências).
// N3: entrega via ModalEntrega (2 passos: prévia → confirmar → sucesso).
// O1: seção "Aditivos" no PainelOS com criarAditivo + PainelAditivo.
// Query param: ?os=<id> pré-abre o detalhe da OS.

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  listarOrdensServico,
  listarOrcamentos,
  listarMecanicos,
  criarOrdemServico,
  atualizarOrdemServico,
  obterOrdemServico,
  marcarOSPronta,
  resolverPendenciaBaixa,
  obterPreviaEntrega,
  entregarOS,
  listarAditivos,
  criarAditivo,
  type OrdemServicoApi,
  type OrdemServicoDetalheApi,
  type OrcamentoApi,
  type MecanicoApi,
  type ResultadoBaixaApi,
  type PendenciaBaixaApi,
  type PreviaEntregaApi,
  type AditivoApi,
  ApiClientError,
} from '@/lib/api'
import { BadgeOS } from '@/components/Badges'
import { PainelAditivo } from '@/components/PainelAditivo'
import {
  ROTULO_STATUS_OS,
  TRANSICOES_OS,
  ROTULO_STATUS_ADITIVO,
  type StatusOS,
  type StatusAditivo,
} from '@/lib/constants'
import {
  IconeBusca,
  IconeAdicionar,
  IconeOk,
  IconeConcluido,
  IconeAlerta,
  IconeGarantia,
  IconeComprar,
} from '@/components/icons'
import { moeda } from '@/utils/format'

function formatarData(iso: string | null | undefined): string {
  if (!iso) return 'A definir'
  return new Date(iso).toLocaleDateString('pt-BR')
}

const FILTROS: { valor: string; texto: string }[] = [
  { valor: 'todas', texto: 'Todas' },
  { valor: 'ABERTA', texto: 'Abertas' },
  { valor: 'EM_ANDAMENTO', texto: 'Em andamento' },
  { valor: 'AGUARDANDO_PECA', texto: 'Aguardando peça' },
  { valor: 'PRONTA', texto: 'Prontas' },
  { valor: 'ENTREGUE', texto: 'Entregues' },
]

// =======================================================================
// N1 — Bloco de pendência de baixa
// =======================================================================

interface BlocoPendenciaProps {
  osId: string
  pendencia: PendenciaBaixaApi
  onResolvida: (p: PendenciaBaixaApi) => void
}

function BlocoPendencia({ osId, pendencia, onResolvida }: BlocoPendenciaProps) {
  const [modo, setModo] = useState<'idle' | 'ajuste'>('idle')
  const [qtdAjuste, setQtdAjuste] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function resolverCompraAvulsa() {
    setSalvando(true)
    setErro(null)
    try {
      await resolverPendenciaBaixa(osId, pendencia.itemId, {
        acao: 'COMPRA_AVULSA',
        version: pendencia.version,
      })
      onResolvida(pendencia)
    } catch (e) {
      if (e instanceof ApiClientError && e.code === 'CONFLITO') {
        setErro('Dado desatualizado. Recarregue e tente novamente.')
      } else {
        setErro(e instanceof ApiClientError ? e.message : 'Não foi possível resolver.')
      }
    } finally {
      setSalvando(false)
    }
  }

  async function resolverAjuste() {
    const qtd = parseFloat(qtdAjuste.replace(',', '.'))
    if (!qtd || qtd <= 0) {
      setErro('Informe uma quantidade válida.')
      return
    }
    setSalvando(true)
    setErro(null)
    try {
      await resolverPendenciaBaixa(osId, pendencia.itemId, {
        acao: 'AJUSTE_ESTOQUE',
        quantidade: qtd,
        version: pendencia.version,
      })
      onResolvida(pendencia)
    } catch (e) {
      if (e instanceof ApiClientError && e.code === 'CONFLITO') {
        setErro('Dado desatualizado. Recarregue e tente novamente.')
      } else {
        setErro(e instanceof ApiClientError ? e.message : 'Não foi possível resolver.')
      }
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="aviso amarelo" style={{ marginBottom: 8 }}>
      <div className="flex" style={{ alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <IconeAlerta sx={{ fontSize: 16 }} />
        <strong>
          Faltam {pendencia.faltam} {pendencia.unidade} de {pendencia.pecaNome}
        </strong>
        <span className="txt-suave">
          (em estoque: {pendencia.saldoAtual} {pendencia.unidade} · necessário:{' '}
          {pendencia.quantidadeNecessaria} {pendencia.unidade})
        </span>
      </div>
      {erro && (
        <div className="aviso vermelho" role="alert" style={{ marginBottom: 6 }}>
          {erro}
        </div>
      )}
      {modo === 'idle' ? (
        <div className="flex" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button
            className="btn secundario"
            style={{ fontSize: 13 }}
            disabled={salvando}
            onClick={resolverCompraAvulsa}
            aria-label={`Registrar compra avulsa de ${pendencia.pecaNome}`}
          >
            <IconeComprar sx={{ fontSize: 15 }} /> Registrar compra avulsa
          </button>
          <button
            className="btn secundario"
            style={{ fontSize: 13 }}
            disabled={salvando}
            onClick={() => setModo('ajuste')}
            aria-label={`Ajustar estoque de ${pendencia.pecaNome}`}
          >
            Ajustar estoque
          </button>
        </div>
      ) : (
        <div className="flex" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            className="input"
            type="number"
            min="0.01"
            step="0.01"
            style={{ width: 100 }}
            placeholder={`Qtd (${pendencia.unidade})`}
            value={qtdAjuste}
            onChange={(e) => setQtdAjuste(e.target.value)}
            aria-label={`Quantidade para ajuste de ${pendencia.pecaNome}`}
          />
          <button
            className="btn"
            style={{ fontSize: 13 }}
            disabled={salvando}
            onClick={resolverAjuste}
          >
            {salvando ? 'Salvando…' : 'Confirmar ajuste'}
          </button>
          <button
            className="btn secundario"
            style={{ fontSize: 13 }}
            disabled={salvando}
            onClick={() => setModo('idle')}
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  )
}

// =======================================================================
// N3 — Modal de entrega (2 passos)
// =======================================================================

type EtapaEntrega = 'previa' | 'confirmando' | 'sucesso'

interface ModalEntregaProps {
  os: OrdemServicoDetalheApi
  onFechar: () => void
  onEntregue: (osAtualizada: OrdemServicoApi) => void
}

function ModalEntrega({ os, onFechar, onEntregue }: ModalEntregaProps) {
  const [etapa, setEtapa] = useState<EtapaEntrega>('previa')
  const [previa, setPrevia] = useState<PreviaEntregaApi | null>(null)
  const [carregandoPrevia, setCarregandoPrevia] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [garantiasGeradas, setGarantiasGeradas] = useState<{ descricao: string; validaAte: string }[]>([])

  useEffect(() => {
    obterPreviaEntrega(os.id)
      .then((p) => {
        setPrevia(p)
        setCarregandoPrevia(false)
      })
      .catch((e) => {
        setErro(e instanceof ApiClientError ? e.message : 'Erro ao carregar prévia de entrega.')
        setCarregandoPrevia(false)
      })
  }, [os.id])

  async function confirmarEntrega() {
    setSalvando(true)
    setErro(null)
    try {
      const resultado = await entregarOS(os.id, os.version)
      setGarantiasGeradas(
        resultado.garantias.map((g) => ({
          descricao: g.descricao,
          validaAte: g.validaAte,
        })),
      )
      setEtapa('sucesso')
      onEntregue(resultado.os)
    } catch (e) {
      if (e instanceof ApiClientError && e.code === 'CONFLITO') {
        setErro('OS foi alterada por outra pessoa. Feche e reabra o painel.')
      } else {
        setErro(e instanceof ApiClientError ? e.message : 'Não foi possível registrar a entrega.')
      }
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="t-entrega">
      <div className="modal-box" style={{ maxWidth: 600 }}>
        <div className="modal-head">
          <h2 id="t-entrega">
            {etapa === 'sucesso' ? 'Veículo entregue!' : 'Entregar veículo'}
          </h2>
          <button className="btn-fechar" onClick={onFechar} aria-label="Fechar">
            ×
          </button>
        </div>
        <div className="modal-corpo">
          {etapa === 'previa' && (
            <>
              <p style={{ marginBottom: 12 }}>
                Confira as garantias que serão geradas ao confirmar a entrega:
              </p>
              {carregandoPrevia ? (
                <div className="carregando">Carregando prévia…</div>
              ) : erro ? (
                <div className="aviso vermelho" role="alert">{erro}</div>
              ) : !previa || previa.itens.length === 0 ? (
                <div className="aviso azul">
                  Nenhum item com garantia nesta OS.
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Tipo</th>
                      <th>Prazo</th>
                      <th>Vale até</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previa.itens.map((it) => (
                      <tr key={it.itemId}>
                        <td>{it.descricao}</td>
                        <td>
                          <span className={`badge ${it.tipo === 'PECA' ? 'azul' : 'cinza'}`}>
                            {it.tipo === 'PECA' ? 'Peça' : 'M.O.'}
                          </span>
                        </td>
                        <td>{it.prazoDias} dias</td>
                        <td className="forte">{formatarData(it.validaAte)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}

          {etapa === 'confirmando' && (
            <>
              {erro && (
                <div className="aviso vermelho" role="alert" style={{ marginBottom: 12 }}>
                  {erro}
                </div>
              )}
              <div className="aviso amarelo">
                <strong>Confirmação necessária:</strong> ao registrar a entrega, a OS será
                finalizada e as garantias serão geradas. Esta ação não pode ser desfeita.
              </div>
            </>
          )}

          {etapa === 'sucesso' && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <IconeConcluido sx={{ fontSize: 56, color: 'var(--verde)' }} />
              <h3 style={{ marginTop: 12, color: 'var(--verde)' }}>
                Veículo entregue com sucesso!
              </h3>
              {garantiasGeradas.length > 0 && (
                <>
                  <p className="txt-suave" style={{ marginTop: 8 }}>
                    Garantias geradas:
                  </p>
                  <ul style={{ listStyle: 'none', marginTop: 8, textAlign: 'left' }}>
                    {garantiasGeradas.map((g, i) => (
                      <li key={i} style={{ marginBottom: 4 }}>
                        <IconeGarantia
                          sx={{ fontSize: 15, verticalAlign: '-2px', color: 'var(--verde)' }}
                        />{' '}
                        {g.descricao}{' '}
                        <span className="txt-suave">· válida até {formatarData(g.validaAte)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {garantiasGeradas.length === 0 && (
                <p className="txt-suave" style={{ marginTop: 8 }}>
                  Nenhuma garantia registrada.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="modal-rodape">
          {etapa === 'previa' && !carregandoPrevia && !erro && (
            <>
              <button className="btn secundario" onClick={onFechar}>
                Cancelar
              </button>
              <button
                className="btn"
                onClick={() => setEtapa('confirmando')}
              >
                Confirmar entrega
              </button>
            </>
          )}
          {etapa === 'previa' && erro && (
            <button className="btn secundario" onClick={onFechar}>
              Fechar
            </button>
          )}
          {etapa === 'confirmando' && (
            <>
              <button
                className="btn secundario"
                onClick={() => { setErro(null); setEtapa('previa') }}
                disabled={salvando}
              >
                Voltar
              </button>
              <button className="btn" onClick={confirmarEntrega} disabled={salvando}>
                {salvando ? 'Registrando…' : 'Confirmar — registrar entrega'}
              </button>
            </>
          )}
          {etapa === 'sucesso' && (
            <button className="btn" onClick={onFechar}>
              Fechar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// =======================================================================
// Modal: Nova OS
// =======================================================================

function ModalNovaOS({
  orcamentosDisponiveis,
  mecanicos,
  onFechar,
  onCriada,
}: {
  orcamentosDisponiveis: OrcamentoApi[]
  mecanicos: MecanicoApi[]
  onFechar: () => void
  onCriada: (os: OrdemServicoApi) => void
}) {
  const [orcamentoId, setOrcamentoId] = useState('')
  const [mecanicoId, setMecanicoId] = useState('')
  const [previsao, setPrevisao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const primeiroRef = useRef<HTMLSelectElement>(null)

  useEffect(() => { primeiroRef.current?.focus() }, [])

  async function handleSalvar() {
    if (!orcamentoId) return setErro('Selecione o orçamento autorizado.')
    if (!mecanicoId) return setErro('Selecione o mecânico responsável.')
    setSalvando(true)
    setErro(null)
    try {
      const criada = await criarOrdemServico({ orcamentoId, mecanicoId, previsaoEntrega: previsao || undefined })
      onCriada(criada)
    } catch (e) {
      setErro(e instanceof ApiClientError ? e.message : 'Não foi possível criar a OS.')
    } finally {
      setSalvando(false)
    }
  }

  const semOrcamento = orcamentosDisponiveis.length === 0
  const semMecanico = mecanicos.length === 0

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="t-nova-os">
      <div className="modal-box" style={{ maxWidth: 560 }}>
        <div className="modal-head">
          <h2 id="t-nova-os">Nova ordem de serviço</h2>
          <button className="btn-fechar" onClick={onFechar} aria-label="Fechar">×</button>
        </div>
        <div className="modal-corpo">
          {erro && <div className="aviso vermelho" role="alert">{erro}</div>}
          {semOrcamento && (
            <div className="aviso amarelo">
              Não há orçamento <strong>&nbsp;autorizado&nbsp;</strong> sem OS. Autorize um orçamento primeiro.
            </div>
          )}
          {semMecanico && (
            <div className="aviso amarelo">Cadastre um mecânico antes de abrir uma OS.</div>
          )}
          <div className="form-grid">
            <div className="campo-form" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="os-orc">Orçamento autorizado *</label>
              <select ref={primeiroRef} id="os-orc" className="input" value={orcamentoId} onChange={(e) => setOrcamentoId(e.target.value)} disabled={salvando}>
                <option value="">Selecione…</option>
                {orcamentosDisponiveis.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.numero} · {o.cliente?.nome} · {[o.veiculo?.marca, o.veiculo?.modelo].filter(Boolean).join(' ')}
                  </option>
                ))}
              </select>
            </div>
            <div className="campo-form">
              <label htmlFor="os-mec">Mecânico responsável *</label>
              <select id="os-mec" className="input" value={mecanicoId} onChange={(e) => setMecanicoId(e.target.value)} disabled={salvando}>
                <option value="">Selecione…</option>
                {mecanicos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
            </div>
            <div className="campo-form">
              <label htmlFor="os-prev">Previsão de entrega</label>
              <input id="os-prev" type="date" className="input" value={previsao} onChange={(e) => setPrevisao(e.target.value)} disabled={salvando} />
            </div>
          </div>
        </div>
        <div className="modal-rodape">
          <button className="btn secundario" onClick={onFechar} disabled={salvando}>Cancelar</button>
          <button className="btn" onClick={handleSalvar} disabled={salvando || semOrcamento || semMecanico}>
            {salvando ? 'Salvando…' : 'Criar OS'}
          </button>
        </div>
      </div>
    </div>
  )
}

// =======================================================================
// Painel de detalhe da OS (N1, N3, O1)
// =======================================================================

interface PainelOSProps {
  osId: string
  mecanicos: MecanicoApi[]
  onFechar: () => void
  onAtualizada: (os: OrdemServicoApi) => void
}

function PainelOS({ osId, mecanicos, onFechar, onAtualizada }: PainelOSProps) {
  const [atual, setAtual] = useState<OrdemServicoDetalheApi | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [mecanicoId, setMecanicoId] = useState('')
  const [previsao, setPrevisao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // N1 — resultado da baixa de estoque
  const [resultadoBaixa, setResultadoBaixa] = useState<ResultadoBaixaApi | null>(null)
  const [marcandoPronta, setMarcandoPronta] = useState(false)

  // N3 — modal de entrega
  const [modalEntrega, setModalEntrega] = useState(false)

  // O1 — aditivos
  const [aditivos, setAditivos] = useState<AditivoApi[]>([])
  const [carregandoAditivos, setCarregandoAditivos] = useState(false)
  const [aditivoAbertoId, setAditivoAbertoId] = useState<string | null>(null)
  const [criandoAditivo, setCriandoAditivo] = useState(false)
  const [erroAditivo, setErroAditivo] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const detalhes = await obterOrdemServico(osId)
      setAtual(detalhes)
      setMecanicoId(detalhes.mecanicoId)
      setPrevisao(detalhes.previsaoEntrega ? detalhes.previsaoEntrega.slice(0, 10) : '')
      setErroGeral(null)
    } catch (e) {
      setErroGeral(e instanceof ApiClientError ? e.message : 'Erro ao carregar OS.')
    } finally {
      setCarregando(false)
    }
  }, [osId])

  const carregarAditivos = useCallback(async () => {
    if (!atual) return
    setCarregandoAditivos(true)
    try {
      const lista = await listarAditivos({ orcamentoId: atual.orcamentoId })
      setAditivos(lista)
    } catch {
      setAditivos([])
    } finally {
      setCarregandoAditivos(false)
    }
  }, [atual])

  useEffect(() => { void carregar() }, [carregar])

  useEffect(() => {
    if (atual) void carregarAditivos()
  }, [atual, carregarAditivos])

  if (!atual && carregando) {
    return (
      <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="t-det-os">
        <div className="modal-box" style={{ maxWidth: 700 }}>
          <div className="modal-head">
            <h2 id="t-det-os">Ordem de serviço</h2>
            <button className="btn-fechar" onClick={onFechar} aria-label="Fechar">×</button>
          </div>
          <div className="modal-corpo"><div className="carregando">Carregando…</div></div>
        </div>
      </div>
    )
  }

  if (!atual) {
    return (
      <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="t-det-os">
        <div className="modal-box" style={{ maxWidth: 700 }}>
          <div className="modal-head">
            <h2 id="t-det-os">Ordem de serviço</h2>
            <button className="btn-fechar" onClick={onFechar} aria-label="Fechar">×</button>
          </div>
          <div className="modal-corpo">
            <div className="aviso vermelho" role="alert">{erroGeral ?? 'OS não encontrada.'}</div>
          </div>
        </div>
      </div>
    )
  }

  const proximos = (TRANSICOES_OS[atual.status as StatusOS] ?? []).filter(
    (s) => s !== 'ENTREGUE',
  )
  // ENTREGUE é tratado separadamente via ModalEntrega (N3)
  const podeEntregar = atual.status === 'PRONTA'

  async function aplicar(dados: { status?: StatusOS; mecanicoId?: string; previsaoEntrega?: string }) {
    if (!atual) return
    setSalvando(true)
    setErro(null)
    try {
      const atualizada = await atualizarOrdemServico(atual.id, { ...dados, version: atual.version })
      const novoDetalhe = { ...atual, ...atualizada }
      setAtual(novoDetalhe as OrdemServicoDetalheApi)
      setMecanicoId(atualizada.mecanicoId)
      onAtualizada(atualizada)
    } catch (e) {
      setErro(e instanceof ApiClientError ? e.message : 'Não foi possível atualizar a OS.')
    } finally {
      setSalvando(false)
    }
  }

  async function handleMarcarPronta() {
    if (!atual) return
    setMarcandoPronta(true)
    setErro(null)
    try {
      const resultado = await marcarOSPronta(atual.id, atual.version)
      setResultadoBaixa(resultado)
      const novoDetalhe = { ...atual, ...resultado.os }
      setAtual(novoDetalhe as OrdemServicoDetalheApi)
      onAtualizada(resultado.os)
    } catch (e) {
      if (e instanceof ApiClientError && e.code === 'CONFLITO') {
        setErro('OS foi alterada por outra pessoa. Feche e reabra o painel.')
      } else {
        setErro(e instanceof ApiClientError ? e.message : 'Não foi possível marcar a OS como pronta.')
      }
    } finally {
      setMarcandoPronta(false)
    }
  }

  function handlePendenciaResolvida(pendencia: PendenciaBaixaApi) {
    setResultadoBaixa((prev) =>
      prev
        ? { ...prev, pendencias: prev.pendencias.filter((p) => p.itemId !== pendencia.itemId) }
        : prev,
    )
  }

  async function handleCriarAditivo() {
    if (!atual) return
    setCriandoAditivo(true)
    setErroAditivo(null)
    try {
      const novoAditivo = await criarAditivo({ orcamentoId: atual.orcamentoId })
      setAditivos((prev) => [novoAditivo, ...prev])
      setAditivoAbertoId(novoAditivo.id)
    } catch (e) {
      setErroAditivo(e instanceof ApiClientError ? e.message : 'Não foi possível criar o aditivo.')
    } finally {
      setCriandoAditivo(false)
    }
  }

  function handleEntregue(osAtualizada: OrdemServicoApi) {
    const novoDetalhe = { ...atual, ...osAtualizada }
    setAtual(novoDetalhe as OrdemServicoDetalheApi)
    onAtualizada(osAtualizada)
  }

  const chassiVeiculo = (atual as OrdemServicoDetalheApi & { veiculo?: { chassi?: string | null } }).veiculo?.chassi ?? null

  return (
    <>
      {modalEntrega && (
        <ModalEntrega os={atual} onFechar={() => setModalEntrega(false)} onEntregue={handleEntregue} />
      )}
      {aditivoAbertoId && (
        <PainelAditivo
          aditivoId={aditivoAbertoId}
          chassiVeiculo={chassiVeiculo}
          onFechar={() => setAditivoAbertoId(null)}
          onMudou={() => { void carregarAditivos() }}
        />
      )}

      <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="t-det-os">
        <div className="modal-box" style={{ maxWidth: 700 }}>
          <div className="modal-head">
            <h2 id="t-det-os">{atual.numero}</h2>
            <button className="btn-fechar" onClick={onFechar} aria-label="Fechar">×</button>
          </div>

          <div className="modal-corpo">
            {erro && <div className="aviso vermelho" role="alert">{erro}</div>}
            {erroGeral && <div className="aviso vermelho" role="alert">{erroGeral}</div>}

            {/* Dados básicos */}
            <div className="def-grid" style={{ marginBottom: 14 }}>
              <div className="item">
                <div className="rotulo">Status</div>
                <div className="valor"><BadgeOS status={atual.status as StatusOS} /></div>
              </div>
              <div className="item">
                <div className="rotulo">Cliente</div>
                <div className="valor">{atual.cliente?.nome ?? '—'}</div>
              </div>
              <div className="item">
                <div className="rotulo">Veículo</div>
                <div className="valor">
                  {[atual.veiculo?.marca, atual.veiculo?.modelo].filter(Boolean).join(' ')}
                  {atual.veiculo?.placa ? ` · ${atual.veiculo.placa}` : ''}
                </div>
              </div>
              <div className="item">
                <div className="rotulo">Orçamento</div>
                <div className="valor mono">{atual.orcamento?.numero ?? '—'}</div>
              </div>
              <div className="item">
                <div className="rotulo">Abertura</div>
                <div className="valor">{formatarData(atual.aberturaEm)}</div>
              </div>
              <div className="item">
                <div className="rotulo">Entregue em</div>
                <div className="valor">{formatarData(atual.entregueEm)}</div>
              </div>
            </div>

            {/* Avanço de status */}
            {atual.status !== 'ENTREGUE' && (
              <div className="campo-form" style={{ marginBottom: 12 }}>
                <label>Avançar status</label>
                <div className="flex" style={{ flexWrap: 'wrap', gap: 8 }}>
                  {proximos.map((s) => {
                    const estaVindoParaPronta = s === 'PRONTA'
                    return (
                      <button
                        key={s}
                        className="btn secundario"
                        disabled={salvando || marcandoPronta}
                        onClick={() => estaVindoParaPronta ? handleMarcarPronta() : aplicar({ status: s })}
                        aria-label={`Avançar para ${ROTULO_STATUS_OS[s]}`}
                      >
                        {marcandoPronta && estaVindoParaPronta ? 'Processando…' : ROTULO_STATUS_OS[s]}
                      </button>
                    )
                  })}
                  {/* N3 — botão de entrega */}
                  {podeEntregar && (
                    <button
                      className="btn"
                      disabled={salvando || marcandoPronta}
                      onClick={() => setModalEntrega(true)}
                      aria-label="Registrar entrega do veículo"
                    >
                      Registrar entrega
                    </button>
                  )}
                </div>
              </div>
            )}
            {atual.status === 'ENTREGUE' && (
              <p className="txt-suave" style={{ marginBottom: 12 }}>
                OS entregue — sem próximas etapas.
              </p>
            )}

            {/* N1 — resultado da baixa de estoque */}
            {resultadoBaixa && (
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: 15, marginBottom: 8 }}>Baixa de estoque</h3>
                {resultadoBaixa.baixados.length > 0 && (
                  <div className="aviso azul" style={{ marginBottom: 8 }}>
                    <div style={{ marginBottom: 6 }}>
                      <IconeOk sx={{ fontSize: 16, verticalAlign: '-2px' }} />{' '}
                      <strong>Baixado com sucesso:</strong>
                    </div>
                    <table style={{ width: '100%' }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left' }}>Peça</th>
                          <th style={{ textAlign: 'right' }}>Qtd</th>
                          <th style={{ textAlign: 'right' }}>Saldo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resultadoBaixa.baixados.map((b) => (
                          <tr key={b.itemId}>
                            <td>{b.pecaNome}</td>
                            <td style={{ textAlign: 'right' }}>
                              {b.quantidade} {b.unidade}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {b.saldoResultante} {b.unidade}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {resultadoBaixa.pendencias.map((p) => (
                  <BlocoPendencia
                    key={p.itemId}
                    osId={atual.id}
                    pendencia={p}
                    onResolvida={handlePendenciaResolvida}
                  />
                ))}
                {resultadoBaixa.pendencias.length === 0 && resultadoBaixa.baixados.length > 0 && (
                  <div className="aviso azul">
                    <IconeOk sx={{ fontSize: 16, verticalAlign: '-2px' }} />{' '}
                    Todas as peças foram baixadas do estoque.
                  </div>
                )}
              </div>
            )}

            {/* Troca de mecânico e previsão */}
            {atual.status !== 'ENTREGUE' && (
              <div className="form-grid" style={{ marginBottom: 12 }}>
                <div className="campo-form">
                  <label htmlFor="os-det-mec">Mecânico responsável</label>
                  <select
                    id="os-det-mec"
                    className="input"
                    value={mecanicoId}
                    onChange={(e) => setMecanicoId(e.target.value)}
                    disabled={salvando}
                  >
                    {mecanicos.map((m) => (
                      <option key={m.id} value={m.id}>{m.nome}</option>
                    ))}
                    {!mecanicos.some((m) => m.id === atual.mecanicoId) && atual.mecanico && (
                      <option value={atual.mecanicoId}>{atual.mecanico.nome}</option>
                    )}
                  </select>
                </div>
                <div className="campo-form">
                  <label htmlFor="os-det-prev">Previsão de entrega</label>
                  <input
                    id="os-det-prev"
                    type="date"
                    className="input"
                    value={previsao}
                    onChange={(e) => setPrevisao(e.target.value)}
                    disabled={salvando}
                  />
                </div>
              </div>
            )}

            {/* O1 — Seção de aditivos */}
            <div style={{ marginTop: 16 }}>
              <div
                className="flex"
                style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}
              >
                <h3 style={{ fontSize: 15 }}>Aditivos</h3>
                {atual.status !== 'ENTREGUE' && (
                  <button
                    className="btn secundario"
                    style={{ fontSize: 13 }}
                    disabled={criandoAditivo}
                    onClick={handleCriarAditivo}
                    aria-label="Criar novo aditivo"
                  >
                    <IconeAdicionar sx={{ fontSize: 15 }} /> Novo aditivo
                  </button>
                )}
              </div>
              {erroAditivo && (
                <div className="aviso vermelho" role="alert" style={{ marginBottom: 8 }}>
                  {erroAditivo}
                </div>
              )}
              {carregandoAditivos ? (
                <div className="carregando" style={{ padding: '8px 0' }}>Carregando aditivos…</div>
              ) : aditivos.length === 0 ? (
                <p className="txt-suave">Nenhum aditivo nesta OS.</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Aditivo</th>
                      <th>Status</th>
                      <th className="direita">Itens</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {aditivos.map((adi) => (
                      <tr key={adi.id}>
                        <td className="mono forte">Aditivo #{adi.numero}</td>
                        <td>
                          <span className="badge cinza">
                            {ROTULO_STATUS_ADITIVO[adi.status as StatusAditivo]}
                          </span>
                        </td>
                        <td className="direita">{adi.itens.length}</td>
                        <td>
                          <button
                            className="btn secundario"
                            style={{ padding: '4px 10px', fontSize: 13 }}
                            onClick={() => setAditivoAbertoId(adi.id)}
                            aria-label={`Abrir Aditivo #${adi.numero}`}
                          >
                            Abrir
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Garantias vigentes (se houver) */}
            {atual.garantias.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <h3 style={{ fontSize: 15, marginBottom: 8 }}>
                  <IconeGarantia sx={{ fontSize: 16, verticalAlign: '-2px' }} /> Garantias
                </h3>
                <table>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Válida até</th>
                      <th>Vigente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {atual.garantias.map((g) => (
                      <tr key={g.id}>
                        <td>{g.descricao}</td>
                        <td>{formatarData(g.validaAte)}</td>
                        <td>
                          {g.vigente ? (
                            <span className="badge verde">Vigente</span>
                          ) : (
                            <span className="badge cinza">Expirada</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Rodapé */}
          <div className="modal-rodape">
            <button className="btn secundario" onClick={onFechar} disabled={salvando}>
              Fechar
            </button>
            {atual.status !== 'ENTREGUE' && (
              <button
                className="btn"
                disabled={
                  salvando ||
                  (mecanicoId === atual.mecanicoId &&
                    previsao === (atual.previsaoEntrega?.slice(0, 10) ?? ''))
                }
                onClick={() =>
                  aplicar({
                    mecanicoId: mecanicoId !== atual.mecanicoId ? mecanicoId : undefined,
                    previsaoEntrega:
                      previsao !== (atual.previsaoEntrega?.slice(0, 10) ?? '')
                        ? previsao
                        : undefined,
                  })
                }
              >
                {salvando ? 'Salvando…' : 'Salvar alterações'}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// =======================================================================
// Leitura do query param ?os=<id> (extraída para Suspense boundary)
// =======================================================================

function LeitorQueryParam({ onId }: { onId: (id: string | null) => void }) {
  const params = useSearchParams()
  const osParam = params.get('os')

  useEffect(() => {
    onId(osParam)
  }, [osParam, onId])

  return null
}

// =======================================================================
// Página principal
// =======================================================================

export default function PaginaOrdensServico() {
  const [filtro, setFiltro] = useState('todas')
  const [busca, setBusca] = useState('')
  const [ordens, setOrdens] = useState<OrdemServicoApi[]>([])
  const [mecanicos, setMecanicos] = useState<MecanicoApi[]>([])
  const [orcamentosDisponiveis, setOrcamentosDisponiveis] = useState<OrcamentoApi[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [modalNova, setModalNova] = useState(false)
  const [detalheId, setDetalheId] = useState<string | null>(null)

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const buscar = useCallback(async (q: string, f: string) => {
    setCarregando(true)
    setErro(null)
    try {
      setOrdens(
        await listarOrdensServico({
          q: q.trim() || undefined,
          status: f === 'todas' ? undefined : f,
        }),
      )
    } catch (e) {
      setErro(e instanceof ApiClientError ? e.message : 'Erro ao carregar ordens de serviço.')
    } finally {
      setCarregando(false)
    }
  }, [])

  const carregarDisponiveis = useCallback(async () => {
    try {
      const [autorizados, todasOS] = await Promise.all([
        listarOrcamentos({ status: 'AUTORIZADO' }),
        listarOrdensServico({}),
      ])
      const comOS = new Set(todasOS.map((o) => o.orcamentoId))
      setOrcamentosDisponiveis(autorizados.filter((o) => !comOS.has(o.id)))
    } catch {
      setOrcamentosDisponiveis([])
    }
  }, [])

  useEffect(() => {
    void listarMecanicos().then(setMecanicos).catch(() => {})
  }, [])

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void buscar(busca, filtro), 400)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [busca, filtro, buscar])

  function abrirNova() {
    void carregarDisponiveis()
    setModalNova(true)
  }

  function handleCriada(os: OrdemServicoApi) {
    setModalNova(false)
    setOrdens((prev) => [os, ...prev])
    setDetalheId(os.id)
  }

  function handleAtualizada(os: OrdemServicoApi) {
    setOrdens((prev) => prev.map((x) => (x.id === os.id ? os : x)))
  }

  return (
    <>
      {/* Lê ?os=<id> e pré-abre o detalhe */}
      <Suspense fallback={null}>
        <LeitorQueryParam
          onId={(id) => {
            if (id && !detalheId) setDetalheId(id)
          }}
        />
      </Suspense>

      {modalNova && (
        <ModalNovaOS
          orcamentosDisponiveis={orcamentosDisponiveis}
          mecanicos={mecanicos}
          onFechar={() => setModalNova(false)}
          onCriada={handleCriada}
        />
      )}
      {detalheId && (
        <PainelOS
          osId={detalheId}
          mecanicos={mecanicos}
          onFechar={() => setDetalheId(null)}
          onAtualizada={handleAtualizada}
        />
      )}

      <div className="acoes-topo">
        <div className="campo-busca">
          <IconeBusca className="lupa" sx={{ fontSize: 20 }} />
          <input
            placeholder="Buscar OS, cliente, veículo ou mecânico…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            aria-label="Buscar ordem de serviço"
          />
        </div>
        <button className="btn" onClick={abrirNova}>
          <IconeAdicionar sx={{ fontSize: 18 }} /> Nova OS
        </button>
      </div>

      <div className="flex" style={{ flexWrap: 'wrap', marginBottom: 18 }}>
        {FILTROS.map((f) => (
          <button
            key={f.valor}
            className={`btn ${filtro === f.valor ? '' : 'secundario'}`}
            onClick={() => setFiltro(f.valor)}
          >
            {f.texto}
          </button>
        ))}
      </div>

      <div className="card">
        {carregando ? (
          <div className="carregando">Carregando ordens de serviço…</div>
        ) : erro ? (
          <div className="aviso vermelho" style={{ margin: 16 }}>{erro}</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>OS</th>
                <th>Cliente</th>
                <th>Veículo</th>
                <th>Mecânico</th>
                <th>Abertura</th>
                <th>Previsão</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ordens.map((os) => (
                <tr
                  key={os.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setDetalheId(os.id)}
                >
                  <td className="mono forte">{os.numero}</td>
                  <td>{os.cliente?.nome ?? 'Sem cliente'}</td>
                  <td>
                    {[os.veiculo?.marca, os.veiculo?.modelo].filter(Boolean).join(' ')}{' '}
                    {os.veiculo?.placa && <span className="mono">· {os.veiculo.placa}</span>}
                  </td>
                  <td>{os.mecanico?.nome ?? 'A definir'}</td>
                  <td>{formatarData(os.aberturaEm)}</td>
                  <td>{formatarData(os.previsaoEntrega)}</td>
                  <td><BadgeOS status={os.status as StatusOS} /></td>
                  <td>
                    <button
                      className="btn secundario"
                      style={{ padding: '6px 10px', fontSize: 13 }}
                      onClick={(e) => { e.stopPropagation(); setDetalheId(os.id) }}
                      aria-label={`Abrir OS ${os.numero}`}
                    >
                      Abrir
                    </button>
                  </td>
                </tr>
              ))}
              {ordens.length === 0 && (
                <tr>
                  <td colSpan={8} className="vazio">
                    Nenhuma ordem de serviço encontrada.
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
