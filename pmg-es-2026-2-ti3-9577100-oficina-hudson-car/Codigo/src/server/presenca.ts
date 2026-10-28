// Presença de edição — heartbeat informativo (Sprint 3).
//
// Regras:
//  - Upsert por @@unique(recurso, recursoId, usuarioId) com atualizadoEm = now.
//  - Registros com atualizadoEm < now - PRESENCA_TTL_MS são purgados antes de retornar.
//  - Retorna PresencaApi[] (usuarioId, nome, atualizadoEm) de quem está ativo.
//  - Não bloqueia edição — apenas informa.

import { prisma } from '@/lib/db'
import { PRESENCA_TTL_MS } from '@/lib/constants'
import type { PresencaApi } from '@/lib/api'

function limiteExpiracao() {
  return new Date(Date.now() - PRESENCA_TTL_MS)
}

/// Registra/renova presença e retorna lista de presenças ativas.
export async function registrarPresenca(
  recurso: string,
  recursoId: string,
  usuarioId: string,
): Promise<PresencaApi[]> {
  const agora = new Date()

  // Upsert da presença do usuário
  await prisma.presencaEdicao.upsert({
    where: { recurso_recursoId_usuarioId: { recurso, recursoId, usuarioId } },
    update: { atualizadoEm: agora },
    create: { recurso, recursoId, usuarioId, atualizadoEm: agora },
  })

  // Purga expirados
  await prisma.presencaEdicao.deleteMany({
    where: {
      recurso,
      recursoId,
      atualizadoEm: { lt: limiteExpiracao() },
    },
  })

  return listarPresencas(recurso, recursoId)
}

/// Lista presenças ativas (purga expirados e retorna os vivos).
export async function listarPresencas(
  recurso: string,
  recursoId: string,
): Promise<PresencaApi[]> {
  // Purga expirados
  await prisma.presencaEdicao.deleteMany({
    where: {
      recurso,
      recursoId,
      atualizadoEm: { lt: limiteExpiracao() },
    },
  })

  const presencas = await prisma.presencaEdicao.findMany({
    where: { recurso, recursoId },
    include: { usuario: { select: { id: true, nome: true } } },
    orderBy: { atualizadoEm: 'desc' },
  })

  return presencas.map((p) => ({
    usuarioId: p.usuarioId,
    nome: p.usuario.nome,
    atualizadoEm: p.atualizadoEm.toISOString(),
  }))
}
