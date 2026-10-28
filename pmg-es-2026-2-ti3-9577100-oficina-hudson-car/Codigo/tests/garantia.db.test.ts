// M1 — Garantia: entregarOS gera GarantiaServico; idempotência; só itens com garantiaDias.
//
// Regras verificadas:
//  - entregarOS gera GarantiaServico para cada item efetivo com garantiaDias > 0.
//  - validaAte ≈ entregueEm + prazoDias (dentro de 1s de tolerância de clock).
//  - Itens sem garantiaDias (null ou 0) NÃO geram garantia.
//  - Idempotência: chamar gerarGarantiasDaOS duas vezes não duplica os registros.
//  - Itens de aditivo AUTORIZADO com garantia também são incluídos; RASCUNHO não.
import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '@/lib/db'
import { marcarPronta, entregarOS, atualizarOS } from '@/server/os'
import { gerarGarantiasDaOS } from '@/server/garantia'
import { criarAditivo, adicionarItemAditivo, executarAcaoAditivo } from '@/server/aditivo'
import {
  limparTudo,
  criarUsuario,
  criarCliente,
  criarVeiculo,
  criarMecanico,
  criarOrcamentoAutorizadoComOS,
} from './helpers'

let usuarioId: string
let clienteId: string
let veiculoId: string
let mecanicoId: string

beforeEach(async () => {
  await limparTudo()
  usuarioId = (await criarUsuario()).id
  clienteId = (await criarCliente()).id
  veiculoId = (await criarVeiculo(clienteId)).id
  mecanicoId = (await criarMecanico()).id
})

async function levarOSAteEntregue(itens: Parameters<typeof criarOrcamentoAutorizadoComOS>[4]) {
  const { os } = await criarOrcamentoAutorizadoComOS(
    usuarioId, clienteId, veiculoId, mecanicoId, itens,
  )
  const osAndamento = (await atualizarOS(os.id, { status: 'EM_ANDAMENTO', version: os.version }, usuarioId))!
  const { os: osPronta } = await marcarPronta(osAndamento.id, osAndamento.version, usuarioId)
  return entregarOS(osPronta!.id, osPronta!.version)
}

describe('entregarOS — geração de garantias', () => {
  it('gera GarantiaServico com validaAte = entregueEm + garantiaDias', async () => {
    const { os: osEntregue, garantias } = await levarOSAteEntregue([
      { tipo: 'MAO_DE_OBRA', descricao: 'Troca de correia', quantidade: 1, valorUnitario: 200, garantiaDias: 180 },
    ])

    expect(garantias).toHaveLength(1)
    const g = garantias[0]!
    expect(g.descricao).toBe('Troca de correia')
    expect(g.prazoDias).toBe(180)
    expect(g.ordemServicoId).toBe(osEntregue!.id)

    // validaAte deve ser aproximadamente entregueEm + 180 dias
    const entregueEm = osEntregue!.entregueEm!
    const validaAteEsperado = new Date(entregueEm)
    validaAteEsperado.setDate(validaAteEsperado.getDate() + 180)
    const diffMs = Math.abs(g.validaAte.getTime() - validaAteEsperado.getTime())
    expect(diffMs).toBeLessThan(1000) // menos de 1s de diferença
  })

  it('item sem garantiaDias NÃO gera garantia', async () => {
    const { garantias } = await levarOSAteEntregue([
      { tipo: 'MAO_DE_OBRA', descricao: 'Lavagem', quantidade: 1, valorUnitario: 50 },
    ])

    expect(garantias).toHaveLength(0)
  })

  it('garantiaDias=0 NÃO gera garantia', async () => {
    const { garantias } = await levarOSAteEntregue([
      { tipo: 'MAO_DE_OBRA', descricao: 'Alinhamento', quantidade: 1, valorUnitario: 80, garantiaDias: 0 },
    ])

    expect(garantias).toHaveLength(0)
  })

  it('itens mistos: só os com garantiaDias > 0 geram garantia', async () => {
    const { garantias } = await levarOSAteEntregue([
      { tipo: 'MAO_DE_OBRA', descricao: 'Troca de pastilha', quantidade: 1, valorUnitario: 120, garantiaDias: 90 },
      { tipo: 'MAO_DE_OBRA', descricao: 'Lavagem completa', quantidade: 1, valorUnitario: 40 }, // sem garantia
    ])

    expect(garantias).toHaveLength(1)
    expect(garantias[0]!.prazoDias).toBe(90)
  })
})

