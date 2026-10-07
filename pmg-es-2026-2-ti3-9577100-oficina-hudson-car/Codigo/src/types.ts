// Tipos de domínio compartilhados do sistema da oficina Hudson Car.
// A partir da Sprint 2, os dados vêm da API (tipos em `@/lib/api`) e os enums
// de status/papel são a fonte única da verdade em `@/lib/constants`
// (alinhados ao backend — Sprint 2 F3). Este arquivo apenas reexporta esses
// enums para quem preferir importá-los a partir de `@/types`.

export type {
  Papel,
  StatusOrcamento,
  StatusOS,
  TipoItemOrcamento,
  FormaAutorizacao,
} from './lib/constants'
