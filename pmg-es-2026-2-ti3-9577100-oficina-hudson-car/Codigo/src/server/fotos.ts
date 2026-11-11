// Fotos do veículo (camada de serviço — Sprint 4, RF10).
//
// Orquestra o par "arquivo no Supabase Storage + registro no banco":
//  - registrarFoto: valida o arquivo, envia ao storage e cria o registro.
//    Se o insert falhar, desfaz o upload (evita arquivo órfão).
//  - listarFotosVeiculo: lista (opcionalmente por momento) e anexa uma URL
//    assinada temporária a cada foto (bucket é privado).
//  - removerFoto: apaga o arquivo do storage e, em seguida, o registro.
//
// A autorização (sessão/papel) e o parsing de multipart ficam nas rotas; aqui
// a lógica é testável sem HTTP (o storage é mockado nos testes).

import type { Foto } from '@prisma/client'
import { prisma } from '@/lib/db'
import { ApiError } from '@/lib/http'
import {
  FOTO_MIME_PERMITIDOS,
  FOTO_TAMANHO_MAX_BYTES,
  FOTO_URL_EXPIRA_SEGUNDOS,
  type MomentoFoto,
} from '@/lib/constants'
import {
  enviarArquivo,
  montarPathFoto,
  removerArquivos,
  urlsAssinadas,
} from '@/lib/storage'

/// Arquivo recebido para upload (abstrai a origem — multipart, teste, etc.).
export interface ArquivoFoto {
  nome: string
  contentType: string
  tamanho: number
  dados: ArrayBuffer | Buffer | Blob
}

/// Validação básica do arquivo (a Q2/#38 fará a rigorosa: sniff de conteúdo).
function validarArquivo(arquivo: ArquivoFoto): void {
  if (!(FOTO_MIME_PERMITIDOS as readonly string[]).includes(arquivo.contentType)) {
    throw new ApiError(
      'DADOS_INVALIDOS',
      'Formato de imagem não suportado. Use JPG, PNG, WEBP ou HEIC.',
    )
  }
  if (arquivo.tamanho <= 0) {
    throw new ApiError('DADOS_INVALIDOS', 'Arquivo de imagem vazio.')
  }
  if (arquivo.tamanho > FOTO_TAMANHO_MAX_BYTES) {
    throw new ApiError('DADOS_INVALIDOS', 'Imagem muito grande (máximo de 10 MB).')
  }
}

/// Registra uma foto de ENTRADA/SAÍDA de um veículo (e, opcionalmente, da OS).
export async function registrarFoto(params: {
  veiculoId: string
  momento: MomentoFoto
  ordemServicoId?: string
  legenda?: string
  arquivo: ArquivoFoto
  criadoPorId: string
}) {
  const veiculo = await prisma.veiculo.findUnique({ where: { id: params.veiculoId } })
  if (!veiculo) throw new ApiError('NAO_ENCONTRADO', 'Veículo não encontrado.')

  if (params.ordemServicoId) {
    const os = await prisma.ordemServico.findUnique({ where: { id: params.ordemServicoId } })
    if (!os) throw new ApiError('NAO_ENCONTRADO', 'Ordem de serviço não encontrada.')
    if (os.veiculoId !== params.veiculoId) {
      throw new ApiError('DADOS_INVALIDOS', 'A ordem de serviço não pertence a este veículo.')
    }
  }

  validarArquivo(params.arquivo)

  const path = montarPathFoto(params.veiculoId, params.momento, params.arquivo.nome)
  await enviarArquivo(path, params.arquivo.dados, params.arquivo.contentType)

  try {
    return await prisma.foto.create({
      data: {
        veiculoId: params.veiculoId,
        ordemServicoId: params.ordemServicoId ?? null,
        momento: params.momento,
        path,
        legenda: params.legenda?.trim() || null,
        criadoPorId: params.criadoPorId,
      },
    })
  } catch (e) {
    // Insert falhou: remove o arquivo recém-enviado para não ficar órfão.
    await removerArquivos([path]).catch(() => {})
    throw e
  }
}

/// Foto com a URL assinada temporária de leitura anexada.
export type FotoComUrl = Foto & { url: string | null }

/// Lista as fotos de um veículo (opcionalmente filtrando por momento), já com
/// URL assinada para leitura. Mais recentes primeiro.
export async function listarFotosVeiculo(
  veiculoId: string,
  momento?: MomentoFoto,
): Promise<FotoComUrl[]> {
  const veiculo = await prisma.veiculo.findUnique({ where: { id: veiculoId } })
  if (!veiculo) throw new ApiError('NAO_ENCONTRADO', 'Veículo não encontrado.')

  const fotos = await prisma.foto.findMany({
    where: { veiculoId, ...(momento ? { momento } : {}) },
    orderBy: { createdAt: 'desc' },
  })

  const urls = await urlsAssinadas(
    fotos.map((f) => f.path),
    FOTO_URL_EXPIRA_SEGUNDOS,
  )
  return fotos.map((f) => ({ ...f, url: urls[f.path] ?? null }))
}

/// Remove uma foto: apaga o arquivo do storage e depois o registro. A ordem
/// (storage antes) evita registro órfão apontando para arquivo inexistente.
export async function removerFoto(id: string): Promise<{ ok: true }> {
  const foto = await prisma.foto.findUnique({ where: { id } })
  if (!foto) throw new ApiError('NAO_ENCONTRADO', 'Foto não encontrada.')

  await removerArquivos([foto.path])
  await prisma.foto.delete({ where: { id } })
  return { ok: true }
}
