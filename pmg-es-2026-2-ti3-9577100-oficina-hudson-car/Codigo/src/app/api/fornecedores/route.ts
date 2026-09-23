// /api/fornecedores — lista (GET) e cria (POST).
import { prisma } from '@/lib/db'
import { comErros, ok } from '@/lib/http'
import { exigirAutenticacao } from '@/lib/rbac'
import { fornecedorCreateSchema } from '@/lib/validation'

export function GET(req: Request) {
  return comErros(async () => {
    await exigirAutenticacao()
    const q = new URL(req.url).searchParams.get('q')?.trim()
    const fornecedores = await prisma.fornecedor.findMany({
      where: {
        ativo: true,
        ...(q
          ? { OR: [{ nome: { contains: q } }, { categoria: { contains: q } }] }
          : {}),
      },
      orderBy: { nome: 'asc' },
    })
    return ok(fornecedores)
  })
}

export function POST(req: Request) {
  return comErros(async () => {
    await exigirAutenticacao()
    const dados = fornecedorCreateSchema.parse(await req.json())
    const fornecedor = await prisma.fornecedor.create({
      data: { ...dados, email: dados.email || null },
    })
    return ok(fornecedor, 201)
  })
}
