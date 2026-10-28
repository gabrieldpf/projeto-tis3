// /api/presenca — heartbeat de presença de edição (informativo, não bloqueante).
//
// POST { recurso, recursoId } → registra/renova presença, purga expirados, retorna lista ativa.
// GET  ?recurso=&recursoId=  → purga expirados e retorna lista ativa.
//
// Proteção: só exigirAutenticacao (todos os papéis operacionais).
import { comErros, ok } from '@/lib/http'
import { exigirAutenticacao } from '@/lib/rbac'
import { presencaSchema } from '@/lib/validation'
import { registrarPresenca, listarPresencas } from '@/server/presenca'

export function POST(req: Request) {
  return comErros(async () => {
    const sessao = await exigirAutenticacao()
    const dados = presencaSchema.parse(await req.json())
    const presencas = await registrarPresenca(dados.recurso, dados.recursoId, sessao.sub)
    return ok(presencas)
  })
}

export function GET(req: Request) {
  return comErros(async () => {
    await exigirAutenticacao()
    const sp = new URL(req.url).searchParams
    const recurso = sp.get('recurso') ?? ''
    const recursoId = sp.get('recursoId') ?? ''
    const presencas = await listarPresencas(recurso, recursoId)
    return ok(presencas)
  })
}
