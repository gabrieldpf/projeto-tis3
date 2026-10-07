-- CreateTable
CREATE TABLE "Mecanico" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mecanico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Mecanico_nome_idx" ON "Mecanico"("nome");

-- Veiculo: placa passa a ser única (substitui o índice simples)
DROP INDEX "Veiculo_placa_idx";
CREATE UNIQUE INDEX "Veiculo_placa_key" ON "Veiculo"("placa");

-- Orcamento: campos de autorização + auditoria; remove indicador de edição (fora de escopo)
ALTER TABLE "Orcamento" DROP COLUMN "editandoPor";
ALTER TABLE "Orcamento" ADD COLUMN "observacao" TEXT;
ALTER TABLE "Orcamento" ADD COLUMN "criadoPorId" TEXT;
ALTER TABLE "Orcamento" ADD COLUMN "autorizadoEm" TIMESTAMP(3);
ALTER TABLE "Orcamento" ADD COLUMN "formaAutorizacao" TEXT;
ALTER TABLE "Orcamento" ALTER COLUMN "status" SET DEFAULT 'RASCUNHO';

-- CreateIndex
CREATE INDEX "Orcamento_status_idx" ON "Orcamento"("status");

-- AddForeignKey
ALTER TABLE "Orcamento" ADD CONSTRAINT "Orcamento_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ItemOrcamento: vínculo com peça + versão por item (controle otimista)
ALTER TABLE "ItemOrcamento" ADD COLUMN "pecaId" TEXT;
ALTER TABLE "ItemOrcamento" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

-- AddForeignKey
ALTER TABLE "ItemOrcamento" ADD CONSTRAINT "ItemOrcamento_pecaId_fkey" FOREIGN KEY ("pecaId") REFERENCES "Peca"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- OrdemServico: 1 OS por orçamento (único), mecânico obrigatório, entrega
ALTER TABLE "OrdemServico" DROP CONSTRAINT "OrdemServico_orcamentoId_fkey";
ALTER TABLE "OrdemServico" DROP COLUMN "responsavel";
ALTER TABLE "OrdemServico" ADD COLUMN "mecanicoId" TEXT NOT NULL;
ALTER TABLE "OrdemServico" ADD COLUMN "entregueEm" TIMESTAMP(3);
ALTER TABLE "OrdemServico" ALTER COLUMN "orcamentoId" SET NOT NULL;
ALTER TABLE "OrdemServico" ALTER COLUMN "status" SET DEFAULT 'ABERTA';

-- CreateIndex
CREATE UNIQUE INDEX "OrdemServico_orcamentoId_key" ON "OrdemServico"("orcamentoId");

-- CreateIndex
CREATE INDEX "OrdemServico_status_idx" ON "OrdemServico"("status");

-- AddForeignKey
ALTER TABLE "OrdemServico" ADD CONSTRAINT "OrdemServico_orcamentoId_fkey" FOREIGN KEY ("orcamentoId") REFERENCES "Orcamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdemServico" ADD CONSTRAINT "OrdemServico_mecanicoId_fkey" FOREIGN KEY ("mecanicoId") REFERENCES "Mecanico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
