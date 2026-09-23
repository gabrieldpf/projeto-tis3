// POST /api/auth/login — autentica por e-mail + senha e cria a sessão.
import { prisma } from '@/lib/db'
import { criarSessao, verificarSenha } from '@/lib/auth'
import { comErros, ok, ApiError } from '@/lib/http'
import { loginSchema } from '@/lib/validation'
import type { Papel } from '@/lib/constants'

export function POST(req: Request) {
  return comErros(async () => {
    const { email, senha } = loginSchema.parse(await req.json())

    const usuario = await prisma.usuario.findUnique({ where: { email } })
    // Mensagem genérica para não revelar se o e-mail existe.
    const credenciaisInvalidas = new ApiError('NAO_AUTENTICADO', 'E-mail ou senha inválidos.')

    if (!usuario || !usuario.ativo) throw credenciaisInvalidas
    const ok_ = await verificarSenha(senha, usuario.senhaHash)
    if (!ok_) throw credenciaisInvalidas

    await criarSessao({
      sub: usuario.id,
      nome: usuario.nome,
      cargo: usuario.cargo,
      papel: usuario.papel as Papel,
    })

    return ok({
      id: usuario.id,
      nome: usuario.nome,
      cargo: usuario.cargo,
      papel: usuario.papel,
    })
  })
}
