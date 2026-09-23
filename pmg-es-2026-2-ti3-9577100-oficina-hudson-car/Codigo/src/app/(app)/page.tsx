'use client'
// Início / Dashboard.
// Os cards financeiros só são renderizados para o admin (regra de ouro nº 2).

import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import {
  clientePorId,
  estoque,
  financeiro,
  ordensServico,
  orcamentos,
  pecaPorId,
  veiculoPorId,
} from '@/data/mock'
import { moeda, variacaoPercentual } from '@/utils/format'
import { BadgeOS, BadgeOrcamento } from '@/components/Badges'
import {
  IconeOS,
  IconeOrcamento,
  IconeEstoque,
  IconeDinheiro,
  IconeVeiculo,
  IconeAlerta,
} from '@/components/icons'

export default function PaginaInicio() {
  const { usuario, ehAdmin } = useAuth()

  const osAtivas = ordensServico.filter((os) => os.status !== 'entregue')
  const aguardandoAutorizacao = orcamentos.filter(
    (o) => o.status === 'aguardando_autorizacao',
  )
  const alertasEstoque = estoque.filter((e) => e.quantidade <= e.minimo)

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
          <div className="valor">{osAtivas.length}</div>
          <div className="sub">ordens de serviço abertas</div>
        </div>
        <div className="stat-card">
          <div className="rotulo">
            <IconeOrcamento fontSize="small" /> Aguardando autorização
          </div>
          <div className="valor">{aguardandoAutorizacao.length}</div>
          <div className="sub">orçamentos pendentes do cliente</div>
        </div>
        <div className="stat-card">
          <div className="rotulo">
            <IconeEstoque fontSize="small" /> Alertas de compra
          </div>
          <div className="valor">{alertasEstoque.length}</div>
          <div className="sub">itens no/abaixo do mínimo</div>
        </div>

        {/* Card financeiro — SOMENTE ADMIN */}
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
            {aguardandoAutorizacao.map((o) => {
              const v = veiculoPorId(o.veiculoId)
              return (
                <tr key={o.id}>
                  <td className="mono forte">{o.numero}</td>
                  <td>{clientePorId(o.clienteId)?.nome}</td>
                  <td>
                    {v?.marca} {v?.modelo} · <span className="mono">{v?.placa}</span>
                  </td>
                  <td>
                    <BadgeOrcamento status={o.status} />
                  </td>
                </tr>
              )
            })}
            {aguardandoAutorizacao.length === 0 && (
              <tr>
                <td colSpan={4} className="vazio">
                  Nenhum orçamento pendente no momento.
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
            {osAtivas.map((os) => {
              const v = veiculoPorId(os.veiculoId)
              return (
                <tr key={os.id}>
                  <td className="mono forte">{os.numero}</td>
                  <td>
                    {v?.marca} {v?.modelo} · <span className="mono">{v?.placa}</span>
                  </td>
                  <td>{os.responsavel}</td>
                  <td>{os.previsaoEntrega.split('-').reverse().join('/')}</td>
                  <td>
                    <BadgeOS status={os.status} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Alertas de estoque */}
      {alertasEstoque.length > 0 && (
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
              {alertasEstoque.map((e) => {
                const p = pecaPorId(e.pecaId)
                return (
                  <tr key={e.pecaId} className="linha-alerta">
                    <td className="forte">{p?.nome}</td>
                    <td>
                      {e.quantidade} {e.unidade}
                    </td>
                    <td>
                      {e.minimo} {e.unidade}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
