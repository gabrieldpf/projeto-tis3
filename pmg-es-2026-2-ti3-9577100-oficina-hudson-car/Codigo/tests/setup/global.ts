// Global setup do Vitest: cria/reseta o schema no banco SQLite de teste.
import { execSync } from 'node:child_process'
import { rmSync } from 'node:fs'

export default function setup() {
  const DATABASE_URL = 'file:./prisma/test.db'
  try {
    rmSync('prisma/test.db')
  } catch {
    // arquivo pode não existir — tudo bem
  }
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL },
  })
}
