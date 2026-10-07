import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Banco PostgreSQL de teste, SEPARADO do dev/produção. Por padrão aponta para
// um Postgres local descartável (suba com `npm run db:test:up` — Docker). Pode
// ser sobrescrito por TEST_DATABASE_URL (ex.: no CI/máquina do dev).
const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:55432/hudson_test'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: ['./tests/setup/global.ts'],
    // Definido ANTES dos imports para que o singleton do Prisma (src/lib/db.ts)
    // já use este banco de teste.
    env: {
      DATABASE_URL: TEST_DB_URL,
      DIRECT_URL: TEST_DB_URL,
      AUTH_SECRET: 'segredo-de-teste',
      NODE_ENV: 'test',
    },
    // Arquivos compartilham o mesmo banco → sem paralelismo entre arquivos.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
