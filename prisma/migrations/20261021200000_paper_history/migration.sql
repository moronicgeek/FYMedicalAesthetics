-- History staff copy from a client's old paper file onto their record.
-- CreateTable
CREATE TABLE "PaperHistoryEntry" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "enteredById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaperHistoryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaperHistoryEntry_patientId_idx" ON "PaperHistoryEntry"("patientId");

-- AddForeignKey
ALTER TABLE "PaperHistoryEntry" ADD CONSTRAINT "PaperHistoryEntry_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperHistoryEntry" ADD CONSTRAINT "PaperHistoryEntry_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperHistoryEntry" ADD CONSTRAINT "PaperHistoryEntry_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

