// /api/veiculos/[id] — detalhe (GET, com orçamentos e OS do veículo),
// edição (PATCH) e remoção lógica (DELETE).
import { prisma } from '@/lib/db'
import { comErros, ok, ApiError } from '@/lib/http'
import { exigirAutenticacao } from '@/lib/rbac'
import { veiculoUpdateSchema } from '@/lib/validation'

type Ctx = { params: { id: string } }

export function GET(_req: Request, { params }: Ctx) {
  return comErros(async () => {
    await exigirAutenticacao()
    const veiculo = await prisma.veiculo.findUnique({
      where: { id: params.id },
      include: {
        cliente: { select: { id: true, nome: true, telefone: true } },
        orcamentos: {
          orderBy: { createdAt: 'desc' },
          include: { itens: { select: { quantidade: true, valorUnitario: true } } },
        },
        ordensServico: {
          orderBy: { aberturaEm: 'desc' },
          include: { mecanico: { select: { id: true, nome: true } } },
        },
      },
    })
    if (!veiculo) throw new ApiError('NAO_ENCONTRADO', 'Veículo não encontrado.')
    return ok(veiculo)
  })
}

export function PATCH(req: Request, { params }: Ctx) {
  return comErros(async () => {
    await exigirAutenticacao()
    const { version, placa, chassi, ...dados } = veiculoUpdateSchema.parse(await req.json())

    const atual = await prisma.veiculo.findUnique({ where: { id: params.id } })
    if (!atual) throw new ApiError('NAO_ENCONTRADO', 'Veículo não encontrado.')
    if (version !== undefined && version !== atual.version) {
      throw new ApiError('CONFLITO', 'Este veículo foi alterado por outra pessoa. Recarregue e tente novamente.')
    }

    const veiculo = await prisma.veiculo.update({
      where: { id: params.id },
      data: {
        ...dados,
        ...(placa !== undefined ? { placa: placa ? placa.toUpperCase() : null } : {}),
        ...(chassi !== undefined ? { chassi: chassi ? chassi.toUpperCase() : null } : {}),
        version: { increment: 1 },
      },
      include: { cliente: { select: { id: true, nome: true, telefone: true } } },
    })
    return ok(veiculo)
  })
}

export function DELETE(_req: Request, { params }: Ctx) {
  return comErros(async () => {
    await exigirAutenticacao()
    const atual = await prisma.veiculo.findUnique({ where: { id: params.id } })
    if (!atual) throw new ApiError('NAO_ENCONTRADO', 'Veículo não encontrado.')
    await prisma.veiculo.update({
      where: { id: params.id },
      data: { ativo: false, version: { increment: 1 } },
    })
    return ok({ ok: true })
  })
}
