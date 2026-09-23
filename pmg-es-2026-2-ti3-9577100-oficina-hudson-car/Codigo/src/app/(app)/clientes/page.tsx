'use client'
// Cadastro de clientes (dados que serão migrados do sistema legado).
// ~95% pessoa física; captação por indicação.
// Dados ainda em mock — integração com API planejada para sprint futura.

import { useMemo, useState } from 'react'
import { clientes, veiculos } from '@/data/mock'
import { data } from '@/utils/format'
import { IconeBusca, IconeAdicionar } from '@/components/icons'

export default function PaginaClientes() {
  const [busca, setBusca] = useState('')

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return clientes
    return clientes.filter((c) =>
      `${c.nome} ${c.telefone} ${c.documento}`.toLowerCase().includes(q),
    )
  }, [busca])

  return (
    <>
      <div className="acoes-topo">
        <div className="campo-busca">
          <IconeBusca className="lupa" sx={{ fontSize: 20 }} />
          <input
            placeholder="Buscar por nome, telefone ou CPF…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            aria-label="Buscar cliente"
          />
        </div>
        <button className="btn">
          <IconeAdicionar sx={{ fontSize: 18 }} /> Novo cliente
        </button>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h2>Clientes</h2>
            <p>Dados serão migrados do sistema atual (~1 ano e 3 meses)</p>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Telefone</th>
              <th>CPF</th>
              <th className="direita">Veículos</th>
              <th>Cliente desde</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((c) => (
              <tr key={c.id}>
                <td className="forte">{c.nome}</td>
                <td className="mono">{c.telefone}</td>
                <td className="mono">{c.documento}</td>
                <td className="direita">
                  {veiculos.filter((v) => v.clienteId === c.id).length}
                </td>
                <td>{data(c.desde)}</td>
              </tr>
            ))}
            {lista.length === 0 && (
              <tr>
                <td colSpan={5} className="vazio">
                  Nenhum cliente encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
