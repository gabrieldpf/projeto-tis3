// Schemas de validação (Zod) compartilhados. Validam a entrada de TODA rota
// de escrita. Enums de domínio vêm de constants.ts (fonte única da verdade).

import { z } from 'zod'
import { PAPEIS, TIPOS_MOVIMENTACAO, UNIDADES } from './constants'

// --- Auth --------------------------------------------------------------------
export const loginSchema = z.object({
  email: z.string().trim().email('E-mail inválido.'),
  senha: z.string().min(1, 'Informe a senha.'),
})
export type LoginInput = z.infer<typeof loginSchema>

// --- Fornecedor --------------------------------------------------------------
export const fornecedorCreateSchema = z.object({
  nome: z.string().trim().min(2, 'Nome é obrigatório.'),
  documento: z.string().trim().optional(),
  telefone: z.string().trim().optional(),
  email: z.string().trim().email('E-mail inválido.').optional().or(z.literal('')),
  categoria: z.string().trim().optional(),
  observacao: z.string().trim().optional(),
})
export type FornecedorCreateInput = z.infer<typeof fornecedorCreateSchema>

// PATCH: todos opcionais + version p/ concorrência otimista.
export const fornecedorUpdateSchema = fornecedorCreateSchema.partial().extend({
  ativo: z.boolean().optional(),
  version: z.number().int().optional(),
})

// --- Peça --------------------------------------------------------------------
export const pecaCreateSchema = z.object({
  nome: z.string().trim().min(2, 'Nome é obrigatório.'),
  codigo: z.string().trim().optional(),
  categoria: z.string().trim().min(1, 'Categoria é obrigatória.'),
  subcategoria: z.string().trim().optional(),
  unidade: z.enum(UNIDADES).default('UN'),
  fornecedorId: z.string().trim().optional(),
  precoDia: z.number().nonnegative('Preço não pode ser negativo.').default(0),
  estoqueMinimo: z.number().nonnegative().default(0),
  quantidadeInicial: z.number().nonnegative().default(0),
  chassisCompativeis: z
    .array(
      z.object({
        chassi: z.string().trim().min(1),
        modeloVeiculo: z.string().trim().optional(),
      }),
    )
    .optional(),
})
export type PecaCreateInput = z.infer<typeof pecaCreateSchema>

export const pecaUpdateSchema = z.object({
  nome: z.string().trim().min(2).optional(),
  codigo: z.string().trim().optional(),
  categoria: z.string().trim().min(1).optional(),
  subcategoria: z.string().trim().optional(),
  unidade: z.enum(UNIDADES).optional(),
  fornecedorId: z.string().trim().nullable().optional(),
  estoqueMinimo: z.number().nonnegative().optional(),
  ativo: z.boolean().optional(),
  version: z.number().int().optional(),
  chassisCompativeis: z
    .array(
      z.object({
        chassi: z.string().trim().min(1),
        modeloVeiculo: z.string().trim().optional(),
      }),
    )
    .optional(),
})

// Preço do dia: endpoint dedicado (regra de ouro nº 3 — manual, com auditoria).
export const precoDiaSchema = z.object({
  precoDia: z.number().nonnegative('Preço não pode ser negativo.'),
})

// --- Movimentação de estoque -------------------------------------------------
export const movimentacaoSchema = z.object({
  pecaId: z.string().trim().min(1, 'Peça é obrigatória.'),
  tipo: z.enum(TIPOS_MOVIMENTACAO),
  quantidade: z.number().positive('Quantidade deve ser maior que zero.'),
  motivo: z.string().trim().optional(),
})
export type MovimentacaoInput = z.infer<typeof movimentacaoSchema>

// --- Usuário (gestão — só admin) --------------------------------------------
export const usuarioCreateSchema = z.object({
  nome: z.string().trim().min(2),
  email: z.string().trim().email(),
  senha: z.string().min(6, 'Senha deve ter ao menos 6 caracteres.'),
  cargo: z.string().trim().min(1),
  papel: z.enum(PAPEIS),
})
