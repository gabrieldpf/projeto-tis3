// Schemas de validação (Zod) compartilhados. Validam a entrada de TODA rota
// de escrita. Enums de domínio vêm de constants.ts (fonte única da verdade).

import { z } from 'zod'
import {
  FORMAS_AUTORIZACAO,
  ORIGEM_PECA,
  PAPEIS,
  RECURSOS_PRESENCA,
  STATUS_OS,
  TIPOS_ITEM_ORCAMENTO,
  TIPOS_MOVIMENTACAO,
  UNIDADES,
} from './constants'

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

// --- Cliente -----------------------------------------------------------------
export const clienteCreateSchema = z.object({
  nome: z.string().trim().min(2, 'Nome é obrigatório.'),
  telefone: z.string().trim().optional(),
  documento: z.string().trim().optional(),
  email: z.string().trim().email('E-mail inválido.').optional().or(z.literal('')),
  observacao: z.string().trim().optional(),
})
export type ClienteCreateInput = z.infer<typeof clienteCreateSchema>

export const clienteUpdateSchema = clienteCreateSchema.partial().extend({
  ativo: z.boolean().optional(),
  version: z.number().int().optional(),
})

// --- Veículo -----------------------------------------------------------------
export const veiculoCreateSchema = z.object({
  clienteId: z.string().trim().min(1, 'Cliente é obrigatório.'),
  placa: z.string().trim().optional(),
  chassi: z.string().trim().optional(),
  marca: z.string().trim().optional(),
  modelo: z.string().trim().optional(),
  ano: z.number().int().min(1900).max(2100).optional(),
  cor: z.string().trim().optional(),
})
export type VeiculoCreateInput = z.infer<typeof veiculoCreateSchema>

export const veiculoUpdateSchema = veiculoCreateSchema.partial().extend({
  ativo: z.boolean().optional(),
  version: z.number().int().optional(),
})

// --- Mecânico ----------------------------------------------------------------
export const mecanicoCreateSchema = z.object({
  nome: z.string().trim().min(2, 'Nome do mecânico é obrigatório.'),
})
export type MecanicoCreateInput = z.infer<typeof mecanicoCreateSchema>

export const mecanicoUpdateSchema = z.object({
  nome: z.string().trim().min(2).optional(),
  ativo: z.boolean().optional(),
  version: z.number().int().optional(),
})

// --- Orçamento ---------------------------------------------------------------
// Item digitado na criação do orçamento. `valorUnitario` é a cópia do preço do
// dia (nunca recalculado); `pecaId` liga à peça quando o item é uma peça.
export const itemOrcamentoSchema = z.object({
  tipo: z.enum(TIPOS_ITEM_ORCAMENTO),
  pecaId: z.string().trim().optional(),
  descricao: z.string().trim().min(1, 'Descrição do item é obrigatória.'),
  quantidade: z.number().positive('Quantidade deve ser maior que zero.').default(1),
  valorUnitario: z.number().nonnegative('Valor não pode ser negativo.').default(0),
  // Sprint 3: origem da peça (ESTOQUE baixa estoque; COMPRA_AVULSA não) e
  // garantia em dias. Opcionais p/ compatibilidade; a UI pede a escolha.
  origemPeca: z.enum(ORIGEM_PECA).optional(),
  garantiaDias: z.number().int().positive().optional(),
})

export const orcamentoCreateSchema = z.object({
  clienteId: z.string().trim().min(1, 'Cliente é obrigatório.'),
  veiculoId: z.string().trim().min(1, 'Veículo é obrigatório.'),
  observacao: z.string().trim().optional(),
  responsavel: z.string().trim().optional(),
  itens: z.array(itemOrcamentoSchema).default([]),
})
export type OrcamentoCreateInput = z.infer<typeof orcamentoCreateSchema>

// PATCH do cabeçalho do orçamento — exige `version` (controle otimista).
export const orcamentoUpdateSchema = z.object({
  observacao: z.string().trim().optional(),
  responsavel: z.string().trim().optional(),
  version: z.number().int('Versão é obrigatória para edição.'),
})

// Transição de status / autorização. `acao` dispara a mudança de status;
// `formaAutorizacao` é obrigatória ao AUTORIZAR.
export const orcamentoAcaoSchema = z.object({
  acao: z.enum(['ENVIAR', 'AUTORIZAR', 'RECUSAR']),
  formaAutorizacao: z.enum(FORMAS_AUTORIZACAO).optional(),
  version: z.number().int('Versão é obrigatória.'),
})
export type OrcamentoAcaoInput = z.infer<typeof orcamentoAcaoSchema>

