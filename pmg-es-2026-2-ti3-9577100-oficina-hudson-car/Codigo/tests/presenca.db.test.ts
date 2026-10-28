// M3 — Presença de edição: heartbeat faz upsert; TTL purga expirados; lista ativos.
//
// Regras verificadas:
//  - registrarPresenca faz upsert: chamadas múltiplas do mesmo usuário
//    NÃO criam registros duplicados (@@unique recurso+recursoId+usuarioId).
//  - Registros com atualizadoEm além do TTL são purgados antes de retornar.
//  - Lista retorna apenas quem está ativo (não expirado).
//  - Múltiplos usuários no mesmo recurso → cada um aparece na lista.
import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '@/lib/db'
import { PRESENCA_TTL_MS } from '@/lib/constants'
import { registrarPresenca, listarPresencas } from '@/server/presenca'
import { limparTudo, criarUsuario } from './helpers'

let usuarioId: string

beforeEach(async () => {
  await limparTudo()
  usuarioId = (await criarUsuario()).id
})

describe('registrarPresenca — upsert', () => {
  it('múltiplas chamadas do mesmo usuário NÃO criam registros duplicados', async () => {
    await registrarPresenca('ORCAMENTO', 'orc-001', usuarioId)
    await registrarPresenca('ORCAMENTO', 'orc-001', usuarioId)
    await registrarPresenca('ORCAMENTO', 'orc-001', usuarioId)

    const total = await prisma.presencaEdicao.count({
      where: { recurso: 'ORCAMENTO', recursoId: 'orc-001', usuarioId },
    })
    expect(total).toBe(1)
  })

  it('retorna lista com o usuário ativo após heartbeat', async () => {
    const presencas = await registrarPresenca('ORCAMENTO', 'orc-001', usuarioId)
    expect(presencas).toHaveLength(1)
    expect(presencas[0]!.usuarioId).toBe(usuarioId)
  })

  it('múltiplos usuários no mesmo recurso aparecem na lista', async () => {
    const usuario2 = await criarUsuario({ email: 'outro@test.local' })

    await registrarPresenca('ORCAMENTO', 'orc-001', usuarioId)
    const presencas = await registrarPresenca('ORCAMENTO', 'orc-001', usuario2.id)

    expect(presencas).toHaveLength(2)
    const ids = presencas.map((p) => p.usuarioId)
    expect(ids).toContain(usuarioId)
    expect(ids).toContain(usuario2.id)
  })

  it('presença em recurso diferente não interfere', async () => {
    await registrarPresenca('ORCAMENTO', 'orc-001', usuarioId)
    await registrarPresenca('ADITIVO', 'adt-001', usuarioId)

    const presencasOrc = await listarPresencas('ORCAMENTO', 'orc-001')
    const presencasAdt = await listarPresencas('ADITIVO', 'adt-001')

    expect(presencasOrc).toHaveLength(1)
    expect(presencasAdt).toHaveLength(1)
  })
})

describe('purga por TTL', () => {
  it('registros com atualizadoEm além do TTL são removidos antes de retornar', async () => {
    // Registra presença diretamente no banco com timestamp expirado
    const expirado = new Date(Date.now() - PRESENCA_TTL_MS - 10_000)
    await prisma.presencaEdicao.create({
      data: {
        recurso: 'ORCAMENTO',
        recursoId: 'orc-002',
        usuarioId,
        atualizadoEm: expirado,
      },
    })

    // Ao listar, o registro expirado deve ser purgado
    const presencas = await listarPresencas('ORCAMENTO', 'orc-002')
    expect(presencas).toHaveLength(0)

    // Confirmação no banco
    const total = await prisma.presencaEdicao.count({
      where: { recurso: 'ORCAMENTO', recursoId: 'orc-002' },
    })
    expect(total).toBe(0)
  })

  it('registro recente (dentro do TTL) sobrevive à purga', async () => {
    // Registra presença recente via função
    await registrarPresenca('ORCAMENTO', 'orc-003', usuarioId)

    // Ao listar, deve retornar o registro vivo
    const presencas = await listarPresencas('ORCAMENTO', 'orc-003')
    expect(presencas).toHaveLength(1)
  })

  it('mistura expirado+ativo: só o ativo sobrevive', async () => {
    const usuario2 = await criarUsuario({ email: 'user2@test.local' })

    // usuario2 com presença expirada
    const expirado = new Date(Date.now() - PRESENCA_TTL_MS - 5_000)
    await prisma.presencaEdicao.create({
      data: {
        recurso: 'ORCAMENTO',
        recursoId: 'orc-004',
        usuarioId: usuario2.id,
        atualizadoEm: expirado,
      },
    })
    // usuarioId com presença ativa
    await registrarPresenca('ORCAMENTO', 'orc-004', usuarioId)

    const presencas = await listarPresencas('ORCAMENTO', 'orc-004')
    expect(presencas).toHaveLength(1)
    expect(presencas[0]!.usuarioId).toBe(usuarioId)
  })
})

describe('listarPresencas', () => {
  it('retorna lista vazia quando não há presença ativa', async () => {
    const presencas = await listarPresencas('ORCAMENTO', 'nenhum')
    expect(presencas).toHaveLength(0)
  })

  it('retorna nome do usuário em cada presença', async () => {
    await registrarPresenca('ADITIVO', 'adt-005', usuarioId)
    const presencas = await listarPresencas('ADITIVO', 'adt-005')
    expect(presencas[0]!.nome).toBe('Admin')
    expect(typeof presencas[0]!.atualizadoEm).toBe('string') // ISO string
  })
})
