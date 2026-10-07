'use client'
// Ordens de serviço — ligadas à API real.
// G4/I2: OS nasce de um orçamento AUTORIZADO (1 por orçamento), com mecânico
// obrigatório; lista por status, detalhe, troca de status (transições válidas)
// e troca de mecânico. Controle otimista por version.

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  listarOrdensServico,
  listarOrcamentos,
  listarMecanicos,
  criarOrdemServico,
  atualizarOrdemServico,
  type OrdemServicoApi,
  type OrcamentoApi,
  type MecanicoApi,
  ApiClientError,
} from '@/lib/api'
import { BadgeOS } from '@/components/Badges'
import {
  ROTULO_STATUS_OS,
  TRANSICOES_OS,
  type StatusOS,
} from '@/lib/constants'
import { IconeBusca, IconeAdicionar } from '@/components/icons'

function formatarData(iso: string | null): string {
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
// Modal: Nova OS (a partir de orçamento AUTORIZADO sem OS)
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

  async function handleSalvar() {
    if (!orcamentoId) return setErro('Selecione o orçamento autorizado.')
    if (!mecanicoId) return setErro('Selecione o mecânico responsável.')
    setSalvando(true)
    setErro(null)
    try {
      const criada = await criarOrdemServico({
        orcamentoId,
        mecanicoId,
        previsaoEntrega: previsao || undefined,
      })
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
              <select id="os-orc" className="input" value={orcamentoId} onChange={(e) => setOrcamentoId(e.target.value)} disabled={salvando}>
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
// Modal: Detalhe / acompanhamento da OS
// =======================================================================

function PainelOS({
  os,
  mecanicos,
  onFechar,
  onAtualizada,
}: {
  os: OrdemServicoApi
  mecanicos: MecanicoApi[]
  onFechar: () => void
  onAtualizada: (os: OrdemServicoApi) => void
}) {
  const [atual, setAtual] = useState(os)
  const [mecanicoId, setMecanicoId] = useState(os.mecanicoId)
  const [previsao, setPrevisao] = useState(os.previsaoEntrega ? os.previsaoEntrega.slice(0, 10) : '')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const proximos = TRANSICOES_OS[atual.status as StatusOS] ?? []

  async function aplicar(dados: { status?: StatusOS; mecanicoId?: string; previsaoEntrega?: string }) {
    setSalvando(true)
    setErro(null)
    try {
      const atualizada = await atualizarOrdemServico(atual.id, { ...dados, version: atual.version })
      setAtual(atualizada)
      setMecanicoId(atualizada.mecanicoId)
      onAtualizada(atualizada)
    } catch (e) {
      setErro(e instanceof ApiClientError ? e.message : 'Não foi possível atualizar a OS.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="t-det-os">
      <div className="modal-box" style={{ maxWidth: 560 }}>
        <div className="modal-head">
          <h2 id="t-det-os">{atual.numero}</h2>
          <button className="btn-fechar" onClick={onFechar} aria-label="Fechar">×</button>
        </div>
        <div className="modal-corpo">
          {erro && <div className="aviso vermelho" role="alert">{erro}</div>}

          <div className="def-grid" style={{ marginBottom: 14 }}>
            <div className="item">
              <div className="rotulo">Status</div>
              <div className="valor"><BadgeOS status={atual.status} /></div>
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

          {/* Troca de status */}
          <div className="campo-form" style={{ marginBottom: 12 }}>
            <label>Avançar status</label>
            {proximos.length === 0 ? (
              <p className="txt-suave">OS entregue — sem próximas etapas.</p>
            ) : (
              <div className="flex" style={{ flexWrap: 'wrap' }}>
                {proximos.map((s) => (
                  <button key={s} className="btn secundario" disabled={salvando} onClick={() => aplicar({ status: s })}>
                    {ROTULO_STATUS_OS[s]}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Troca de mecânico + previsão */}
          <div className="form-grid">
            <div className="campo-form">
              <label htmlFor="os-det-mec">Mecânico responsável</label>
              <select id="os-det-mec" className="input" value={mecanicoId} onChange={(e) => setMecanicoId(e.target.value)} disabled={salvando}>
                {mecanicos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                {!mecanicos.some((m) => m.id === atual.mecanicoId) && atual.mecanico && (
                  <option value={atual.mecanicoId}>{atual.mecanico.nome}</option>
                )}
              </select>
            </div>
            <div className="campo-form">
              <label htmlFor="os-det-prev">Previsão de entrega</label>
              <input id="os-det-prev" type="date" className="input" value={previsao} onChange={(e) => setPrevisao(e.target.value)} disabled={salvando} />
            </div>
          </div>
        </div>
        <div className="modal-rodape">
          <button className="btn secundario" onClick={onFechar} disabled={salvando}>Fechar</button>
          <button
            className="btn"
            disabled={salvando || (mecanicoId === atual.mecanicoId && previsao === (atual.previsaoEntrega?.slice(0, 10) ?? ''))}
            onClick={() => aplicar({
              mecanicoId: mecanicoId !== atual.mecanicoId ? mecanicoId : undefined,
              previsaoEntrega: previsao !== (atual.previsaoEntrega?.slice(0, 10) ?? '') ? previsao : undefined,
            })}
          >
            {salvando ? 'Salvando…' : 'Salvar alterações'}
          </button>
        </div>
      </div>
    </div>
  )
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
  const [detalhe, setDetalhe] = useState<OrdemServicoApi | null>(null)

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const buscar = useCallback(async (q: string, f: string) => {
    setCarregando(true)
    setErro(null)
    try {
      setOrdens(await listarOrdensServico({ q: q.trim() || undefined, status: f === 'todas' ? undefined : f }))
    } catch (e) {
      setErro(e instanceof ApiClientError ? e.message : 'Erro ao carregar ordens de serviço.')
    } finally {
      setCarregando(false)
    }
  }, [])

  // Orçamentos AUTORIZADOS que ainda não têm OS (para o modal de criação).
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
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [busca, filtro, buscar])

  function abrirNova() {
    void carregarDisponiveis()
    setModalNova(true)
  }

  function handleCriada(os: OrdemServicoApi) {
    setModalNova(false)
    setOrdens((prev) => [os, ...prev])
  }

  function handleAtualizada(os: OrdemServicoApi) {
    setOrdens((prev) => prev.map((x) => (x.id === os.id ? os : x)))
    setDetalhe(os)
  }

  return (
    <>
      {modalNova && (
        <ModalNovaOS orcamentosDisponiveis={orcamentosDisponiveis} mecanicos={mecanicos} onFechar={() => setModalNova(false)} onCriada={handleCriada} />
      )}
      {detalhe && (
        <PainelOS os={detalhe} mecanicos={mecanicos} onFechar={() => setDetalhe(null)} onAtualizada={handleAtualizada} />
      )}

      <div className="acoes-topo">
        <div className="campo-busca">
          <IconeBusca className="lupa" sx={{ fontSize: 20 }} />
          <input placeholder="Buscar OS, cliente, veículo ou mecânico…" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar ordem de serviço" />
        </div>
        <button className="btn" onClick={abrirNova}>
          <IconeAdicionar sx={{ fontSize: 18 }} /> Nova OS
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
                <tr key={os.id} style={{ cursor: 'pointer' }} onClick={() => setDetalhe(os)}>
                  <td className="mono forte">{os.numero}</td>
                  <td>{os.cliente?.nome ?? 'Sem cliente'}</td>
                  <td>
                    {[os.veiculo?.marca, os.veiculo?.modelo].filter(Boolean).join(' ')}{' '}
                    {os.veiculo?.placa && <span className="mono">· {os.veiculo.placa}</span>}
                  </td>
                  <td>{os.mecanico?.nome ?? 'A definir'}</td>
                  <td>{formatarData(os.aberturaEm)}</td>
                  <td>{formatarData(os.previsaoEntrega)}</td>
                  <td><BadgeOS status={os.status} /></td>
                  <td>
                    <button className="btn secundario" style={{ padding: '6px 10px', fontSize: 13 }} onClick={(e) => { e.stopPropagation(); setDetalhe(os) }} aria-label={`Abrir ${os.numero}`}>
                      Abrir
                    </button>
                  </td>
                </tr>
              ))}
              {ordens.length === 0 && (
                <tr><td colSpan={8} className="vazio">Nenhuma ordem de serviço encontrada.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
