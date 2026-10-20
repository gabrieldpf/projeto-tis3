// GET /api/relatorios — relatório financeiro (ADMIN/financeiro).
// Exige papel com acesso financeiro (regra de ouro nº 2).
// Parâmetros opcionais: ?de=yyyy-mm-dd&ate=yyyy-mm-dd (atualmente usados para
// documentação; a lógica interna opera sobre os últimos 6 meses).
import { comErros, ok } from '@/lib/http'
import { exigirFinanceiro } from '@/lib/rbac'
import { relatorioQuerySchema } from '@/lib/validation'
import { obterRelatorioFinanceiro } from '@/server/relatorios'

export function GET(req: Request) {
  return comErros(async () => {
    await exigirFinanceiro()
    const sp = new URL(req.url).searchParams
    const params = relatorioQuerySchema.parse({
      de: sp.get('de') ?? undefined,
      ate: sp.get('ate') ?? undefined,
    })
    const relatorio = await obterRelatorioFinanceiro(params)
    return ok(relatorio)
  })
}
