// /api/pecas — busca/listagem (GET) e criação (POST).
//
// Busca combinável (a maior dor do cliente): por nome/código (q), por CHASSI
// compatível (chassi) e por categoria. A busca por chassi evita comprar/
// instalar a peça errada — prioridade nº 2 do projeto.
import { prisma } from '@/lib/db'
import { comErros, ok } from '@/lib/http'
import { exigirAutenticacao } from '@/lib/rbac'
import { pecaCreateSchema } from '@/lib/validation'
import type { Prisma } from '@prisma/client'

export function GET(req: Request) {
  return comErros(async () => {
    await exigirAutenticacao()
    const sp = new URL(req.url).searchParams
    const q = sp.get('q')?.trim()
    const chassi = sp.get('chassi')?.trim()
    const categoria = sp.get('categoria')?.trim()

    const where: Prisma.PecaWhereInput = { ativo: true }
    if (q) {
      where.OR = [{ nome: { contains: q } }, { codigo: { contains: q } }]
    }
    if (categoria) where.categoria = categoria
    if (chassi) {
      where.chassisCompativeis = { some: { chassi: { contains: chassi } } }
    }

    const pecas = await prisma.peca.findMany({
      where,
      include: { fornecedor: true, chassisCompativeis: true },
      orderBy: { nome: 'asc' },
    })
    return ok(pecas)
  })
}

export function POST(req: Request) {
  return comErros(async () => {
    const sessao = await exigirAutenticacao()
    const dados = pecaCreateSchema.parse(await req.json())
    const { quantidadeInicial, chassisCompativeis, ...resto } = dados

    const peca = await prisma.peca.create({
      data: {
        ...resto,
        fornecedorId: resto.fornecedorId || null,
        codigo: resto.codigo || null,
        quantidadeAtual: quantidadeInicial,
        precoDiaAtualizadoPorId: sessao.sub,
        precoDiaAtualizadoEm: new Date(),
        chassisCompativeis: chassisCompativeis?.length
          ? { create: chassisCompativeis }
          : undefined,
        // Saldo inicial rastreável, se houver.
        movimentacoes: quantidadeInicial > 0
          ? {
              create: {
                tipo: 'ENTRADA',
                quantidade: quantidadeInicial,
                saldoResultante: quantidadeInicial,
                motivo: 'Saldo inicial do cadastro',
                usuarioId: sessao.sub,
              },
            }
          : undefined,
      },
      include: { fornecedor: true, chassisCompativeis: true },
    })
    return ok(peca, 201)
  })
}
