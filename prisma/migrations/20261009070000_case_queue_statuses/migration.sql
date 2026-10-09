-- New case statuses for the practitioner-led intake. Added on their own so the
-- next migration can use them (Postgres can't use a new enum value in the
-- transaction that adds it).
ALTER TYPE "CaseOutcome" ADD VALUE 'CANCELLED';
ALTER TYPE "CaseStatus" ADD VALUE 'QUEUED';
ALTER TYPE "CaseStatus" ADD VALUE 'ASSESSMENT';
ALTER TYPE "CaseStatus" ADD VALUE 'AWAITING_SIGNATURE';
