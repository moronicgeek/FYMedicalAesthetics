-- CreateEnum
CREATE TYPE "CaseType" AS ENUM ('IV_DRIP', 'AESTHETICS', 'LASER');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('CONSENTED', 'AWAITING_DOCTOR', 'IN_PROGRESS', 'READY_TO_CLOSE', 'REFERRED', 'DECLINED', 'CLOSED');

-- CreateEnum
CREATE TYPE "CaseOutcome" AS ENUM ('COMPLETED', 'REFERRED_VITALS', 'DOCTOR_DECLINED');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'PRACTITIONER';

-- CreateTable
CREATE TABLE "TreatmentCase" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "CaseType" NOT NULL,
    "status" "CaseStatus" NOT NULL DEFAULT 'CONSENTED',
    "patientId" TEXT NOT NULL,
    "consent" TEXT NOT NULL,
    "consentEmailedAt" TIMESTAMP(3),
    "practitionerId" TEXT,
    "doctorId" TEXT,
    "preVitals" TEXT,
    "preVitalsAt" TIMESTAMP(3),
    "vitalsWithinRange" BOOLEAN,
    "doctorRequestedAt" TIMESTAMP(3),
    "decisionTokenHash" TEXT,
    "decisionTokenExpires" TIMESTAMP(3),
    "doctorDecision" BOOLEAN,
    "doctorDecisionAt" TIMESTAMP(3),
    "doctorDecisionVia" TEXT,
    "postVitals" TEXT,
    "postVitalsAt" TIMESTAMP(3),
    "officeUse" TEXT,
    "closingNotes" TEXT,
    "practitionerSignature" TEXT,
    "outcome" "CaseOutcome",
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TreatmentCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "TreatmentCase_decisionTokenHash_key" ON "TreatmentCase"("decisionTokenHash");

-- CreateIndex
CREATE INDEX "TreatmentCase_status_idx" ON "TreatmentCase"("status");

-- CreateIndex
CREATE INDEX "TreatmentCase_doctorId_status_idx" ON "TreatmentCase"("doctorId", "status");

-- CreateIndex
CREATE INDEX "TreatmentCase_patientId_idx" ON "TreatmentCase"("patientId");

-- CreateIndex
CREATE INDEX "TreatmentCase_createdAt_idx" ON "TreatmentCase"("createdAt");

-- AddForeignKey
ALTER TABLE "TreatmentCase" ADD CONSTRAINT "TreatmentCase_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentCase" ADD CONSTRAINT "TreatmentCase_practitionerId_fkey" FOREIGN KEY ("practitionerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentCase" ADD CONSTRAINT "TreatmentCase_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
