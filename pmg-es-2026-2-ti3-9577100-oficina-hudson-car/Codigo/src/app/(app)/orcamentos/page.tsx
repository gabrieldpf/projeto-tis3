'use client'
// Lista de orçamentos com busca e detalhe expansível.
// Mostra o indicador de "edição simultânea" (regra de ouro nº 4).
// Dados ainda em mock — integração com API planejada para sprint futura.

import { Fragment, useMemo, useState } from 'react'
import {
  clientePorId,
  orcamentos,
  totalOrcamento,
  veiculoPorId,
} from '@/data/mock'
import { data, moeda } from '@/utils/format'
import { BadgeOrcamento } from '@/components/Badges'
import {
  IconeBusca,
  IconeAdicionar,
  IconeEditar,
  IconeCadeado,
} from '@/components/icons'

export default function PaginaOrcamentos() {
  const [busca, setBusca] = useState('')
  const [aberto, setAberto] = useState<string | null>(null)

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return orcamentos
    return orcamentos.filter((o) => {
      const cliente = clientePorId(o.clienteId)?.nome.toLowerCase() ?? ''
      const v = veiculoPorId(o.veiculoId)
      const alvo = `${o.numero} ${cliente} ${v?.placa ?? ''} ${v?.modelo ?? ''}`.toLowerCase()
      return alvo.includes(q)
    })
  }, [busca])

  return (
    <>
      <div className="acoes-topo">
        <div className="campo-busca">
          <IconeBusca className="lupa" sx={{ fontSize: 20 }} />
          <input
            placeholder="Buscar por nº, cliente, placa ou modelo…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            aria-label="Buscar orçamento"
          />
        </div>
        <button className="btn">
          <IconeAdicionar sx={{ fontSize: 18 }} /> Novo orçamento
        </button>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Orçamento</th>
              <th>Cliente</th>
              <th>Veículo</th>
              <th>Criado</th>
              <th>Status</th>
              <th className="direita">Total</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((o) => {
              const v = veiculoPorId(o.veiculoId)
              const estaAberto = aberto === o.id
              return (
                <Fragment key={o.id}>
                  <tr
                    onClick={() => setAberto(estaAberto ? null : o.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td className="mono forte">
                      {estaAberto ? '▾ ' : '▸ '}
                      {o.numero}
                    </td>
                    <td>{clientePorId(o.clienteId)?.nome}</td>
                    <td>
                      {v?.marca} {v?.modelo} ·{' '}
                      <span className="mono">{v?.placa}</span>
                    </td>
                    <td>{data(o.criadoEm)}</td>
                    <td>
                      <div className="flex">
                        <BadgeOrcamento status={o.status} />
                        {o.editandoPor && (
                          <span className="badge amarelo" title="Edição simultânea">
                            <IconeEditar fontSize="inherit" />{' '}
                            {o.editandoPor.split(' ')[0] ?? o.editandoPor} editando
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="direita forte">{moeda(totalOrcamento(o))}</td>
                  </tr>

                  {estaAberto && (
                    <tr>
                      <td colSpan={6} style={{ background: '#fafbfc' }}>
                        {o.editandoPor && (
                          <div className="aviso amarelo">
                            <IconeCadeado sx={{ fontSize: 18 }} />
                            Este orçamento está sendo editado por{' '}
                            <strong>&nbsp;{o.editandoPor}</strong>. As alterações
                            são salvas item a item para não perder dados em edição
                            simultânea.
                          </div>
                        )}
                        <table>
                          <thead>
                            <tr>
                              <th>Item</th>
                              <th>Tipo</th>
                              <th className="direita">Qtd</th>
                              <th className="direita">Valor unit.</th>
                              <th className="direita">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody>
                            {o.itens.map((it, i) => (
                              <tr key={i}>
                                <td>{it.descricao}</td>
                                <td>
                                  <span
                                    className={`badge ${
                                      it.tipo === 'peca' ? 'azul' : 'cinza'
                                    }`}
                                  >
                                    {it.tipo === 'peca' ? 'Peça' : 'Mão de obra'}
                                  </span>
                                </td>
                                <td className="direita">{it.quantidade}</td>
                                <td className="direita">{moeda(it.valorUnitario)}</td>
                                <td className="direita forte">
                                  {moeda(it.quantidade * it.valorUnitario)}
                                </td>
                              </tr>
                            ))}
                            <tr>
                              <td colSpan={4} className="direita forte">
                                Total do orçamento
                              </td>
                              <td className="direita forte">
                                {moeda(totalOrcamento(o))}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        <p className="txt-suave" style={{ marginTop: 10 }}>
                          Responsável: {o.responsavel}
                        </p>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={6} className="vazio">
                  Nenhum orçamento encontrado para &quot;{busca}&quot;.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