// Novo item num orçamento existente (POST em /itens).
export const itemCreateSchema = itemOrcamentoSchema

// Edição de um item (PATCH) — exige `version` do item.
export const itemUpdateSchema = z.object({
  descricao: z.string().trim().min(1).optional(),
  quantidade: z.number().positive('Quantidade deve ser maior que zero.').optional(),
  valorUnitario: z.number().nonnegative('Valor não pode ser negativo.').optional(),
  origemPeca: z.enum(ORIGEM_PECA).optional(),
  garantiaDias: z.number().int().positive().nullable().optional(),
  version: z.number().int('Versão é obrigatória para edição.'),
})

// --- Ordem de serviço --------------------------------------------------------
// OS nasce de um orçamento AUTORIZADO; mecânico é obrigatório.
export const ordemServicoCreateSchema = z.object({
  orcamentoId: z.string().trim().min(1, 'Orçamento é obrigatório.'),
  mecanicoId: z.string().trim().min(1, 'Mecânico é obrigatório.'),
  previsaoEntrega: z.string().trim().optional(), // ISO (yyyy-mm-dd)
})
export type OrdemServicoCreateInput = z.infer<typeof ordemServicoCreateSchema>

// Atualização da OS: troca de status (transição validada no server) e/ou mecânico.
export const ordemServicoUpdateSchema = z.object({
  status: z.enum(STATUS_OS).optional(),
  mecanicoId: z.string().trim().optional(),
  previsaoEntrega: z.string().trim().optional(),
  version: z.number().int('Versão é obrigatória para edição.'),
})

// --- Usuário (gestão — só admin) --------------------------------------------
export const usuarioCreateSchema = z.object({
  nome: z.string().trim().min(2),
  email: z.string().trim().email(),
  senha: z.string().min(6, 'Senha deve ter ao menos 6 caracteres.'),
  cargo: z.string().trim().min(1),
  papel: z.enum(PAPEIS),
})

// --- Sprint 3: Aditivo -------------------------------------------------------
// Aditivo nasce vazio (RASCUNHO) numa OS em andamento; itens entram depois.
export const aditivoCreateSchema = z.object({
  observacao: z.string().trim().optional(),
})
export type AditivoCreateInput = z.infer<typeof aditivoCreateSchema>

export const aditivoUpdateSchema = z.object({
  observacao: z.string().trim().optional(),
  version: z.number().int('Versão é obrigatória para edição.'),
})

// Item do aditivo = item de orçamento (reusa origemPeca/garantiaDias).
export const itemAditivoSchema = itemOrcamentoSchema
export const itemAditivoUpdateSchema = itemUpdateSchema

// Enviar / autorizar / recusar o aditivo (mesmo ciclo do orçamento).
export const aditivoAcaoSchema = z.object({
  acao: z.enum(['ENVIAR', 'AUTORIZAR', 'RECUSAR']),
  formaAutorizacao: z.enum(FORMAS_AUTORIZACAO).optional(),
  version: z.number().int('Versão é obrigatória.'),
})
export type AditivoAcaoInput = z.infer<typeof aditivoAcaoSchema>

// --- Sprint 3: Pendência de baixa (saldo insuficiente) -----------------------
// Resolve um item de peça que não baixou por falta de saldo.
export const pendenciaItemSchema = z.object({
  acao: z.enum(['COMPRA_AVULSA', 'AJUSTE_ESTOQUE']),
  quantidade: z.number().positive().optional(), // usado no AJUSTE_ESTOQUE
  version: z.number().int('Versão é obrigatória para edição.'),
})
export type PendenciaItemInput = z.infer<typeof pendenciaItemSchema>

// --- Sprint 3: Presença de edição (heartbeat) --------------------------------
export const presencaSchema = z.object({
  recurso: z.enum(RECURSOS_PRESENCA),
  recursoId: z.string().trim().min(1, 'Recurso é obrigatório.'),
})
export type PresencaInput = z.infer<typeof presencaSchema>

// --- Sprint 3: Relatórios (ADMIN) --------------------------------------------
export const relatorioQuerySchema = z.object({
  de: z.string().trim().optional(), // ISO yyyy-mm-dd
  ate: z.string().trim().optional(),
})
export type RelatorioQueryInput = z.infer<typeof relatorioQuerySchema>
