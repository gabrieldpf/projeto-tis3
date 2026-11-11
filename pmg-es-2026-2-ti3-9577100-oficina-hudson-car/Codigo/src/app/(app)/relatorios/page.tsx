'use client'
// Relatórios financeiros — ACESSO RESTRITO AO ADMIN (regras de ouro nº 2 e nº 5).
// S2 (Sprint 4): filtro por período (de/até) com atalhos, comparativo
// carros × faturamento (não proporcionais) e resumo do período com variação
// vs. o período anterior. O middleware e o menu já bloqueiam não-admins; esta
// tela é a camada visual (com guarda extra).

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { obterRelatorioFinanceiro, type RelatorioFinanceiroApi, ApiClientError } from '@/lib/api'
import { moeda, variacaoPercentual } from '@/utils/format'
import {
  IconeCadeado,
  IconeDinheiro,
  IconeTicket,
  IconeReceber,
  IconeCalendario,
} from '@/components/icons'

/// Data de hoje como 'yyyy-mm-dd' (local).
function isoHoje(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/// Primeiro dia do mês atual como 'yyyy-mm-dd' (local).
function isoPrimeiroDiaMes(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

/// Formata a variação (número vindo do backend, ou null) para texto + cor.
function fmtVariacao(v: number | null): { texto: string; cor: string } {
  if (v === null) return { texto: 'sem base de comparação', cor: 'var(--cinza-suave)' }
  const sinal = v >= 0 ? '+' : ''
  return { texto: `${sinal}${v.toFixed(1)}%`, cor: v >= 0 ? 'var(--verde)' : 'var(--vermelho)' }
}

export default function PaginaRelatorios() {
  const { ehAdmin } = useAuth()
  const [dados, setDados] = useState<RelatorioFinanceiroApi | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  // Período selecionado (vazio = padrão: últimos 6 meses).
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')

  const carregar = useCallback(() => {
    if (!ehAdmin) {
      setCarregando(false)
      return
    }
    setCarregando(true)
    setErro(null)
    // Só manda período quando as DUAS datas estão preenchidas.
    const params = de && ate ? { de, ate } : {}
    obterRelatorioFinanceiro(params)
      .then(setDados)
      .catch((e) => {
        setErro(e instanceof ApiClientError ? e.message : 'Erro ao carregar relatório.')
      })
      .finally(() => setCarregando(false))
  }, [ehAdmin, de, ate])

  useEffect(() => {
    carregar()
  }, [carregar])

  function aplicarMesAtual() {
    setDe(isoPrimeiroDiaMes())
    setAte(isoHoje())
  }

  function aplicarUltimos6() {
    setDe('')
    setAte('')
  }

  // Guarda extra: bloqueia visualmente mesmo que o middleware falhe.
  if (!ehAdmin) {
    return (
      <div className="aviso vermelho" role="alert">
        <IconeCadeado sx={{ fontSize: 18 }} />{' '}
        <strong>Acesso restrito ao administrador.</strong> Você não tem permissão para ver esta página.
      </div>
    )
  }

  const periodoCustom = Boolean(de && ate)

  // Barra de filtro (sempre visível para o admin).
  const barraFiltro = (
    <div className="card" style={{ marginBottom: 22 }}>
      <div className="card-body">
        <div className="flex" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="campo-form">
            <label htmlFor="rel-de">De</label>
            <input
              id="rel-de"
              type="date"
              className="input"
              value={de}
              max={ate || undefined}
              onChange={(e) => setDe(e.target.value)}
            />
          </div>
          <div className="campo-form">
            <label htmlFor="rel-ate">Até</label>
            <input
              id="rel-ate"
              type="date"
              className="input"
              value={ate}
              min={de || undefined}
              onChange={(e) => setAte(e.target.value)}
            />
          </div>
          <button
            className={`btn ${periodoCustom ? 'secundario' : ''}`}
            onClick={aplicarUltimos6}
            aria-pressed={!periodoCustom}
          >
            Últimos 6 meses
          </button>
          <button className="btn secundario" onClick={aplicarMesAtual}>
            Mês atual
          </button>
          {de && !ate && (
            <span className="txt-suave">Escolha também a data final para filtrar.</span>
          )}
        </div>
      </div>
    </div>
  )

  if (carregando) {
    return (
      <>
        {barraFiltro}
        <div className="carregando">Carregando relatório financeiro…</div>
      </>
    )
  }

  if (erro) {
    return (
      <>
        {barraFiltro}
        <div className="aviso vermelho" role="alert">
          {erro}
        </div>
      </>
    )
  }

  const temSerie = dados && dados.serie.length > 0
  const maxFat = temSerie ? Math.max(...dados!.serie.map((s) => s.faturamento), 0) : 0
  const maxCarros = temSerie ? Math.max(...dados!.serie.map((s) => s.carros), 0) : 0
  const varCarros = dados ? fmtVariacao(dados.variacao.carros) : null
  const varFat = dados ? fmtVariacao(dados.variacao.faturamento) : null

  return (
    <>
      <div className="aviso amarelo">
        <IconeCadeado sx={{ fontSize: 18 }} />
        <span>
          <strong>Conteúdo confidencial.</strong> Estes dados financeiros são
          visíveis apenas ao administrador.
        </span>
      </div>

      {barraFiltro}

      {/* Cartões de resumo (mês corrente) */}
      <div className="grid-cards">
        <div className="stat-card destaque">
          <div className="rotulo">
            <IconeDinheiro fontSize="small" /> Faturamento do mês
          </div>
          <div className="valor">{moeda(dados?.faturamentoMes ?? 0)}</div>
          <div className="sub">
            {variacaoPercentual(dados?.faturamentoMes ?? 0, dados?.faturamentoMesAnterior ?? 0)} vs. mês anterior
          </div>
        </div>
        <div className="stat-card">
          <div className="rotulo">
            <IconeTicket fontSize="small" /> Ticket médio
          </div>
          <div className="valor">{moeda(dados?.ticketMedio ?? 0)}</div>
          <div className="sub">por serviço (mês)</div>
        </div>
        <div className="stat-card">
          <div className="rotulo">
            <IconeReceber fontSize="small" /> A receber
          </div>
          <div className="valor">{moeda(dados?.aReceber ?? 0)}</div>
          <div className="sub">pagamentos pendentes</div>
        </div>
        <div className="stat-card">
          <div className="rotulo">
            <IconeCalendario fontSize="small" /> Mês anterior
          </div>
          <div className="valor">{moeda(dados?.faturamentoMesAnterior ?? 0)}</div>
          <div className="sub">referência de comparação</div>
        </div>
      </div>

      {/* Resumo do período selecionado + variação vs. período anterior */}
      {dados && (
        <div className="card">
          <div className="card-head">
            <div>
              <h2>
                Resumo do período{' '}
                {periodoCustom ? (
                  <span className="txt-suave" style={{ fontWeight: 400 }}>
                    ({de} a {ate})
                  </span>
                ) : (
                  <span className="txt-suave" style={{ fontWeight: 400 }}>
                    (últimos 6 meses)
                  </span>
                )}
              </h2>
              <p>Variação comparada ao período anterior de mesma duração</p>
            </div>
          </div>
          <div className="card-body">
            <div className="def-grid">
              <div className="item">
                <div className="rotulo">Carros atendidos</div>
                <div className="valor">
                  {dados.totalCarros}{' '}
                  {varCarros && (
                    <span style={{ color: varCarros.cor, fontSize: 13, fontWeight: 600 }}>
                      {varCarros.texto}
                    </span>
                  )}
                </div>
              </div>
              <div className="item">
                <div className="rotulo">Faturamento no período</div>
                <div className="valor">
                  {moeda(dados.totalFaturamento)}{' '}
                  {varFat && (
                    <span style={{ color: varFat.cor, fontSize: 13, fontWeight: 600 }}>
                      {varFat.texto}
                    </span>
                  )}
                </div>
              </div>
              <div className="item">
                <div className="rotulo">Média por carro</div>
                <div className="valor">{moeda(dados.ticketMedioPeriodo)}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!temSerie ? (
        <div className="vazio" style={{ padding: 32 }}>
          Nenhum dado financeiro disponível para o período.
        </div>
      ) : (
        <>
          <div className="card">
            <div className="card-head">
              <div>
                <h2>Carros × Faturamento por período</h2>
                <p>Número de carros e faturamento não são proporcionais</p>
              </div>
            </div>
            <div className="card-body">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: 28,
                  height: 220,
                  padding: '10px 4px',
                  overflowX: 'auto',
                }}
              >
                {dados!.serie.map((s) => (
                  <div key={s.periodo} style={{ flex: 1, minWidth: 48, textAlign: 'center', height: '100%' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'center',
                        gap: 6,
                        height: 170,
                      }}
                    >
                      <div
                        title={`Faturamento: ${moeda(s.faturamento)}`}
                        style={{
                          width: 26,
                          height: `${maxFat > 0 ? (s.faturamento / maxFat) * 100 : 0}%`,
                          background: 'var(--laranja)',
                          borderRadius: '5px 5px 0 0',
                        }}
                      />
                      <div
                        title={`Carros: ${s.carros}`}
                        style={{
                          width: 26,
                          height: `${maxCarros > 0 ? (s.carros / maxCarros) * 100 : 0}%`,
                          background: 'var(--azul-claro)',
                          borderRadius: '5px 5px 0 0',
                        }}
                      />
                    </div>
                    <div className="forte" style={{ marginTop: 8 }}>
                      {s.periodo}
                    </div>
                    <div className="txt-suave" style={{ fontSize: 12 }}>
                      {s.carros} carros
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex" style={{ marginTop: 16 }}>
                <span className="badge" style={{ background: 'var(--laranja)', color: '#fff' }}>
                  Faturamento
                </span>
                <span className="badge" style={{ background: 'var(--azul-claro)', color: '#fff' }}>
                  Nº de carros
                </span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <div>
                <h2>Detalhamento por período</h2>
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Período</th>
                  <th className="direita">Carros atendidos</th>
                  <th className="direita">Faturamento</th>
                  <th className="direita">Média por carro</th>
                </tr>
              </thead>
              <tbody>
                {dados!.serie.map((s) => (
                  <tr key={s.periodo}>
                    <td className="forte">{s.periodo}</td>
                    <td className="direita">{s.carros}</td>
                    <td className="direita forte">{moeda(s.faturamento)}</td>
                    <td className="direita">{s.carros > 0 ? moeda(s.faturamento / s.carros) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}
