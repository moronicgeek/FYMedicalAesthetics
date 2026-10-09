-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "idPhoto" TEXT;

-- AlterTable
ALTER TABLE "TreatmentCase" ALTER COLUMN "status" SET DEFAULT 'QUEUED',
ALTER COLUMN "patientId" DROP NOT NULL;
