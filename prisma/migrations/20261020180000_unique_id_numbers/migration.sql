-- Stops here, before changing anything, if two patients already share an ID
-- number. Find and merge them first: see scripts/duplicate-id-numbers.sql.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Patient" WHERE "idNumberHash" IS NOT NULL GROUP BY "idNumberHash" HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Two or more patient records share an ID number. Run scripts/duplicate-id-numbers.sql to find and merge them, then deploy again.';
  END IF;
END $$;

-- DropIndex
DROP INDEX "Patient_idNumberHash_idx";

-- CreateIndex
CREATE UNIQUE INDEX "Patient_idNumberHash_key" ON "Patient"("idNumberHash");

-- AlterTable
ALTER TABLE "TreatmentCase" ADD COLUMN "nameMismatch" BOOLEAN NOT NULL DEFAULT false;
