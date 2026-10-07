// Global setup do Vitest: recria o schema no banco PostgreSQL de teste.
// Usa TEST_DATABASE_URL (ou o Postgres local descartável de db:test:up).
// `db push --accept-data-loss` é seguro aqui: é um banco DEDICADO a testes.
import { execSync } from 'node:child_process'

export default function setup() {
  const url =
    process.env.TEST_DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:55432/hudson_test'
  execSync('npx prisma db push --skip-generate --accept-data-loss --force-reset', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
  })
}
