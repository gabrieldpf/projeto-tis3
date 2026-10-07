// G3 — Autorização do orçamento: enviar / autorizar / recusar; grava forma e
// data; AUTORIZADO/RECUSADO não é mais editável.
import { describe, it, expect, beforeEach } from 'vitest'
import { criarOrcamento, executarAcao, adicionarItem } from '@/server/orcamento'
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

function novoOrcamento() {
  return criarOrcamento({ clienteId, veiculoId, itens: [] }, usuarioId)
}

describe('fluxo de autorização', () => {
  it('ENVIAR leva de RASCUNHO para AGUARDANDO_AUTORIZACAO', async () => {
    const orc = await novoOrcamento()
    const r = await executarAcao(orc.id, { acao: 'ENVIAR', version: orc.version })
    expect(r?.status).toBe('AGUARDANDO_AUTORIZACAO')
  })

  it('AUTORIZAR exige forma e grava forma + data', async () => {
    const orc = await novoOrcamento()
    const enviado = await executarAcao(orc.id, { acao: 'ENVIAR', version: orc.version })
    // sem forma → erro
    await expect(
      executarAcao(orc.id, { acao: 'AUTORIZAR', version: enviado!.version }),
    ).rejects.toMatchObject({ code: 'DADOS_INVALIDOS' })
    // com forma → autorizado
    const aut = await executarAcao(orc.id, { acao: 'AUTORIZAR', formaAutorizacao: 'TELEFONE', version: enviado!.version })
    expect(aut?.status).toBe('AUTORIZADO')
    expect(aut?.formaAutorizacao).toBe('TELEFONE')
    expect(aut?.autorizadoEm).toBeTruthy()
  })

  it('RECUSAR marca como RECUSADO', async () => {
    const orc = await novoOrcamento()
    const r = await executarAcao(orc.id, { acao: 'RECUSAR', version: orc.version })
    expect(r?.status).toBe('RECUSADO')
  })

  it('orçamento AUTORIZADO não aceita mais itens (não editável)', async () => {
    const orc = await novoOrcamento()
    const aut = await executarAcao(orc.id, { acao: 'AUTORIZAR', formaAutorizacao: 'PRESENCIAL', version: orc.version })
    expect(aut?.status).toBe('AUTORIZADO')
    await expect(
      adicionarItem(orc.id, { tipo: 'MAO_DE_OBRA', descricao: 'tarde demais', quantidade: 1, valorUnitario: 10 }),
    ).rejects.toMatchObject({ code: 'DADOS_INVALIDOS' })
  })
})
