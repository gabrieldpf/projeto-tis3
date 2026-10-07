// /api/mecanicos — lista (GET) e criação (POST).
// Mecânicos não usam o sistema; só são atribuídos à OS como responsável.
import { prisma } from '@/lib/db'
import { comErros, ok } from '@/lib/http'
import { exigirAutenticacao } from '@/lib/rbac'
import { mecanicoCreateSchema } from '@/lib/validation'

export function GET(req: Request) {
  return comErros(async () => {
    await exigirAutenticacao()
    const incluirInativos = new URL(req.url).searchParams.get('todos') === '1'
    const mecanicos = await prisma.mecanico.findMany({
      where: incluirInativos ? {} : { ativo: true },
      orderBy: { nome: 'asc' },
    })
    return ok(mecanicos)
  })
}

export function POST(req: Request) {
  return comErros(async () => {
    await exigirAutenticacao()
    const dados = mecanicoCreateSchema.parse(await req.json())
    const mecanico = await prisma.mecanico.create({ data: dados })
    return ok(mecanico, 201)
  })
}