describe('idempotência de gerarGarantiasDaOS', () => {
  it('chamar gerarGarantiasDaOS duas vezes não duplica registros', async () => {
    const { os: osEntregue } = await levarOSAteEntregue([
      { tipo: 'MAO_DE_OBRA', descricao: 'Troca de amortecedor', quantidade: 1, valorUnitario: 350, garantiaDias: 365 },
    ])

    const entregueEm = osEntregue!.entregueEm!

    // Segunda chamada — deve ser idempotente
    const garantias2 = await prisma.$transaction((tx) =>
      gerarGarantiasDaOS(tx, osEntregue!.id, entregueEm),
    )

    // Deve existir apenas UMA garantia no banco (não duplicou)
    const total = await prisma.garantiaServico.count({ where: { ordemServicoId: osEntregue!.id } })
    expect(total).toBe(1)
    expect(garantias2).toHaveLength(1)
  })
})

describe('garantias de itens de aditivo', () => {
  it('item de aditivo AUTORIZADO com garantiaDias gera garantia na entrega', async () => {
    const { orc, os } = await criarOrcamentoAutorizadoComOS(
      usuarioId, clienteId, veiculoId, mecanicoId,
      [{ tipo: 'MAO_DE_OBRA', descricao: 'Revisão', quantidade: 1, valorUnitario: 100 }],
    )

    // Cria aditivo AUTORIZADO com item que tem garantia
    const aditivo = await criarAditivo({ orcamentoId: orc.id }, usuarioId)
    await adicionarItemAditivo(aditivo.id, {
      tipo: 'MAO_DE_OBRA',
      descricao: 'Troca de fluido de freio',
      quantidade: 1,
      valorUnitario: 80,
      garantiaDias: 120,
    })
    const aditivoAtualizado = await prisma.aditivoOrcamento.findUniqueOrThrow({ where: { id: aditivo.id } })
    await executarAcaoAditivo(
      aditivo.id,
      { acao: 'AUTORIZAR', formaAutorizacao: 'PRESENCIAL', version: aditivoAtualizado.version },
      usuarioId,
    )

    const osAndamento = (await atualizarOS(os.id, { status: 'EM_ANDAMENTO', version: os.version }, usuarioId))!
    const { os: osPronta } = await marcarPronta(osAndamento.id, osAndamento.version, usuarioId)
    const { garantias } = await entregarOS(osPronta!.id, osPronta!.version)

    // Deve ter gerado a garantia do item de aditivo AUTORIZADO
    const garantiaAditivo = garantias.find((g) => g.descricao === 'Troca de fluido de freio')
    expect(garantiaAditivo).toBeDefined()
    expect(garantiaAditivo!.prazoDias).toBe(120)
  })

  it('item de aditivo RASCUNHO NÃO gera garantia na entrega', async () => {
    const { orc, os } = await criarOrcamentoAutorizadoComOS(
      usuarioId, clienteId, veiculoId, mecanicoId,
      [{ tipo: 'MAO_DE_OBRA', descricao: 'Revisão', quantidade: 1, valorUnitario: 100, garantiaDias: 60 }],
    )

    // Aditivo em RASCUNHO com item de garantia — não deve ser incluído
    const aditivo = await criarAditivo({ orcamentoId: orc.id }, usuarioId)
    await adicionarItemAditivo(aditivo.id, {
      tipo: 'MAO_DE_OBRA',
      descricao: 'Polimento (aditivo rascunho)',
      quantidade: 1,
      valorUnitario: 200,
      garantiaDias: 30,
    })

    const osAndamento = (await atualizarOS(os.id, { status: 'EM_ANDAMENTO', version: os.version }, usuarioId))!
    const { os: osPronta } = await marcarPronta(osAndamento.id, osAndamento.version, usuarioId)
    const { garantias } = await entregarOS(osPronta!.id, osPronta!.version)

    // Somente o item do orçamento base (garantiaDias=60) deve gerar garantia
    expect(garantias).toHaveLength(1)
    expect(garantias[0]!.descricao).toBe('Revisão')
  })
})
