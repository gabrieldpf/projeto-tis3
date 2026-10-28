// L4 — Autorização de aditivo: AUTORIZAR grava campos de auditoria, controle
// otimista e imutabilidade pós-finalização.
//
// Regras verificadas:
//  - AUTORIZAR grava formaAutorizacao, autorizadoEm e registradoPorId.
//  - version antiga → CONFLITO ao tentar executar ação.
//  - Aditivo AUTORIZADO ou RECUSADO não aceita mais edição.
import { describe, it, expect, beforeEach } from 'vitest'
import { criarAditivo, executarAcaoAditivo, atualizarCabecalhoAditivo } from '@/server/aditivo'
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

async function aditivoEmRascunho() {
  const { orc } = await criarOrcamentoAutorizadoComOS(
    usuarioId, clienteId, veiculoId, mecanicoId,
  )
  return criarAditivo({ orcamentoId: orc.id }, usuarioId)
}

describe('executarAcaoAditivo — AUTORIZAR', () => {
  it('grava formaAutorizacao, autorizadoEm e registradoPorId', async () => {
    const aditivo = await aditivoEmRascunho()

    const autorizado = await executarAcaoAditivo(
      aditivo.id,
      { acao: 'AUTORIZAR', formaAutorizacao: 'WHATSAPP', version: aditivo.version },
      usuarioId,
    )

    expect(autorizado!.status).toBe('AUTORIZADO')
    expect(autorizado!.formaAutorizacao).toBe('WHATSAPP')
    expect(autorizado!.autorizadoEm).not.toBeNull()
    expect(autorizado!.registradoPorId).toBe(usuarioId)
  })

  it('AUTORIZAR sem formaAutorizacao → DADOS_INVALIDOS', async () => {
    const aditivo = await aditivoEmRascunho()

    await expect(
      executarAcaoAditivo(
        aditivo.id,
        { acao: 'AUTORIZAR', version: aditivo.version },
        usuarioId,
      ),
    ).rejects.toMatchObject({ code: 'DADOS_INVALIDOS' })
  })

  it('version antiga ao AUTORIZAR → CONFLITO', async () => {
    const aditivo = await aditivoEmRascunho()

    // Avança a version via ENVIAR
    await executarAcaoAditivo(
      aditivo.id,
      { acao: 'ENVIAR', version: aditivo.version },
      usuarioId,
    )

    // Tenta AUTORIZAR com a version original (já obsoleta)
    await expect(
      executarAcaoAditivo(
        aditivo.id,
        { acao: 'AUTORIZAR', formaAutorizacao: 'PRESENCIAL', version: aditivo.version },
        usuarioId,
      ),
    ).rejects.toMatchObject({ code: 'CONFLITO' })
  })
})

describe('executarAcaoAditivo — RECUSAR', () => {
  it('recusa o aditivo e grava registradoPorId', async () => {
    const aditivo = await aditivoEmRascunho()

    const recusado = await executarAcaoAditivo(
      aditivo.id,
      { acao: 'RECUSAR', version: aditivo.version },
      usuarioId,
    )

    expect(recusado!.status).toBe('RECUSADO')
    expect(recusado!.registradoPorId).toBe(usuarioId)
  })
})

describe('imutabilidade pós-finalização', () => {
  it('aditivo AUTORIZADO não aceita edição de cabeçalho', async () => {
    const aditivo = await aditivoEmRascunho()
    const autorizado = await executarAcaoAditivo(
      aditivo.id,
      { acao: 'AUTORIZAR', formaAutorizacao: 'TELEFONE', version: aditivo.version },
      usuarioId,
    )

    await expect(
      atualizarCabecalhoAditivo(autorizado!.id, { observacao: 'tentando editar', version: autorizado!.version }),
    ).rejects.toMatchObject({ code: 'DADOS_INVALIDOS' })
  })

  it('aditivo RECUSADO não aceita nova ação', async () => {
    const aditivo = await aditivoEmRascunho()
    const recusado = await executarAcaoAditivo(
      aditivo.id,
      { acao: 'RECUSAR', version: aditivo.version },
      usuarioId,
    )

    await expect(
      executarAcaoAditivo(
        recusado!.id,
        { acao: 'AUTORIZAR', formaAutorizacao: 'PRESENCIAL', version: recusado!.version },
        usuarioId,
      ),
    ).rejects.toMatchObject({ code: 'DADOS_INVALIDOS' })
  })

  it('aditivo AUTORIZADO não aceita nova ação', async () => {
    const aditivo = await aditivoEmRascunho()
    const autorizado = await executarAcaoAditivo(
      aditivo.id,
      { acao: 'AUTORIZAR', formaAutorizacao: 'PRESENCIAL', version: aditivo.version },
      usuarioId,
    )

    await expect(
      executarAcaoAditivo(
        autorizado!.id,
        { acao: 'RECUSAR', version: autorizado!.version },
        usuarioId,
      ),
    ).rejects.toMatchObject({ code: 'DADOS_INVALIDOS' })
  })
})

describe('fluxo RASCUNHO → AGUARDANDO → AUTORIZADO', () => {
  it('ENVIAR move de RASCUNHO para AGUARDANDO_AUTORIZACAO', async () => {
    const aditivo = await aditivoEmRascunho()

    const enviado = await executarAcaoAditivo(
      aditivo.id,
      { acao: 'ENVIAR', version: aditivo.version },
      usuarioId,
    )

    expect(enviado!.status).toBe('AGUARDANDO_AUTORIZACAO')
  })

  it('AGUARDANDO_AUTORIZACAO pode ser diretamente AUTORIZADO', async () => {
    const aditivo = await aditivoEmRascunho()
    const enviado = await executarAcaoAditivo(
      aditivo.id,
      { acao: 'ENVIAR', version: aditivo.version },
      usuarioId,
    )

    const autorizado = await executarAcaoAditivo(
      enviado!.id,
      { acao: 'AUTORIZAR', formaAutorizacao: 'PRESENCIAL', version: enviado!.version },
      usuarioId,
    )

    expect(autorizado!.status).toBe('AUTORIZADO')
  })
})
