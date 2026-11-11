-- CreateTable
CREATE TABLE "Foto" (
    "id" TEXT NOT NULL,
    "veiculoId" TEXT NOT NULL,
    "ordemServicoId" TEXT,
    "momento" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "legenda" TEXT,
    "criadoPorId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Foto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Foto_veiculoId_idx" ON "Foto"("veiculoId");

-- CreateIndex
CREATE INDEX "Foto_ordemServicoId_idx" ON "Foto"("ordemServicoId");

-- CreateIndex
CREATE INDEX "Foto_veiculoId_momento_idx" ON "Foto"("veiculoId", "momento");

-- AddForeignKey
ALTER TABLE "Foto" ADD CONSTRAINT "Foto_veiculoId_fkey" FOREIGN KEY ("veiculoId") REFERENCES "Veiculo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Foto" ADD CONSTRAINT "Foto_ordemServicoId_fkey" FOREIGN KEY ("ordemServicoId") REFERENCES "OrdemServico"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Foto" ADD CONSTRAINT "Foto_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
