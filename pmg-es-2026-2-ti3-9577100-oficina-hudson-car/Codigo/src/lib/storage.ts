// Armazenamento de arquivos no Supabase Storage (Sprint 4 — RF10, fotos do
// veículo). Centraliza upload, remoção e geração de URL assinada no bucket
// privado `veiculos`. Roda SEMPRE no servidor (route handlers), nunca no
// cliente — usa a SERVICE_ROLE_KEY, que não pode vazar para o browser.
//
// Envs necessárias (ver .env.example):
//   SUPABASE_URL               — ex.: https://<ref>.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY  — chave service_role (Project Settings > API)
//
// O bucket é PRIVADO: a leitura é feita por URL assinada temporária
// (createSignedUrl), nunca por URL pública. Por isso o banco guarda só o
// `path`, não a URL.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import type { MomentoFoto } from './constants'

export const BUCKET_FOTOS = 'veiculos'

let _cliente: SupabaseClient | null = null

/// Cliente Supabase (singleton, lazy). Lança erro claro se faltar configuração
/// — assim o desenvolvedor sabe exatamente qual env preencher.
function cliente(): SupabaseClient {
  if (_cliente) return _cliente
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'Storage não configurado: defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.',
    )
  }
  _cliente = createClient(url, key, { auth: { persistSession: false } })
  return _cliente
}

/// true se as envs de Storage estiverem presentes (útil para a UI/rotas
/// degradarem com mensagem amigável em vez de estourar).
export function storageConfigurado(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

/// Extrai a extensão (minúscula, sem ponto) de um nome de arquivo. Default jpg.
function extensao(nomeArquivo: string): string {
  const ponto = nomeArquivo.lastIndexOf('.')
  if (ponto === -1 || ponto === nomeArquivo.length - 1) return 'jpg'
  return nomeArquivo.slice(ponto + 1).toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
}

/// Monta um caminho único e organizado dentro do bucket:
///   <veiculoId>/<entrada|saida>/<uuid>.<ext>
export function montarPathFoto(
  veiculoId: string,
  momento: MomentoFoto,
  nomeArquivo: string,
): string {
  const pasta = momento === 'ENTRADA' ? 'entrada' : 'saida'
  return `${veiculoId}/${pasta}/${randomUUID()}.${extensao(nomeArquivo)}`
}

/// Envia um arquivo ao bucket. `dados` pode ser Buffer/ArrayBuffer/Blob.
/// `upsert=false`: nunca sobrescreve (o path é único por UUID).
export async function enviarArquivo(
  path: string,
  dados: ArrayBuffer | Buffer | Blob,
  contentType: string,
): Promise<void> {
  const { error } = await cliente()
    .storage.from(BUCKET_FOTOS)
    .upload(path, dados, { contentType, upsert: false })
  if (error) {
    throw new Error(`Falha ao enviar arquivo ao storage: ${error.message}`)
  }
}

/// Remove um ou mais arquivos do bucket. Não falha se o arquivo já não existir.
export async function removerArquivos(paths: string[]): Promise<void> {
  if (paths.length === 0) return
  const { error } = await cliente().storage.from(BUCKET_FOTOS).remove(paths)
  if (error) {
    throw new Error(`Falha ao remover arquivo do storage: ${error.message}`)
  }
}

/// Gera uma URL assinada temporária para LER um arquivo privado.
export async function urlAssinada(
  path: string,
  expiraEmSegundos: number,
): Promise<string> {
  const { data, error } = await cliente()
    .storage.from(BUCKET_FOTOS)
    .createSignedUrl(path, expiraEmSegundos)
  if (error || !data) {
    throw new Error(`Falha ao gerar URL da foto: ${error?.message ?? 'desconhecido'}`)
  }
  return data.signedUrl
}

/// Gera URLs assinadas para vários paths de uma vez (lista de fotos).
export async function urlsAssinadas(
  paths: string[],
  expiraEmSegundos: number,
): Promise<Record<string, string>> {
  if (paths.length === 0) return {}
  const { data, error } = await cliente()
    .storage.from(BUCKET_FOTOS)
    .createSignedUrls(paths, expiraEmSegundos)
  if (error || !data) {
    throw new Error(`Falha ao gerar URLs das fotos: ${error?.message ?? 'desconhecido'}`)
  }
  const mapa: Record<string, string> = {}
  for (const item of data) {
    if (item.path && item.signedUrl) mapa[item.path] = item.signedUrl
  }
  return mapa
}

/// Garante que o bucket privado `veiculos` exista (idempotente). Usado pelo
/// script de setup (scripts/setup-storage.ts). Não roda em request normal.
export async function garantirBucket(): Promise<'criado' | 'existente'> {
  const sb = cliente()
  const { data: existente } = await sb.storage.getBucket(BUCKET_FOTOS)
  if (existente) return 'existente'
  const { error } = await sb.storage.createBucket(BUCKET_FOTOS, { public: false })
  if (error) {
    throw new Error(`Falha ao criar o bucket '${BUCKET_FOTOS}': ${error.message}`)
  }
  return 'criado'
}
