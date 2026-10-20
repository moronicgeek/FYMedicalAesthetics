-- Finds patient records that share an ID number, which must be sorted out
-- before the "one record per ID number" migration (20261020180000) can run.
-- Names are encrypted, so this lists record IDs only: open each one in the
-- app at /patients/<id> to see who it is.
--
-- Run with the admin login (DIRECT_URL), not the app login:
--   psql "$DIRECT_URL" -f scripts/duplicate-id-numbers.sql
--
-- For each group, either:
--   * Different people (one has the wrong ID number): correct the ID number on
--     that record in the app (Edit patient).
--   * The same person: copy anything only the old record has onto the record
--     to keep (Edit patient), then merge them. This moves the old record's
--     visits and appointments onto the kept one and deletes the old record.
--     Take an RDS snapshot first, it cannot be undone:
--       psql "$DIRECT_URL" -v keep=<record to keep> -v drop=<record to remove> -f scripts/duplicate-id-numbers.sql

\set ON_ERROR_STOP on

\if :{?keep}
  \if :{?drop}
  \else
    \echo 'Give both -v keep=<id> and -v drop=<id>.'
    \quit
  \endif
  SELECT count(*) = 2 AS found FROM "Patient" p
  WHERE p.id IN (:'keep', :'drop')
    AND p."idNumberHash" = (SELECT "idNumberHash" FROM "Patient" WHERE id = :'keep')
    AND :'keep' <> :'drop' \gset
  \if :found
  \else
    \echo 'Nothing merged: those two records do not exist or do not share an ID number.'
    \quit
  \endif
  BEGIN;
  UPDATE "TreatmentCase" SET "patientId" = :'keep' WHERE "patientId" = :'drop';
  UPDATE "Appointment" SET "patientId" = :'keep' WHERE "patientId" = :'drop';
  DELETE FROM "Patient" WHERE id = :'drop';
  INSERT INTO "AuditLog" (id, action, entity, "entityId", "createdAt")
  VALUES ('merge_' || md5(random()::text), 'merged-duplicate-id:' || :'drop', 'Patient', :'keep', now());
  COMMIT;
  \echo 'Merged.'
  \quit
\endif

SELECT
  dense_rank() OVER (ORDER BY p."idNumberHash") AS "group",
  p.id AS record,
  p."createdAt"::date AS created,
  p."updatedAt"::date AS updated,
  (SELECT count(*) FROM "TreatmentCase" c WHERE c."patientId" = p.id) AS visits,
  (SELECT count(*) FROM "Appointment" a WHERE a."patientId" = p.id) AS appointments
FROM "Patient" p
WHERE p."idNumberHash" IN (
  SELECT "idNumberHash" FROM "Patient" WHERE "idNumberHash" IS NOT NULL GROUP BY "idNumberHash" HAVING count(*) > 1
)
ORDER BY "group", p."createdAt";
