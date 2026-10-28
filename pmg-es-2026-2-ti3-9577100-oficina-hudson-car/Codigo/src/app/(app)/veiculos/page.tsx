'use client'
// Veículos com detalhe por veículo e fotos de entrada/saída
// (evita disputa de arranhão após a lavagem). Integrado à API real.
// N2: abas "Dados" / "Histórico & Garantias" no PainelDetalhe.

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  listarVeiculos,
  listarClientes,
  criarVeiculo,
  atualizarVeiculo,
  obterVeiculo,
  obterHistoricoVeiculo,
  type VeiculoApi,
  type VeiculoDetalheApi,
  type ClienteApi,
  type HistoricoVeiculoApi,
  type GarantiaApi,
  ApiClientError,
} from '@/lib/api'
import {
  IconeBusca,
  IconeAdicionar,
  IconeFoto,
  IconeVeiculo,
  IconeEditar,
  IconeGarantia,
} from '@/components/icons'
import { BadgeOrcamento, BadgeOS } from '@/components/Badges'
import { moeda } from '@/utils/format'
import type { StatusOrcamento, StatusOS } from '@/lib/constants'

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

function formatarData(iso: string | null | undefined): string {
  if (!iso) return 'A definir'
  return new Date(iso).toLocaleDateString('pt-BR')
}

// -----------------------------------------------------------------------
// Modal: Criar / Editar veículo
// -----------------------------------------------------------------------

interface ModalVeiculoProps {
  veiculo?: VeiculoApi
  clientes: ClienteApi[]
  onFechar: () => void
  onSalvo: (v: VeiculoApi) => void
}

