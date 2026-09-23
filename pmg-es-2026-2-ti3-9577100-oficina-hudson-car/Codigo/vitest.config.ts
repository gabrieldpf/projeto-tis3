import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: ['./tests/setup/global.ts'],
    // Banco SQLite de teste, separado do dev. Definido ANTES dos imports para
    // que o singleton do Prisma (src/lib/db.ts) já use este arquivo.
    env: {
      DATABASE_URL: 'file:./prisma/test.db',
      AUTH_SECRET: 'segredo-de-teste',
      NODE_ENV: 'test',
    },
    // Arquivos compartilham o mesmo arquivo SQLite → sem paralelismo.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
