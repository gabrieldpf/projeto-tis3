'use client'
// Relatórios financeiros — ACESSO RESTRITO AO ADMIN (regras de ouro nº 2 e nº 5).
// O middleware já bloqueia a rota para não-admins; esta tela é a camada visual.
// Comparativo carros × faturamento por período (não são proporcionais).

import { financeiro } from '@/data/mock'
import { moeda, variacaoPercentual } from '@/utils/format'
import {
  IconeCadeado,
  IconeDinheiro,
  IconeTicket,
  IconeReceber,
  IconeCalendario,
} from '@/components/icons'

export default function PaginaRelatorios() {
  const maxFat = Math.max(...financeiro.serie.map((s) => s.faturamento))
  const maxCarros = Math.max(...financeiro.serie.map((s) => s.carros))

  return (
    <>
      <div className="aviso amarelo">
        <IconeCadeado sx={{ fontSize: 18 }} />
        <span>
          <strong>Conteúdo confidencial.</strong> Estes dados financeiros são
          visíveis apenas ao administrador.
        </span>
      </div>

      <div className="grid-cards">
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
        <div className="stat-card">
          <div className="rotulo">
            <IconeTicket fontSize="small" /> Ticket médio
          </div>
          <div className="valor">{moeda(financeiro.ticketMedio)}</div>
          <div className="sub">por serviço</div>
        </div>
        <div className="stat-card">
          <div className="rotulo">
            <IconeReceber fontSize="small" /> A receber
          </div>
          <div className="valor">{moeda(financeiro.aReceber)}</div>
          <div className="sub">pagamentos pendentes</div>
        </div>
        <div className="stat-card">
          <div className="rotulo">
            <IconeCalendario fontSize="small" /> Mês anterior
          </div>
          <div className="valor">{moeda(financeiro.faturamentoMesAnterior)}</div>
          <div className="sub">referência de comparação</div>
        </div>
      </div>

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
            }}
          >
            {financeiro.serie.map((s) => (
              <div
                key={s.periodo}
                style={{ flex: 1, textAlign: 'center', height: '100%' }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                    gap: 6,
                    height: 170,
                  }}
                >
                  {/* Barra: faturamento */}
                  <div
                    title={`Faturamento: ${moeda(s.faturamento)}`}
                    style={{
                      width: 26,
                      height: `${(s.faturamento / maxFat) * 100}%`,
                      background: 'var(--laranja)',
                      borderRadius: '5px 5px 0 0',
                    }}
                  />
                  {/* Barra: carros */}
                  <div
                    title={`Carros: ${s.carros}`}
                    style={{
                      width: 26,
                      height: `${(s.carros / maxCarros) * 100}%`,
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
            {financeiro.serie.map((s) => (
              <tr key={s.periodo}>
                <td className="forte">{s.periodo}</td>
                <td className="direita">{s.carros}</td>
                <td className="direita forte">{moeda(s.faturamento)}</td>
                <td className="direita">{moeda(s.faturamento / s.carros)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
