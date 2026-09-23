// POST /api/auth/logout — encerra a sessão (remove o cookie).
import { destruirSessao } from '@/lib/auth'
import { comErros, ok } from '@/lib/http'

export function POST() {
  return comErros(async () => {
    destruirSessao()
    return ok({ ok: true })
  })
}
