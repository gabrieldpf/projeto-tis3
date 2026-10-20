-- AlterTable
ALTER TABLE "ItemOrcamento" ADD COLUMN     "aditivoId" TEXT,
ADD COLUMN     "baixaEstoqueEm" TIMESTAMP(3),
ADD COLUMN     "garantiaDias" INTEGER,
ADD COLUMN     "origemPeca" TEXT;

-- AlterTable
ALTER TABLE "MovimentacaoEstoque" ADD COLUMN     "ordemServicoId" TEXT;

-- CreateTable
CREATE TABLE "AditivoOrcamento" (
    "id" TEXT NOT NULL,
    "orcamentoId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "observacao" TEXT,
    "criadoPorId" TEXT,
    "autorizadoEm" TIMESTAMP(3),
    "formaAutorizacao" TEXT,
    "registradoPorId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AditivoOrcamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GarantiaServico" (
    "id" TEXT NOT NULL,
    "ordemServicoId" TEXT NOT NULL,
    "itemOrcamentoId" TEXT,
    "descricao" TEXT NOT NULL,
    "prazoDias" INTEGER NOT NULL,
    "iniciaEm" TIMESTAMP(3) NOT NULL,
    "validaAte" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GarantiaServico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresencaEdicao" (
    "id" TEXT NOT NULL,
    "recurso" TEXT NOT NULL,
    "recursoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PresencaEdicao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AditivoOrcamento_orcamentoId_idx" ON "AditivoOrcamento"("orcamentoId");

-- CreateIndex
CREATE INDEX "AditivoOrcamento_status_idx" ON "AditivoOrcamento"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AditivoOrcamento_orcamentoId_numero_key" ON "AditivoOrcamento"("orcamentoId", "numero");

-- CreateIndex
CREATE INDEX "GarantiaServico_ordemServicoId_idx" ON "GarantiaServico"("ordemServicoId");

-- CreateIndex
CREATE INDEX "GarantiaServico_itemOrcamentoId_idx" ON "GarantiaServico"("itemOrcamentoId");

-- CreateIndex
CREATE INDEX "GarantiaServico_validaAte_idx" ON "GarantiaServico"("validaAte");

-- CreateIndex
CREATE INDEX "PresencaEdicao_recurso_recursoId_idx" ON "PresencaEdicao"("recurso", "recursoId");

-- CreateIndex
CREATE INDEX "PresencaEdicao_atualizadoEm_idx" ON "PresencaEdicao"("atualizadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "PresencaEdicao_recurso_recursoId_usuarioId_key" ON "PresencaEdicao"("recurso", "recursoId", "usuarioId");

-- CreateIndex
CREATE INDEX "ItemOrcamento_aditivoId_idx" ON "ItemOrcamento"("aditivoId");

-- CreateIndex
CREATE INDEX "MovimentacaoEstoque_ordemServicoId_idx" ON "MovimentacaoEstoque"("ordemServicoId");

-- AddForeignKey
ALTER TABLE "ItemOrcamento" ADD CONSTRAINT "ItemOrcamento_aditivoId_fkey" FOREIGN KEY ("aditivoId") REFERENCES "AditivoOrcamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentacaoEstoque" ADD CONSTRAINT "MovimentacaoEstoque_ordemServicoId_fkey" FOREIGN KEY ("ordemServicoId") REFERENCES "OrdemServico"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AditivoOrcamento" ADD CONSTRAINT "AditivoOrcamento_orcamentoId_fkey" FOREIGN KEY ("orcamentoId") REFERENCES "Orcamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AditivoOrcamento" ADD CONSTRAINT "AditivoOrcamento_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AditivoOrcamento" ADD CONSTRAINT "AditivoOrcamento_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GarantiaServico" ADD CONSTRAINT "GarantiaServico_ordemServicoId_fkey" FOREIGN KEY ("ordemServicoId") REFERENCES "OrdemServico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GarantiaServico" ADD CONSTRAINT "GarantiaServico_itemOrcamentoId_fkey" FOREIGN KEY ("itemOrcamentoId") REFERENCES "ItemOrcamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresencaEdicao" ADD CONSTRAINT "PresencaEdicao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