function ModalVeiculo({ veiculo, clientes, onFechar, onSalvo }: ModalVeiculoProps) {
  const edicao = !!veiculo

  const [clienteId, setClienteId] = useState(veiculo?.clienteId ?? '')
  const [placa, setPlaca] = useState(veiculo?.placa ?? '')
  const [chassi, setChassi] = useState(veiculo?.chassi ?? '')
  const [marca, setMarca] = useState(veiculo?.marca ?? '')
  const [modelo, setModelo] = useState(veiculo?.modelo ?? '')
  const [ano, setAno] = useState(veiculo?.ano?.toString() ?? '')
  const [cor, setCor] = useState(veiculo?.cor ?? '')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const primeiroInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    primeiroInputRef.current?.focus()
  }, [])

  async function handleSalvar() {
    if (!edicao && !clienteId) {
      setErro('Selecione o cliente dono do veículo.')
      return
    }
    if (!placa.trim() && !chassi.trim()) {
      setErro('Informe ao menos a placa ou o chassi.')
      return
    }
    const anoNum = ano.trim() ? parseInt(ano, 10) : undefined
    if (anoNum !== undefined && (isNaN(anoNum) || anoNum < 1900 || anoNum > 2100)) {
      setErro('Ano inválido.')
      return
    }

    setSalvando(true)
    setErro(null)

    try {
      const campos = {
        placa: placa.trim() || undefined,
        chassi: chassi.trim() || undefined,
        marca: marca.trim() || undefined,
        modelo: modelo.trim() || undefined,
        ano: anoNum,
        cor: cor.trim() || undefined,
      }

      let salvo: VeiculoApi
      if (edicao && veiculo) {
        salvo = await atualizarVeiculo(veiculo.id, { ...campos, version: veiculo.version })
      } else {
        salvo = await criarVeiculo({ clienteId, ...campos })
      }

      onSalvo(salvo)
    } catch (e) {
      if (e instanceof ApiClientError && e.code === 'CONFLITO') {
        setErro('Registro desatualizado. Recarregue a página e tente novamente.')
      } else {
        const msg = e instanceof ApiClientError ? e.message : 'Não foi possível salvar o veículo.'
        setErro(msg)
      }
    } finally {
      setSalvando(false)
    }
  }

  const titulo = edicao ? 'Editar veículo' : 'Novo veículo'
  const labelId = edicao ? 'titulo-editar-veiculo' : 'titulo-novo-veiculo'

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby={labelId}>
      <div className="modal-box" style={{ maxWidth: 560 }}>
        <div className="modal-head">
          <h2 id={labelId}>{titulo}</h2>
          <button className="btn-fechar" onClick={onFechar} aria-label="Fechar">×</button>
        </div>
        <div className="modal-corpo">
          {erro && <div className="aviso vermelho" role="alert">{erro}</div>}

          {!edicao && (
            <>
              {clientes.length === 0 && (
                <div className="aviso amarelo">
                  Cadastre um cliente antes de adicionar um veículo.
                </div>
              )}
              <div className="form-grid" style={{ marginBottom: 0 }}>
                <div className="campo-form" style={{ gridColumn: '1 / -1' }}>
                  <label htmlFor="nv-cliente">Cliente *</label>
                  <select
                    id="nv-cliente"
                    className="input"
                    value={clienteId}
                    onChange={(e) => setClienteId(e.target.value)}
                    disabled={salvando}
                  >
                    <option value="">Selecione…</option>
                    {clientes.map((c) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          <div className="form-grid">
            <div className="campo-form">
              <label htmlFor="nv-placa">Placa</label>
              <input
                ref={primeiroInputRef}
                id="nv-placa"
                className="input"
                value={placa}
                onChange={(e) => setPlaca(e.target.value)}
                disabled={salvando}
              />
            </div>
            <div className="campo-form">
              <label htmlFor="nv-chassi">Chassi</label>
              <input
                id="nv-chassi"
                className="input"
                value={chassi}
                onChange={(e) => setChassi(e.target.value)}
                disabled={salvando}
              />
            </div>
            <div className="campo-form">
              <label htmlFor="nv-marca">Marca</label>
              <input
                id="nv-marca"
                className="input"
                value={marca}
                onChange={(e) => setMarca(e.target.value)}
                disabled={salvando}
              />
            </div>
            <div className="campo-form">
              <label htmlFor="nv-modelo">Modelo</label>
              <input
                id="nv-modelo"
                className="input"
                value={modelo}
                onChange={(e) => setModelo(e.target.value)}
                disabled={salvando}
              />
            </div>
            <div className="campo-form">
              <label htmlFor="nv-ano">Ano</label>
              <input
                id="nv-ano"
                type="number"
                min="1900"
                max="2100"
                className="input"
                value={ano}
                onChange={(e) => setAno(e.target.value)}
                disabled={salvando}
              />
            </div>
            <div className="campo-form">
              <label htmlFor="nv-cor">Cor</label>
              <input
                id="nv-cor"
                className="input"
                value={cor}
                onChange={(e) => setCor(e.target.value)}
                disabled={salvando}
              />
            </div>
          </div>
        </div>
        <div className="modal-rodape">
          <button className="btn secundario" onClick={onFechar} disabled={salvando}>Cancelar</button>
          <button
            className="btn"
            onClick={handleSalvar}
            disabled={salvando || (!edicao && clientes.length === 0)}
          >
            {salvando ? 'Salvando…' : edicao ? 'Salvar alterações' : 'Criar veículo'}
          </button>
        </div>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------
// N2 — Aba Histórico & Garantias
// -----------------------------------------------------------------------

function AbaHistorico({ veiculoId }: { veiculoId: string }) {
  const [historico, setHistorico] = useState<HistoricoVeiculoApi | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    setCarregando(true)
    setErro(null)
    obterHistoricoVeiculo(veiculoId)
      .then(setHistorico)
      .catch((e) => {
        const msg = e instanceof ApiClientError ? e.message : 'Erro ao carregar histórico.'
        setErro(msg)
      })
      .finally(() => setCarregando(false))
  }, [veiculoId])

  if (carregando) {
    return <div className="carregando">Carregando histórico…</div>
  }
  if (erro) {
    return <div className="aviso vermelho" role="alert">{erro}</div>
  }
  if (!historico) return null

  const { garantiasVigentes, ordensEntregues } = historico

  return (
    <div>
      {/* Garantias vigentes */}
      <div className="card" style={{ margin: '0 0 16px' }}>
        <div className="card-head">
          <div>
            <h2>
              <IconeGarantia sx={{ fontSize: 18, verticalAlign: '-3px' }} /> Garantias vigentes
            </h2>
            <p>{garantiasVigentes.length} garantia{garantiasVigentes.length !== 1 ? 's' : ''} ativa{garantiasVigentes.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        {garantiasVigentes.length === 0 ? (
          <div className="card-body">
            <p className="txt-suave">Nenhuma garantia vigente para este veículo.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Válida até</th>
              </tr>
            </thead>
            <tbody>
              {garantiasVigentes.map((g: GarantiaApi) => (
                <tr key={g.id}>
                  <td>{g.descricao}</td>
                  <td>
                    <span
                      className="badge verde"
                      aria-label={`Garantia até ${formatarData(g.validaAte)}`}
                    >
                      <IconeGarantia sx={{ fontSize: 13, verticalAlign: '-2px' }} />{' '}
                      Garantia até {formatarData(g.validaAte)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* OS entregues */}
      <div className="card" style={{ margin: 0 }}>
        <div className="card-head">
          <div>
            <h2>OS entregues</h2>
            <p>{ordensEntregues.length} OS{ordensEntregues.length !== 1 ? 's' : ''} finalizada{ordensEntregues.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        {ordensEntregues.length === 0 ? (
          <div className="card-body">
            <p className="txt-suave">Nenhuma OS entregue para este veículo.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Número</th>
                <th>Entregue em</th>
                <th>Mecânico</th>
                <th className="direita">Total</th>
                <th>Garantias</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ordensEntregues.map((os) => (
                <tr key={os.id}>
                  <td className="mono forte">{os.numero}</td>
                  <td>{formatarData(os.entregueEm)}</td>
                  <td>{os.mecanico?.nome ?? <span className="txt-suave">—</span>}</td>
                  <td className="direita forte">{moeda(os.totalServico)}</td>
                  <td>
                    {os.garantias.filter((g: GarantiaApi) => g.vigente).length > 0 ? (
                      <span className="badge verde">
                        {os.garantias.filter((g: GarantiaApi) => g.vigente).length} vigente{os.garantias.filter((g: GarantiaApi) => g.vigente).length !== 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span className="txt-suave">—</span>
                    )}
                  </td>
                  <td>
                    <Link
                      href={`/ordens-servico?os=${os.id}`}
                      className="btn secundario"
                      style={{ padding: '4px 10px', fontSize: 13 }}
                      aria-label={`Ver OS ${os.numero}`}
                    >
                      Ver OS
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------
// Painel de detalhe do veículo selecionado
// -----------------------------------------------------------------------

type AbaDetalhe = 'dados' | 'historico'

interface PainelDetalheProps {
  veiculo: VeiculoApi
  onEditar: () => void
}

function PainelDetalhe({ veiculo, onEditar }: PainelDetalheProps) {
  const [detalhe, setDetalhe] = useState<VeiculoDetalheApi | null>(null)
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false)
  const [erroDetalhe, setErroDetalhe] = useState<string | null>(null)
  const [aba, setAba] = useState<AbaDetalhe>('dados')

  useEffect(() => {
    setDetalhe(null)
    setErroDetalhe(null)
    setAba('dados')

    if (aba === 'dados') {
      setCarregandoDetalhe(true)
      obterVeiculo(veiculo.id)
        .then(setDetalhe)
        .catch((e) => {
          const msg = e instanceof ApiClientError ? e.message : 'Erro ao carregar histórico.'
          setErroDetalhe(msg)
        })
        .finally(() => setCarregandoDetalhe(false))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [veiculo.id])

  function trocarAba(novaAba: AbaDetalhe) {
    setAba(novaAba)
    // Carrega detalhe de orçamentos/OS ao entrar na aba Dados
    if (novaAba === 'dados' && !detalhe && !carregandoDetalhe) {
      setCarregandoDetalhe(true)
      obterVeiculo(veiculo.id)
        .then(setDetalhe)
        .catch((e) => {
          const msg = e instanceof ApiClientError ? e.message : 'Erro ao carregar histórico.'
          setErroDetalhe(msg)
        })
        .finally(() => setCarregandoDetalhe(false))
    }
  }

  return (
    <div>
      {/* Dados do veículo */}
      <div className="card">
        <div className="card-head">
          <div>
            <h2>
              {veiculo.marca ?? 'Veículo'} {veiculo.modelo ?? ''}
            </h2>
            <p>
              {veiculo.cliente?.nome ?? 'Sem cliente'}
              {veiculo.cliente?.telefone ? ` · ${veiculo.cliente.telefone}` : ''}
            </p>
          </div>
          <button
            className="btn secundario"
            style={{ padding: '6px 10px', fontSize: 13, alignSelf: 'flex-start' }}
            onClick={onEditar}
            aria-label={`Editar veículo ${veiculo.marca ?? ''} ${veiculo.modelo ?? ''}`}
          >
            <IconeEditar sx={{ fontSize: 15 }} /> Editar
          </button>
        </div>

        {/* N2 — Seletor de abas */}
        <div
          role="tablist"
          aria-label="Seções do veículo"
          className="flex"
          style={{ padding: '0 20px 0', borderBottom: '1px solid var(--cinza-borda)', gap: 4 }}
        >
          <button
            role="tab"
            className={`btn ${aba === 'dados' ? '' : 'secundario'}`}
            style={{ borderRadius: '8px 8px 0 0', fontSize: 13 }}
            onClick={() => trocarAba('dados')}
            aria-selected={aba === 'dados'}
          >
            Dados
          </button>
          <button
            role="tab"
            className={`btn ${aba === 'historico' ? '' : 'secundario'}`}
            style={{ borderRadius: '8px 8px 0 0', fontSize: 13 }}
            onClick={() => trocarAba('historico')}
            aria-selected={aba === 'historico'}
          >
            Histórico &amp; Garantias
          </button>
        </div>

        {aba === 'dados' && (
          <div className="card-body">
            <div className="def-grid">
              <div className="item">
                <div className="rotulo">Placa</div>
                <div className="valor mono">{veiculo.placa ?? 'Não informada'}</div>
              </div>
              <div className="item">
                <div className="rotulo">Chassi</div>
                <div className="valor mono">{veiculo.chassi ?? 'Não informado'}</div>
              </div>
              <div className="item">
                <div className="rotulo">Ano</div>
                <div className="valor">{veiculo.ano ?? 'Não informado'}</div>
              </div>
              <div className="item">
                <div className="rotulo">Cor</div>
                <div className="valor">{veiculo.cor ?? 'Não informada'}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Aba Histórico & Garantias */}
      {aba === 'historico' && (
        <div style={{ marginTop: 16 }}>
          <AbaHistorico veiculoId={veiculo.id} />
        </div>
      )}

      {aba === 'dados' && (
        <>
          {/* Fotos de entrada/saída */}
          <div className="card">
            <div className="card-head">
              <div>
                <h2>
                  <IconeFoto sx={{ fontSize: 18, verticalAlign: '-3px' }} /> Fotos de
                  entrada / saída
                </h2>
                <p>Registro do estado do veículo (evita disputas)</p>
              </div>
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {['Entrada · frente', 'Entrada · lateral', 'Saída · frente', 'Saída · lavado'].map(
                  (legenda) => (
                    <div key={legenda} style={{ width: 140, textAlign: 'center' }}>
                      <div
                        style={{
                          height: 96,
                          borderRadius: 8,
                          background:
                            'repeating-linear-gradient(45deg,#eef1f5,#eef1f5 8px,#e3e8ef 8px,#e3e8ef 16px)',
                          display: 'grid',
                          placeItems: 'center',
                          color: '#94a3b8',
                        }}
                      >
                        <IconeVeiculo sx={{ fontSize: 40 }} />
                      </div>
                      <span className="txt-suave" style={{ fontSize: 12 }}>
                        {legenda}
                      </span>
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>

          {/* Orçamentos e OS — dados reais */}
          {carregandoDetalhe && (
            <div className="card">
              <div className="carregando">Carregando histórico…</div>
            </div>
          )}

          {erroDetalhe && (
            <div className="aviso vermelho" style={{ margin: '0 0 16px' }} role="alert">
              {erroDetalhe}
            </div>
          )}

          {detalhe && (
            <>
              {/* Orçamentos */}
              <div className="card">
                <div className="card-head">
                  <div>
                    <h2>Orçamentos do veículo</h2>
                    <p>
                      {detalhe.orcamentos.length} orçamento
                      {detalhe.orcamentos.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                {detalhe.orcamentos.length === 0 ? (
                  <div className="card-body">
                    <p className="txt-suave">Nenhum orçamento para este veículo.</p>
                  </div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Número</th>
                        <th>Data</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalhe.orcamentos.map((orc) => {
                        const total = orc.itens.reduce(
                          (soma, item) => soma + item.quantidade * item.valorUnitario,
                          0,
                        )
                        return (
                          <tr key={orc.id}>
                            <td className="mono forte">{orc.numero}</td>
                            <td className="txt-suave">{formatarData(orc.createdAt)}</td>
                            <td>
                              <BadgeOrcamento status={orc.status as StatusOrcamento} />
                            </td>
                            <td style={{ textAlign: 'right' }} className="mono">
                              {moeda(total)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Ordens de serviço */}
              <div className="card">
                <div className="card-head">
                  <div>
                    <h2>Ordens de serviço</h2>
                    <p>
                      {detalhe.ordensServico.length} OS
                      {detalhe.ordensServico.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                {detalhe.ordensServico.length === 0 ? (
                  <div className="card-body">
                    <p className="txt-suave">Nenhuma OS para este veículo.</p>
                  </div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Número</th>
                        <th>Mecânico</th>
                        <th>Previsão</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalhe.ordensServico.map((os) => (
                        <tr key={os.id}>
                          <td className="mono forte">{os.numero}</td>
                          <td>
                            {os.mecanico?.nome ?? (
                              <span className="txt-suave">Não definido</span>
                            )}
                          </td>
                          <td className="txt-suave">{formatarData(os.previsaoEntrega)}</td>
                          <td>
                            <BadgeOS status={os.status as StatusOS} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

// -----------------------------------------------------------------------
// Página principal
// -----------------------------------------------------------------------

export default function PaginaVeiculos() {
  const [busca, setBusca] = useState('')
  const [veiculos, setVeiculos] = useState<VeiculoApi[]>([])
  const [clientes, setClientes] = useState<ClienteApi[]>([])
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<VeiculoApi | undefined>(undefined)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const buscarVeiculos = useCallback(async (q: string) => {
    setCarregando(true)
    setErro(null)
    try {
      const lista = await listarVeiculos({ q: q.trim() || undefined })
      setVeiculos(lista)
      setSelecionado((atual) => atual ?? lista[0]?.id ?? null)
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : 'Erro ao carregar veículos.'
      setErro(msg)
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void listarClientes().then(setClientes).catch(() => {})
  }, [])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      void buscarVeiculos(busca)
    }, 400)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [busca, buscarVeiculos])

  function handleSalvo(v: VeiculoApi) {
    setVeiculos((prev) => {
      const idx = prev.findIndex((x) => x.id === v.id)
      if (idx >= 0) {
        const nova = [...prev]
        nova[idx] = v
        return nova
      }
      return [v, ...prev]
    })
    setModalAberto(false)
    setEditando(undefined)
    setSelecionado(v.id)
  }

  function abrirCriacao() {
    setEditando(undefined)
    setModalAberto(true)
  }

  function abrirEdicao(v: VeiculoApi) {
    setEditando(v)
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
    setEditando(undefined)
  }

  const veiculo = veiculos.find((v) => v.id === selecionado) ?? null

  return (
    <>
      {modalAberto && (
        <ModalVeiculo
          veiculo={editando}
          clientes={clientes}
          onFechar={fecharModal}
          onSalvo={handleSalvo}
        />
      )}

      <div className="acoes-topo">
        <div className="campo-busca">
          <IconeBusca className="lupa" sx={{ fontSize: 20 }} />
          <input
            placeholder="Buscar por placa, chassi, modelo ou cliente…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            aria-label="Buscar veículo"
          />
        </div>
        <button className="btn" onClick={abrirCriacao}>
          <IconeAdicionar sx={{ fontSize: 18 }} /> Novo veículo
        </button>
      </div>

      {carregando ? (
        <div className="card"><div className="carregando">Carregando veículos…</div></div>
      ) : erro ? (
        <div className="aviso vermelho" style={{ margin: 16 }}>{erro}</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 22 }}>
          {/* Lista de veículos */}
          <div className="card" style={{ margin: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Veículo</th>
                  <th>Placa</th>
                  <th>Cliente</th>
                </tr>
              </thead>
              <tbody>
                {veiculos.map((v) => (
                  <tr
                    key={v.id}
                    onClick={() => setSelecionado(v.id)}
                    style={{
                      cursor: 'pointer',
                      background: v.id === selecionado ? '#fff5ec' : undefined,
                    }}
                  >
                    <td className="forte">
                      {v.marca ?? ''} {v.modelo ?? ''}
                      {(v.ano || v.cor) && (
                        <>
                          <br />
                          <span className="txt-suave">
                            {[v.ano, v.cor].filter(Boolean).join(' · ')}
                          </span>
                        </>
                      )}
                    </td>
                    <td className="mono">{v.placa ?? 'Sem placa'}</td>
                    <td>{v.cliente?.nome ?? 'Sem cliente'}</td>
                  </tr>
                ))}
                {veiculos.length === 0 && (
                  <tr>
                    <td colSpan={3} className="vazio">
                      Nenhum veículo encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Detalhe do veículo */}
          {veiculo ? (
            <PainelDetalhe
              veiculo={veiculo}
              onEditar={() => abrirEdicao(veiculo)}
            />
          ) : (
            <div className="card">
              <div className="vazio">Selecione um veículo para ver o detalhe.</div>
            </div>
          )}
        </div>
      )}
    </>
  )
}
