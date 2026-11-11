// /api/veiculos/[id]/fotos — fotos de ENTRADA/SAÍDA do veículo (RF10).
//  - GET  ?momento=ENTRADA|SAIDA  → lista com URL assinada (todas, se sem filtro)
//  - POST (multipart/form-data)   → envia 1 foto (campo `arquivo`) + metadados
// Qualquer usuário autenticado (ADMIN/GESTOR/OPERACIONAL) pode. O autor do
// upload é registrado (criadoPorId = sessão).
import { comErros, ok, ApiError } from '@/lib/http'
import { exigirAutenticacao } from '@/lib/rbac'
import { fotoCreateSchema, fotoQuerySchema } from '@/lib/validation'
import { registrarFoto, listarFotosVeiculo } from '@/server/fotos'

type Ctx = { params: { id: string } }

export function GET(req: Request, { params }: Ctx) {
  return comErros(async () => {
    await exigirAutenticacao()
    const sp = new URL(req.url).searchParams
    const { momento } = fotoQuerySchema.parse({ momento: sp.get('momento') ?? undefined })
    const fotos = await listarFotosVeiculo(params.id, momento)
    return ok(fotos)
  })
}

export function POST(req: Request, { params }: Ctx) {
  return comErros(async () => {
    const sessao = await exigirAutenticacao()

    const form = await req.formData()
    const arquivo = form.get('arquivo')
    if (!(arquivo instanceof File)) {
      throw new ApiError('DADOS_INVALIDOS', 'Envie o arquivo da foto no campo "arquivo".')
    }

    const meta = fotoCreateSchema.parse({
      momento: form.get('momento') ?? undefined,
      ordemServicoId: form.get('ordemServicoId') ?? undefined,
      legenda: form.get('legenda') ?? undefined,
    })

    const foto = await registrarFoto({
      veiculoId: params.id,
      momento: meta.momento,
      ordemServicoId: meta.ordemServicoId,
      legenda: meta.legenda,
      criadoPorId: sessao.sub,
      arquivo: {
        nome: arquivo.name,
        contentType: arquivo.type,
        tamanho: arquivo.size,
        dados: await arquivo.arrayBuffer(),
      },
    })
    return ok(foto, 201)
  })
}
