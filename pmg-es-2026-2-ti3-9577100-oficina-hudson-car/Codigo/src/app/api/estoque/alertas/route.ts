// GET /api/estoque/alertas — peças abaixo (ou no limite) do estoque mínimo.
// Alimenta o painel de "alertas de compra" (prioridade nº 3 do cliente).
import { comErros, ok } from '@/lib/http'
import { exigirAutenticacao } from '@/lib/rbac'
import { listarAlertasCompra } from '@/server/estoque'

export function GET() {
  return comErros(async () => {
    await exigirAutenticacao()
    const alertas = await listarAlertasCompra()
    return ok(
      alertas.map((p) => ({
        id: p.id,
        nome: p.nome,
        codigo: p.codigo,
        unidade: p.unidade,
        quantidadeAtual: p.quantidadeAtual,
        estoqueMinimo: p.estoqueMinimo,
        faltam: p.faltam,
        fornecedor: p.fornecedor ? { id: p.fornecedor.id, nome: p.fornecedor.nome } : null,
      })),
    )
  })
}
