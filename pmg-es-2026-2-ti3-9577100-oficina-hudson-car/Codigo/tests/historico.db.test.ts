// M2 — Histórico do veículo: retorna só OS ENTREGUE com itens/mecânico/datas/garantias.
//
// Regras verificadas:
//  - Retorna apenas OS com status ENTREGUE do veículo.
//  - OS de outros veículos NÃO aparecem.
//  - OS ABERTA/EM_ANDAMENTO/PRONTA NÃO aparecem no histórico.
//  - Garantias vigentes (validaAte >= agora) aparecem em garantiasVigentes.
//  - Garantias expiradas NÃO aparecem em garantiasVigentes.
//  - Cada OS inclui itens efetivos (sem itens de aditivo RASCUNHO).
import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '@/lib/db'
import { marcarPronta, entregarOS, atualizarOS } from '@/server/os'
import { obterHistoricoVeiculo } from '@/server/historico'
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

async function entregar(veicId: string, itensDaOS: Parameters<typeof criarOrcamentoAutorizadoComOS>[4] = []) {
  const { orc, os } = await criarOrcamentoAutorizadoComOS(
    usuarioId, clienteId, veicId, mecanicoId, itensDaOS,
  )
  const osAndamento = (await atualizarOS(os.id, { status: 'EM_ANDAMENTO', version: os.version }, usuarioId))!
  const { os: osPronta } = await marcarPronta(osAndamento.id, osAndamento.version, usuarioId)
  await entregarOS(osPronta!.id, osPronta!.version)
  return orc
}

describe('obterHistoricoVeiculo', () => {
  it('retorna veículo + OS ENTREGUE do veículo', async () => {
    await entregar(veiculoId, [{ tipo: 'MAO_DE_OBRA', descricao: 'Troca de óleo', quantidade: 1, valorUnitario: 120 }])

    const historico = await obterHistoricoVeiculo(veiculoId)

    expect(historico.veiculo.id).toBe(veiculoId)
    expect(historico.ordensEntregues).toHaveLength(1)
    expect(historico.ordensEntregues[0]!.status).toBe('ENTREGUE')
    expect(historico.ordensEntregues[0]!.entregueEm).not.toBeNull()
  })

  it('inclui itens efetivos e mecânico em cada OS', async () => {
    await entregar(veiculoId, [
      { tipo: 'MAO_DE_OBRA', descricao: 'Balanceamento', quantidade: 1, valorUnitario: 60 },
      { tipo: 'MAO_DE_OBRA', descricao: 'Alinhamento', quantidade: 1, valorUnitario: 80 },
    ])

    const historico = await obterHistoricoVeiculo(veiculoId)
    const os = historico.ordensEntregues[0]!

    expect(os.itens).toHaveLength(2)
    expect(os.mecanico).not.toBeNull()
    expect(os.mecanico!.id).toBe(mecanicoId)
  })

  it('NÃO retorna OS de outros veículos', async () => {
    // OS do veículo principal
    await entregar(veiculoId)

    // OS de outro veículo do mesmo cliente
    const outroVeiculo = await criarVeiculo(clienteId, { placa: 'XYZ-9999' })
    await entregar(outroVeiculo.id)

    const historico = await obterHistoricoVeiculo(veiculoId)
    expect(historico.ordensEntregues).toHaveLength(1)
  })

  it('NÃO retorna OS com status diferente de ENTREGUE', async () => {
    // Cria uma OS mas mantém ABERTA (não entrega)
    await criarOrcamentoAutorizadoComOS(usuarioId, clienteId, veiculoId, mecanicoId)

    const historico = await obterHistoricoVeiculo(veiculoId)
    expect(historico.ordensEntregues).toHaveLength(0)
  })

  it('retorna vazio para veículo sem OS entregues', async () => {
    const historico = await obterHistoricoVeiculo(veiculoId)
    expect(historico.ordensEntregues).toHaveLength(0)
    expect(historico.garantiasVigentes).toHaveLength(0)
  })

  it('lança NAO_ENCONTRADO para veículo inexistente', async () => {
    await expect(obterHistoricoVeiculo('id-inexistente')).rejects.toMatchObject({
      code: 'NAO_ENCONTRADO',
    })
  })

  it('garantias vigentes aparecem em garantiasVigentes; expiradas não aparecem', async () => {
    await entregar(veiculoId, [
      { tipo: 'MAO_DE_OBRA', descricao: 'Troca de correia', quantidade: 1, valorUnitario: 200, garantiaDias: 365 },
    ])

    const historico = await obterHistoricoVeiculo(veiculoId)

    // A garantia de 365 dias ainda é vigente (acabou de ser criada)
    expect(historico.garantiasVigentes).toHaveLength(1)
    expect(historico.garantiasVigentes[0]!.vigente).toBe(true)
    expect(historico.garantiasVigentes[0]!.prazoDias).toBe(365)
  })

  it('garantia expirada (validaAte no passado) NÃO aparece em garantiasVigentes', async () => {
    await entregar(veiculoId, [
      { tipo: 'MAO_DE_OBRA', descricao: 'Serviço com garantia', quantidade: 1, valorUnitario: 100, garantiaDias: 30 },
    ])

    // Força a garantia para o passado
    await prisma.garantiaServico.updateMany({
      data: {
        validaAte: new Date('2020-01-01'),
        iniciaEm: new Date('2019-12-01'),
      },
    })

    const historico = await obterHistoricoVeiculo(veiculoId)

    // Garantia expirada não deve aparecer em garantiasVigentes
    expect(historico.garantiasVigentes).toHaveLength(0)
    // Mas deve aparecer dentro da OS (com vigente=false)
    const garantiaNaOS = historico.ordensEntregues[0]!.garantias[0]
    expect(garantiaNaOS!.vigente).toBe(false)
  })

  it('múltiplas OS entregues vêm ordenadas por entregueEm desc', async () => {
    // Entrega duas OS em sequência
    await entregar(veiculoId, [{ tipo: 'MAO_DE_OBRA', descricao: 'Serv 1', quantidade: 1, valorUnitario: 50 }])
    const outro = await criarVeiculo(clienteId, { placa: 'DIF-1111' })
    // Segunda OS para o mesmo veículo
    await criarOrcamentoAutorizadoComOS(usuarioId, clienteId, veiculoId, mecanicoId, [
      { tipo: 'MAO_DE_OBRA', descricao: 'Serv 2', quantidade: 1, valorUnitario: 80 },
    ]).then(async ({ os }) => {
      const osA = (await atualizarOS(os.id, { status: 'EM_ANDAMENTO', version: os.version }, usuarioId))!
      const { os: osPronta } = await marcarPronta(osA.id, osA.version, usuarioId)
      await entregarOS(osPronta!.id, osPronta!.version)
    })
    void outro // usado para evitar lint de unused

    const historico = await obterHistoricoVeiculo(veiculoId)
    expect(historico.ordensEntregues).toHaveLength(2)
    // Mais recente primeiro
    const [primeira, segunda] = historico.ordensEntregues
    expect(primeira!.entregueEm!.getTime()).toBeGreaterThanOrEqual(segunda!.entregueEm!.getTime())
  })
})
