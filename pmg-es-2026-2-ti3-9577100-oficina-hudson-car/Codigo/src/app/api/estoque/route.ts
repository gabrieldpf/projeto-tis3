// GET /api/estoque — saldos atuais por peça, com sinalização de alerta.
import { prisma } from '@/lib/db'
import { comErros, ok } from '@/lib/http'
import { exigirAutenticacao } from '@/lib/rbac'

export function GET(req: Request) {
  return comErros(async () => {
    await exigirAutenticacao()
    const q = new URL(req.url).searchParams.get('q')?.trim()
    const pecas = await prisma.peca.findMany({
      where: {
        ativo: true,
        ...(q ? { OR: [{ nome: { contains: q } }, { codigo: { contains: q } }] } : {}),
      },
      include: { fornecedor: { select: { id: true, nome: true } } },
      orderBy: { nome: 'asc' },
    })
    const itens = pecas.map((p) => ({
      id: p.id,
      nome: p.nome,
      codigo: p.codigo,
      categoria: p.categoria,
      subcategoria: p.subcategoria,
      unidade: p.unidade,
      quantidadeAtual: p.quantidadeAtual,
      estoqueMinimo: p.estoqueMinimo,
      fornecedor: p.fornecedor,
      emAlerta: p.estoqueMinimo > 0 && p.quantidadeAtual <= p.estoqueMinimo,
    }))
    return ok(itens)
  })
}
