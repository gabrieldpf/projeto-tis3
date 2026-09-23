// GET /api/auth/me — retorna o usuário da sessão atual (ou 401).
import { comErros, ok } from '@/lib/http'
import { exigirAutenticacao } from '@/lib/rbac'

export function GET() {
  return comErros(async () => {
    const sessao = await exigirAutenticacao()
    return ok({
      id: sessao.sub,
      nome: sessao.nome,
      cargo: sessao.cargo,
      papel: sessao.papel,
    })
  })
}
