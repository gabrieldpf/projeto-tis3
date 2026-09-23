'use client'
// Veículos com histórico por veículo (serviços, garantia) e
// fotos de entrada/saída (evita disputa de arranhão após a lavagem).
// Dados ainda em mock — integração com API planejada para sprint futura.

import { useMemo, useState } from 'react'
import {
  clientePorId,
  historicoDoVeiculo,
  veiculos,
} from '@/data/mock'
import { data } from '@/utils/format'
import {
  IconeBusca,
  IconeAdicionar,
  IconeFoto,
  IconeVeiculo,
  IconeMecanico,
  IconeGarantia,
} from '@/components/icons'

export default function PaginaVeiculos() {
  const [busca, setBusca] = useState('')
  const [selecionado, setSelecionado] = useState<string | null>(veiculos[0]?.id ?? null)

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return veiculos
    return veiculos.filter((v) => {
      const cliente = clientePorId(v.clienteId)?.nome ?? ''
      return `${v.placa} ${v.chassi} ${v.marca} ${v.modelo} ${cliente}`
        .toLowerCase()
        .includes(q)
    })
  }, [busca])

  const veiculo = veiculos.find((v) => v.id === selecionado) ?? null
  const registros = veiculo ? historicoDoVeiculo(veiculo.id) : []

  return (
    <>
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
        <button className="btn">
          <IconeAdicionar sx={{ fontSize: 18 }} /> Novo veículo
        </button>
      </div>

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
              {lista.map((v) => (
                <tr
                  key={v.id}
                  onClick={() => setSelecionado(v.id)}
                  style={{
                    cursor: 'pointer',
                    background: v.id === selecionado ? '#fff5ec' : undefined,
                  }}
                >
                  <td className="forte">
                    {v.marca} {v.modelo}
                    <br />
                    <span className="txt-suave">
                      {v.ano} · {v.cor}
                    </span>
                  </td>
                  <td className="mono">{v.placa}</td>
                  <td>{clientePorId(v.clienteId)?.nome}</td>
                </tr>
              ))}
              {lista.length === 0 && (
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
          <div>
            <div className="card">
              <div className="card-head">
                <div>
                  <h2>
                    {veiculo.marca} {veiculo.modelo}
                  </h2>
                  <p>
                    {clientePorId(veiculo.clienteId)?.nome} ·{' '}
                    {clientePorId(veiculo.clienteId)?.telefone}
                  </p>
                </div>
              </div>
              <div className="card-body">
                <div className="def-grid">
                  <div className="item">
                    <div className="rotulo">Placa</div>
                    <div className="valor mono">{veiculo.placa}</div>
                  </div>
                  <div className="item">
                    <div className="rotulo">Chassi</div>
                    <div className="valor mono">{veiculo.chassi}</div>
                  </div>
                  <div className="item">
                    <div className="rotulo">Ano</div>
                    <div className="valor">{veiculo.ano}</div>
                  </div>
                  <div className="item">
                    <div className="rotulo">Cor</div>
                    <div className="valor">{veiculo.cor}</div>
                  </div>
                </div>
              </div>
            </div>

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
                  {['Entrada — frente', 'Entrada — lateral', 'Saída — frente', 'Saída — lavado'].map(
                    (legenda) => (
                      <div
                        key={legenda}
                        style={{
                          width: 140,
                          textAlign: 'center',
                        }}
                      >
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

            {/* Histórico */}
            <div className="card">
              <div className="card-head">
                <div>
                  <h2>Histórico de serviços</h2>
                  <p>Serviços realizados e garantias</p>
                </div>
              </div>
              <div className="card-body">
                {registros.length === 0 ? (
                  <p className="txt-suave">Sem serviços registrados para este veículo.</p>
                ) : (
                  <ul className="timeline">
                    {registros.map((r) => (
                      <li key={r.id}>
                        <div className="data-reg">{data(r.data)}</div>
                        <div className="desc-reg">{r.descricao}</div>
                        <div className="flex" style={{ flexWrap: 'wrap' }}>
                          <span className="badge cinza">
                            <IconeMecanico fontSize="inherit" /> {r.responsavel}
                          </span>
                          {r.garantiaAte && (
                            <span className="badge verde">
                              <IconeGarantia fontSize="inherit" /> Garantia até{' '}
                              {data(r.garantiaAte)}
                            </span>
                          )}
                          {r.temFotos && (
                            <span className="badge azul">
                              <IconeFoto fontSize="inherit" /> Com fotos
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="vazio">Selecione um veículo para ver o histórico.</div>
          </div>
        )}
      </div>
    </>
  )
}
