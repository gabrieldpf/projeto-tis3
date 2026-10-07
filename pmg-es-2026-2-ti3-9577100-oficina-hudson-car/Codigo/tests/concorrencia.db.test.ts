// H2 — Controle otimista por ITEM e por CABEÇALHO (regra de ouro nº 4).
// Salvar com versão antiga devolve 409 CONFLITO; 2 requisições simultâneas
// provam que NADA se perde (uma vence, a outra é avisada com o estado atual).
import { describe, it, expect, beforeEach } from 'vitest'
import { criarOrcamento, atualizarItem, atualizarCabecalho } from '@/server/orcamento'
import { ApiError } from '@/lib/http'
import { limparTudo, criarUsuario, criarCliente, criarVeiculo } from './helpers'

let usuarioId: string
let clienteId: string
let veiculoId: string

beforeEach(async () => {
  await limparTudo()
  usuarioId = (await criarUsuario()).id
  clienteId = (await criarCliente()).id
  veiculoId = (await criarVeiculo(clienteId)).id
})

async function orcComItem() {
  const orc = await criarOrcamento(
    { clienteId, veiculoId, itens: [{ tipo: 'MAO_DE_OBRA', descricao: 'Serviço', quantidade: 1, valorUnitario: 100 }] },
    usuarioId,
  )
  return { orc, item: orc.itens[0]! }
}

describe('controle otimista por item', () => {
  it('salvar com versão velha devolve 409 e não sobrescreve', async () => {
    const { item } = await orcComItem()
    // 1ª edição ok (version 1 -> 2)
    const v2 = await atualizarItem(item.id, { valorUnitario: 150, version: 1 })
    expect(v2?.valorUnitario).toBe(150)
    expect(v2?.version).toBe(2)
    // 2ª edição com a versão ANTIGA (1) deve falhar com CONFLITO
    await expect(atualizarItem(item.id, { valorUnitario: 999, version: 1 })).rejects.toMatchObject({
      code: 'CONFLITO',
    })
  })

  it('2 requisições simultâneas: uma vence, a outra é avisada — nada se perde', async () => {
    const { item } = await orcComItem()
    const resultados = await Promise.allSettled([
      atualizarItem(item.id, { valorUnitario: 200, version: 1 }),
      atualizarItem(item.id, { valorUnitario: 300, version: 1 }),
    ])
    const ok = resultados.filter((r) => r.status === 'fulfilled')
    const conflitos = resultados.filter(
      (r) => r.status === 'rejected' && r.reason instanceof ApiError && r.reason.code === 'CONFLITO',
    )
    expect(ok).toHaveLength(1)
    expect(conflitos).toHaveLength(1)
    // O conflito carrega o estado ATUAL (o que a outra pessoa salvou) — o valor
    // que a pessoa digitou continua disponível para ela decidir. Nada é perdido.
    const conflito = conflitos[0] as PromiseRejectedResult
    expect((conflito.reason as ApiError).detalhes).toBeTruthy()
  })
})

describe('controle otimista por cabeçalho', () => {
  it('editar cabeçalho com versão velha devolve 409', async () => {
    const { orc } = await orcComItem()
    await atualizarCabecalho(orc.id, { observacao: 'primeira', version: 1 })
    await expect(atualizarCabecalho(orc.id, { observacao: 'segunda', version: 1 })).rejects.toMatchObject({
      code: 'CONFLITO',
    })
  })

  it('editar item NÃO conflita com editar outro item (versão é por item)', async () => {
    const orc = await criarOrcamento(
      {
        clienteId,
        veiculoId,
        itens: [
          { tipo: 'MAO_DE_OBRA', descricao: 'A', quantidade: 1, valorUnitario: 10 },
          { tipo: 'MAO_DE_OBRA', descricao: 'B', quantidade: 1, valorUnitario: 20 },
        ],
      },
      usuarioId,
    )
    const [a, b] = orc.itens
    const r = await Promise.allSettled([
      atualizarItem(a!.id, { valorUnitario: 11, version: 1 }),
      atualizarItem(b!.id, { valorUnitario: 22, version: 1 }),
    ])
    expect(r.every((x) => x.status === 'fulfilled')).toBe(true)
  })
})
