// /api/fotos/[id] — remoção de uma foto (RF10). Apaga o registro e o arquivo
// do storage. Qualquer usuário autenticado (ADMIN/GESTOR/OPERACIONAL) pode.
import { comErros, ok } from '@/lib/http'
import { exigirAutenticacao } from '@/lib/rbac'
import { removerFoto } from '@/server/fotos'

type Ctx = { params: { id: string } }

export function DELETE(_req: Request, { params }: Ctx) {
  return comErros(async () => {
    await exigirAutenticacao()
    const resultado = await removerFoto(params.id)
    return ok(resultado)
  })
}
