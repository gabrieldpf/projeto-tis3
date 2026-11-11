// Setup do Supabase Storage para as fotos do veículo (Sprint 4 — RF10, P1).
// Cria o bucket privado `veiculos` (idempotente) e faz um smoke test de
// upload → URL assinada → remoção, provando que a configuração funciona.
//
// Uso (precisa de SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY no .env):
//   npm run storage:setup
// (o npm script carrega o .env via `tsx --env-file=.env`).
//
// Seguro de rodar quantas vezes quiser: não apaga nada existente além do
// arquivo temporário que ele mesmo cria.

import {
  BUCKET_FOTOS,
  enviarArquivo,
  garantirBucket,
  removerArquivos,
  storageConfigurado,
  urlAssinada,
} from '../src/lib/storage'

async function main() {
  if (!storageConfigurado()) {
    console.error(
      '\n✗ SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY ausentes no .env.\n' +
        '  Preencha os dois (Supabase > Project Settings > API) e rode de novo.\n',
    )
    process.exit(1)
  }

  console.log(`→ Garantindo bucket privado '${BUCKET_FOTOS}'...`)
  const status = await garantirBucket()
  console.log(`  bucket ${status === 'criado' ? 'CRIADO' : 'já existia'}.`)

  // Smoke test: envia um arquivo minúsculo, gera URL assinada e remove.
  const path = `__smoke-test__/${Date.now()}.txt`
  const conteudo = Buffer.from('hudson-car storage ok')
  console.log('→ Upload de arquivo de teste...')
  await enviarArquivo(path, conteudo, 'text/plain')

  console.log('→ Gerando URL assinada (60s)...')
  const url = await urlAssinada(path, 60)
  console.log(`  URL: ${url.slice(0, 80)}...`)

  console.log('→ Removendo arquivo de teste...')
  await removerArquivos([path])

  console.log('\n✓ Storage configurado e funcionando.\n')
}

main().catch((e) => {
  console.error('\n✗ Falha no setup do storage:', e instanceof Error ? e.message : e, '\n')
  process.exit(1)
})
