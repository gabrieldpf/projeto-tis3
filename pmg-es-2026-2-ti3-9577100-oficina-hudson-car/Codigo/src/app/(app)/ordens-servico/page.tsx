'use client'
// Lista de ordens de serviço com filtro por status e busca.
// Dados ainda em mock — integração com API planejada para sprint futura.

import { useMemo, useState } from 'react'
import {
  clientePorId,
  ordensServico,
  veiculoPorId,
} from '@/data/mock'
import type { StatusOS } from '@/types'
import { data } from '@/utils/format'
import { BadgeOS } from '@/components/Badges'
import { IconeBusca, IconeAdicionar } from '@/components/icons'

const FILTROS: { valor: StatusOS | 'todas'; texto: string }[] = [
  { valor: 'todas', texto: 'Todas' },
  { valor: 'aberta', texto: 'Abertas' },
  { valor: 'em_andamento', texto: 'Em andamento' },
  { valor: 'aguardando_peca', texto: 'Aguardando peça' },
  { valor: 'pronta', texto: 'Prontas' },
  { valor: 'entregue', texto: 'Entregues' },
]

export default function PaginaOrdensServico() {
  const [filtro, setFiltro] = useState<StatusOS | 'todas'>('todas')
  const [busca, setBusca] = useState('')

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return ordensServico.filter((os) => {
      if (filtro !== 'todas' && os.status !== filtro) return false
      if (!q) return true
      const v = veiculoPorId(os.veiculoId)
      const cliente = clientePorId(os.clienteId)?.nome ?? ''
      return `${os.numero} ${cliente} ${v?.placa ?? ''} ${v?.modelo ?? ''} ${os.responsavel}`
        .toLowerCase()
        .includes(q)
    })
  }, [filtro, busca])

  return (
    <>
      <div className="acoes-topo">
        <div className="campo-busca">
          <IconeBusca className="lupa" sx={{ fontSize: 20 }} />
          <input
            placeholder="Buscar OS, veículo ou responsável…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            aria-label="Buscar ordem de serviço"
          />
        </div>
        <button className="btn">
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
        <table>
          <thead>
            <tr>
              <th>OS</th>
              <th>Cliente</th>
              <th>Veículo</th>
              <th>Responsável</th>
              <th>Abertura</th>
              <th>Previsão</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((os) => {
              const v = veiculoPorId(os.veiculoId)
              return (
                <tr key={os.id}>
                  <td className="mono forte">{os.numero}</td>
                  <td>{clientePorId(os.clienteId)?.nome}</td>
                  <td>
                    {v?.marca} {v?.modelo} ·{' '}
                    <span className="mono">{v?.placa}</span>
                  </td>
                  <td>{os.responsavel}</td>
                  <td>{data(os.aberturaEm)}</td>
                  <td>{data(os.previsaoEntrega)}</td>
                  <td>
                    <BadgeOS status={os.status} />
                  </td>
                </tr>
              )
            })}
            {lista.length === 0 && (
              <tr>
                <td colSpan={7} className="vazio">
                  Nenhuma ordem de serviço encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
