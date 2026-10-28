// L3 — Aditivo: criação restrita, número sequencial, cópia de preço, conflito por version.
//
// Regras verificadas:
//  - Aditivo só pode ser criado se a OS NÃO estiver PRONTA ou ENTREGUE.
//  - Número do aditivo é sequencial por orçamento (1, 2, 3…).
//  - Item de peça copia o preço do dia no momento da inserção.
//  - Editar um item com version antiga → ApiError CONFLITO.
import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '@/lib/db'
import { marcarPronta, atualizarOS } from '@/server/os'
import { criarAditivo, adicionarItemAditivo, atualizarItemAditivo } from '@/server/aditivo'
import {
  limparTudo,
  criarUsuario,
  criarCliente,
  criarVeiculo,
  criarMecanico,
  criarPeca,
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

describe('criarAditivo', () => {
  it('cria aditivo em RASCUNHO para OS não PRONTA/ENTREGUE', async () => {
    const { orc, os } = await criarOrcamentoAutorizadoComOS(
      usuarioId, clienteId, veiculoId, mecanicoId,
    )
    // OS está ABERTA — aditivo deve ser criado normalmente
    const aditivo = await criarAditivo({ orcamentoId: orc.id }, usuarioId)
    expect(aditivo.status).toBe('RASCUNHO')
    expect(aditivo.orcamentoId).toBe(orc.id)
    expect(aditivo.criadoPorId).toBe(usuarioId)
    void os // referência usada somente para garantir setup
  })

  it('numero é sequencial por orçamento (1, 2, 3…)', async () => {
    const { orc } = await criarOrcamentoAutorizadoComOS(
      usuarioId, clienteId, veiculoId, mecanicoId,
    )
    const a1 = await criarAditivo({ orcamentoId: orc.id }, usuarioId)
    const a2 = await criarAditivo({ orcamentoId: orc.id }, usuarioId)
    const a3 = await criarAditivo({ orcamentoId: orc.id }, usuarioId)

    expect(a1.numero).toBe(1)
    expect(a2.numero).toBe(2)
    expect(a3.numero).toBe(3)
  })

  it('recusa criação de aditivo em OS PRONTA', async () => {
    const { orc, os } = await criarOrcamentoAutorizadoComOS(
      usuarioId, clienteId, veiculoId, mecanicoId,
    )
    // Avança para EM_ANDAMENTO e depois PRONTA
    const osAndamento = (await atualizarOS(os.id, { status: 'EM_ANDAMENTO', version: os.version }, usuarioId))!
    await marcarPronta(osAndamento.id, osAndamento.version, usuarioId)

    await expect(
      criarAditivo({ orcamentoId: orc.id }, usuarioId),
    ).rejects.toMatchObject({ code: 'DADOS_INVALIDOS' })
  })

  it('recusa criação de aditivo sem OS associada ao orçamento', async () => {
    // Cria orçamento autorizado mas SEM criar a OS
    const { criarOrcamento, executarAcao } = await import('@/server/orcamento')
    const orc = await criarOrcamento({ clienteId, veiculoId, itens: [] }, usuarioId)
    await executarAcao(orc.id, { acao: 'AUTORIZAR', formaAutorizacao: 'PRESENCIAL', version: orc.version })

    await expect(
      criarAditivo({ orcamentoId: orc.id }, usuarioId),
    ).rejects.toMatchObject({ code: 'DADOS_INVALIDOS' })
  })
})

describe('adicionarItemAditivo', () => {
  it('item de peça copia o preço do dia no momento da inserção', async () => {
    const peca = await criarPeca({ precoDia: 77.5 })
    const { orc } = await criarOrcamentoAutorizadoComOS(
      usuarioId, clienteId, veiculoId, mecanicoId,
    )
    const aditivo = await criarAditivo({ orcamentoId: orc.id }, usuarioId)

    const item = await adicionarItemAditivo(aditivo.id, {
      tipo: 'PECA',
      pecaId: peca.id,
      descricao: '',
      quantidade: 2,
      valorUnitario: 0, // zero → deve usar precoDia
    })

    expect(item.valorUnitario).toBe(77.5) // copiou o precoDia
    expect(item.descricao).toBe(peca.nome)  // copiou o nome

    // Mudar precoDia depois não afeta o item já inserido
    await prisma.peca.update({ where: { id: peca.id }, data: { precoDia: 999 } })
    const recarregado = await prisma.itemOrcamento.findUniqueOrThrow({ where: { id: item.id } })
    expect(recarregado.valorUnitario).toBe(77.5)
  })

  it('item de mão de obra usa o valor informado', async () => {
    const { orc } = await criarOrcamentoAutorizadoComOS(
      usuarioId, clienteId, veiculoId, mecanicoId,
    )
    const aditivo = await criarAditivo({ orcamentoId: orc.id }, usuarioId)

    const item = await adicionarItemAditivo(aditivo.id, {
      tipo: 'MAO_DE_OBRA',
      descricao: 'Diagnóstico eletrônico',
      quantidade: 1,
      valorUnitario: 150,
    })

    expect(item.valorUnitario).toBe(150)
    expect(item.tipo).toBe('MAO_DE_OBRA')
  })
})

describe('atualizarItemAditivo', () => {
  it('edição com version correta atualiza o item', async () => {
    const { orc } = await criarOrcamentoAutorizadoComOS(
      usuarioId, clienteId, veiculoId, mecanicoId,
    )
    const aditivo = await criarAditivo({ orcamentoId: orc.id }, usuarioId)
    const item = await adicionarItemAditivo(aditivo.id, {
      tipo: 'MAO_DE_OBRA',
      descricao: 'Troca de pastilha',
      quantidade: 1,
      valorUnitario: 90,
    })

    const atualizado = await atualizarItemAditivo(item.id, {
      valorUnitario: 120,
      version: item.version,
    })

    expect(atualizado!.valorUnitario).toBe(120)
  })

  it('edição com version velha lança CONFLITO', async () => {
    const { orc } = await criarOrcamentoAutorizadoComOS(
      usuarioId, clienteId, veiculoId, mecanicoId,
    )
    const aditivo = await criarAditivo({ orcamentoId: orc.id }, usuarioId)
    const item = await adicionarItemAditivo(aditivo.id, {
      tipo: 'MAO_DE_OBRA',
      descricao: 'Balanceamento',
      quantidade: 1,
      valorUnitario: 60,
    })

    // Primeira edição bem-sucedida (avança a version)
    await atualizarItemAditivo(item.id, { valorUnitario: 70, version: item.version })

    // Segunda edição com a versão original (já obsoleta)
    await expect(
      atualizarItemAditivo(item.id, { valorUnitario: 80, version: item.version }),
    ).rejects.toMatchObject({ code: 'CONFLITO' })
  })
})
