'use client'
// Início / Dashboard — Sprint 3 (N4).
// N4: cards "Aditivos aguardando autorização" e "Prontas para entrega".
// Os cards financeiros só são renderizados para o admin (regra de ouro nº 2).

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { financeiro } from '@/data/mock'
import { moeda, variacaoPercentual } from '@/utils/format'
import { BadgeOS, BadgeOrcamento } from '@/components/Badges'
import {
  IconeOS,
  IconeOrcamento,
  IconeEstoque,
  IconeDinheiro,
  IconeVeiculo,
  IconeAlerta,
  IconeGarantia,
} from '@/components/icons'
import {
  listarOrdensServico,
  listarOrcamentos,
  listarAlertas,
  listarAditivos,
  type OrdemServicoApi,
  type OrcamentoApi,
  type AlertaCompraApi,
  type AditivoApi,
  ApiClientError,
} from '@/lib/api'
import type { StatusOS, StatusOrcamento, StatusAditivo } from '@/lib/constants'
import { ROTULO_STATUS_ADITIVO } from '@/lib/constants'

export default function PaginaInicio() {
  const { usuario, ehAdmin } = useAuth()

  const [osAtivas, setOsAtivas] = useState<OrdemServicoApi[]>([])
  const [aguardandoAutorizacao, setAguardandoAutorizacao] = useState<OrcamentoApi[]>([])
  const [alertas, setAlertas] = useState<AlertaCompraApi[]>([])
  const [aditivosPendentes, setAditivosPendentes] = useState<AditivoApi[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let cancelado = false

    async function carregar() {
      setCarregando(true)
      const [todasOS, orcamentosPendentes, alertasEstoque, aditivos] = await Promise.all([
        listarOrdensServico({}).catch((err) => {
          if (!(err instanceof ApiClientError)) console.error(err)
          return [] as OrdemServicoApi[]
        }),
        listarOrcamentos({ status: 'AGUARDANDO_AUTORIZACAO' }).catch((err) => {
          if (!(err instanceof ApiClientError)) console.error(err)
          return [] as OrcamentoApi[]
        }),
        listarAlertas().catch((err) => {
          if (!(err instanceof ApiClientError)) console.error(err)
          return [] as AlertaCompraApi[]
        }),
        listarAditivos({ status: 'AGUARDANDO_AUTORIZACAO' }).catch(() => [] as AditivoApi[]),
      ])

      if (cancelado) return

      setOsAtivas(todasOS.filter((os) => os.status !== 'ENTREGUE'))
      setAguardandoAutorizacao(orcamentosPendentes)
      setAlertas(alertasEstoque)
      setAditivosPendentes(aditivos)
      setCarregando(false)
    }

    void carregar()

    return () => {
      cancelado = true
    }
  }, [])

  // N4 — OS com status PRONTA (derivado das já carregadas).
  const osProntas = osAtivas.filter((os) => os.status === 'PRONTA')

  return (
    <>
      <p className="txt-suave" style={{ marginBottom: 18 }}>
        Olá, <strong>{usuario?.nome.split(' ')[0] ?? usuario?.nome}</strong>. Aqui está o resumo de hoje.
      </p>

      {/* Indicadores operacionais — visíveis a todos */}
      <div className="grid-cards">
        <div className="stat-card">
          <div className="rotulo">
            <IconeOS fontSize="small" /> Serviços em andamento
          </div>
          <div className="valor">{carregando ? '…' : osAtivas.length}</div>
          <div className="sub">ordens de serviço abertas</div>
        </div>
        <div className="stat-card">
          <div className="rotulo">
            <IconeOrcamento fontSize="small" /> Aguardando autorização
          </div>
          <div className="valor">{carregando ? '…' : aguardandoAutorizacao.length}</div>
          <div className="sub">orçamentos pendentes do cliente</div>
        </div>
        <div className="stat-card">
          <div className="rotulo">
            <IconeEstoque fontSize="small" /> Alertas de compra
          </div>
          <div className="valor">{carregando ? '…' : alertas.length}</div>
          <div className="sub">inclui itens abaixo do mínimo após baixas de OS</div>
        </div>

        {/* Card financeiro — SOMENTE ADMIN (regra de ouro nº 2) */}
        {ehAdmin ? (
          <div className="stat-card destaque">
            <div className="rotulo">
              <IconeDinheiro fontSize="small" /> Faturamento do mês
            </div>
            <div className="valor">{moeda(financeiro.faturamentoMes)}</div>
            <div className="sub">
              {variacaoPercentual(
                financeiro.faturamentoMes,
                financeiro.faturamentoMesAnterior,
              )}{' '}
              vs. mês anterior
            </div>
          </div>
        ) : (
          <div className="stat-card">
            <div className="rotulo">
              <IconeVeiculo fontSize="small" /> Carros hoje
            </div>
            <div className="valor">12</div>
            <div className="sub">agenda cheia p/ ~20 dias</div>
          </div>
        )}
      </div>

      {/* N4 — Prontas para entrega */}
      {(!carregando && osProntas.length > 0) && (
        <div className="card">
          <div className="card-head">
            <div>
              <h2>
                <IconeGarantia sx={{ fontSize: 18, verticalAlign: '-3px', color: 'var(--verde)' }} />{' '}
                Prontas para entrega
              </h2>
              <p>OS concluídas — aguardando retirada pelo cliente</p>
            </div>
            <Link href="/ordens-servico" className="btn secundario">
              Ver todas
            </Link>
          </div>
          <table>
            <thead>
              <tr>
                <th>OS</th>
                <th>Veículo</th>
                <th>Responsável</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {osProntas.map((os) => (
                <tr key={os.id}>
                  <td className="mono forte">{os.numero}</td>
                  <td>
                    {os.veiculo?.marca} {os.veiculo?.modelo}
                    {os.veiculo?.placa ? (
                      <> · <span className="mono">{os.veiculo.placa}</span></>
                    ) : null}
                  </td>
                  <td>{os.mecanico?.nome ?? 'A definir'}</td>
                  <td>
                    <BadgeOS status={os.status as StatusOS} />
                  </td>
                  <td>
                    <Link
                      href={`/ordens-servico?os=${os.id}`}
                      className="btn secundario"
                      style={{ padding: '4px 10px', fontSize: 13 }}
                      aria-label={`Abrir OS ${os.numero}`}
                    >
                      Abrir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* N4 — Aditivos aguardando autorização */}
      {(!carregando && aditivosPendentes.length > 0) && (
        <div className="card">
          <div className="card-head">
            <div>
              <h2>Aditivos aguardando autorização</h2>
              <p>Serviços extras adicionados às OS em andamento</p>
            </div>
            <Link href="/ordens-servico" className="btn secundario">
              Ver OS
            </Link>
          </div>
          <table>
            <thead>
              <tr>
                <th>Aditivo</th>
                <th>Orçamento</th>
                <th>OS</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {aditivosPendentes.map((adi) => (
                <tr key={adi.id}>
                  <td className="mono forte">Aditivo #{adi.numero}</td>
                  <td className="mono">
                    {adi.orcamento?.numero ?? '—'}
                  </td>
                  <td className="mono">
                    {adi.orcamento?.ordemServico?.numero ?? '—'}
                  </td>
                  <td>
                    <span className="badge amarelo">
                      {ROTULO_STATUS_ADITIVO[adi.status as StatusAditivo]}
                    </span>
                  </td>
                  <td>
                    {adi.orcamento?.ordemServico?.id ? (
                      <Link
                        href={`/ordens-servico?os=${adi.orcamento.ordemServico.id}`}
                        className="btn secundario"
                        style={{ padding: '4px 10px', fontSize: 13 }}
                        aria-label={`Abrir OS do Aditivo #${adi.numero}`}
                      >
                        Ver OS
                      </Link>
                    ) : (
                      <span className="txt-suave">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Orçamentos aguardando autorização */}
      <div className="card">
        <div className="card-head">
          <div>
            <h2>Aguardando autorização do cliente</h2>
            <p>Ligue para o cliente para autorizar o serviço</p>
          </div>
          <Link href="/orcamentos" className="btn secundario">
            Ver todos
          </Link>
        </div>
        {carregando ? (
          <p className="txt-suave" style={{ padding: '12px 0' }}>Carregando…</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Orçamento</th>
                <th>Cliente</th>
                <th>Veículo</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {aguardandoAutorizacao.map((o) => (
                <tr key={o.id}>
                  <td className="mono forte">{o.numero}</td>
                  <td>{o.cliente?.nome ?? '—'}</td>
                  <td>
                    {o.veiculo?.marca} {o.veiculo?.modelo}
                    {o.veiculo?.placa ? (
                      <> · <span className="mono">{o.veiculo.placa}</span></>
                    ) : null}
                  </td>
                  <td>
                    <BadgeOrcamento status={o.status as StatusOrcamento} />
                  </td>
                </tr>
              ))}
              {aguardandoAutorizacao.length === 0 && (
                <tr>
                  <td colSpan={4} className="vazio">
                    Nenhum orçamento pendente no momento.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Serviços em andamento */}
      <div className="card">
        <div className="card-head">
          <div>
            <h2>Serviços em andamento</h2>
            <p>Ordens de serviço em execução na oficina</p>
          </div>
          <Link href="/ordens-servico" className="btn secundario">
            Ver todas
          </Link>
        </div>
        {carregando ? (
          <p className="txt-suave" style={{ padding: '12px 0' }}>Carregando…</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>OS</th>
                <th>Veículo</th>
                <th>Responsável</th>
                <th>Previsão</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {osAtivas.map((os) => (
                <tr key={os.id}>
                  <td className="mono forte">{os.numero}</td>
                  <td>
                    {os.veiculo?.marca} {os.veiculo?.modelo}
                    {os.veiculo?.placa ? (
                      <> · <span className="mono">{os.veiculo.placa}</span></>
                    ) : null}
                  </td>
                  <td>{os.mecanico?.nome ?? 'A definir'}</td>
                  <td>{os.previsaoEntrega ? new Date(os.previsaoEntrega).toLocaleDateString('pt-BR') : 'A definir'}</td>
                  <td>
                    <BadgeOS status={os.status as StatusOS} />
                  </td>
                </tr>
              ))}
              {osAtivas.length === 0 && (
                <tr>
                  <td colSpan={5} className="vazio">
                    Nenhuma ordem de serviço em andamento no momento.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Peças para comprar — só exibe se houver alertas */}
      {!carregando && alertas.length > 0 && (
        <div className="card">
          <div className="card-head">
            <div>
              <h2>
                <IconeAlerta sx={{ fontSize: 18, verticalAlign: '-3px', color: 'var(--amarelo)' }} />{' '}
                Peças para comprar
              </h2>
              <p>Itens no ou abaixo do estoque mínimo</p>
            </div>
            <Link href="/estoque" className="btn secundario">
              Ir ao estoque
            </Link>
          </div>
          <table>
            <thead>
              <tr>
                <th>Peça</th>
                <th>Em estoque</th>
                <th>Mínimo</th>
              </tr>
            </thead>
            <tbody>
              {alertas.map((alerta) => (
                <tr key={alerta.id} className="linha-alerta">
                  <td className="forte">{alerta.nome}</td>
                  <td>
                    {alerta.quantidadeAtual} {alerta.unidade}
                  </td>
                  <td>
                    {alerta.estoqueMinimo} {alerta.unidade}
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
