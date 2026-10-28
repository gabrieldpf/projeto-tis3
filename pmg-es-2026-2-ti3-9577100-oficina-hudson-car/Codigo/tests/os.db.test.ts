// G4 — Ordem de serviço: só de orçamento AUTORIZADO, 1 por orçamento, mecânico
// obrigatório/ativo, transições de status válidas (ENTREGUE grava data).
import { describe, it, expect, beforeEach } from 'vitest'
import { criarOrcamento, executarAcao } from '@/server/orcamento'
import { criarOS, atualizarOS, marcarPronta, entregarOS } from '@/server/os'
import { limparTudo, criarUsuario, criarCliente, criarVeiculo, criarMecanico } from './helpers'

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

async function orcamentoAutorizado() {
  const orc = await criarOrcamento({ clienteId, veiculoId, itens: [] }, usuarioId)
  await executarAcao(orc.id, { acao: 'AUTORIZAR', formaAutorizacao: 'PRESENCIAL', version: orc.version })
  return orc
}

describe('criarOS', () => {
  it('recusa OS de orçamento NÃO autorizado', async () => {
    const orc = await criarOrcamento({ clienteId, veiculoId, itens: [] }, usuarioId)
    await expect(criarOS({ orcamentoId: orc.id, mecanicoId })).rejects.toMatchObject({ code: 'DADOS_INVALIDOS' })
  })

  it('cria OS de orçamento autorizado, copiando cliente/veículo', async () => {
    const orc = await orcamentoAutorizado()
    const os = await criarOS({ orcamentoId: orc.id, mecanicoId })
    expect(os.numero).toMatch(/^OS-\d{4}-0001$/)
    expect(os.clienteId).toBe(clienteId)
    expect(os.veiculoId).toBe(veiculoId)
    expect(os.status).toBe('ABERTA')
  })

  it('não permite 2 OS para o mesmo orçamento', async () => {
    const orc = await orcamentoAutorizado()
    await criarOS({ orcamentoId: orc.id, mecanicoId })
    await expect(criarOS({ orcamentoId: orc.id, mecanicoId })).rejects.toMatchObject({ code: 'CONFLITO' })
  })

  it('exige mecânico válido/ativo', async () => {
    const orc = await orcamentoAutorizado()
    await expect(criarOS({ orcamentoId: orc.id, mecanicoId: 'inexistente' })).rejects.toMatchObject({
      code: 'DADOS_INVALIDOS',
    })
  })
})

describe('atualizarOS (transições)', () => {
  it('bloqueia transição inválida via atualizarOS (ABERTA → ENTREGUE)', async () => {
    const orc = await orcamentoAutorizado()
    const os = await criarOS({ orcamentoId: orc.id, mecanicoId })
    // ENTREGUE é bloqueado diretamente pelo atualizarOS (usa endpoint dedicado)
    await expect(atualizarOS(os.id, { status: 'ENTREGUE', version: os.version })).rejects.toMatchObject({
      code: 'DADOS_INVALIDOS',
    })
  })

  it('percorre o fluxo até ENTREGUE usando os endpoints dedicados (marcarPronta/entregarOS)', async () => {
    const orc = await orcamentoAutorizado()
    let os = await criarOS({ orcamentoId: orc.id, mecanicoId })
    os = (await atualizarOS(os.id, { status: 'EM_ANDAMENTO', version: os.version }, usuarioId))!
    const { os: osPronta } = await marcarPronta(os.id, os.version, usuarioId)
    const { os: osEntregue } = await entregarOS(osPronta!.id, osPronta!.version)
    expect(osEntregue!.status).toBe('ENTREGUE')
    expect(osEntregue!.entregueEm).toBeTruthy()
  })
})
