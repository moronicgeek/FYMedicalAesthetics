-- Removes every patient record and everything hanging off it (check-ins,
-- treatment cases, signed consents, vitals, appointments), plus the audit log
-- and failed-login history. Staff logins and Settings (the IV drip list etc.)
-- are kept. Cannot be undone: take an RDS snapshot first.
--
-- Run with the admin login (DIRECT_URL), not the app login:
--   psql "$DIRECT_URL" -f scripts/wipe-test-data.sql
--
-- To also remove staff logins and Settings, run it with -v everything=1 and
-- then `npm run db:seed` with ADMIN_EMAIL/ADMIN_PASSWORD/ADMIN_NAME set to
-- create a fresh administrator.

\set ON_ERROR_STOP on
\if :{?everything}
\else
  \set everything 0
\endif

\echo 'Rows before:'
SELECT
  (SELECT count(*) FROM "Patient")       AS patients,
  (SELECT count(*) FROM "TreatmentCase") AS cases,
  (SELECT count(*) FROM "Appointment")   AS appointments,
  (SELECT count(*) FROM "AuditLog")      AS audit_log,
  (SELECT count(*) FROM "User")          AS staff,
  (SELECT count(*) FROM "Setting")       AS settings;

\prompt 'Type WIPE to delete this data for good: ' confirm
SELECT :'confirm' = 'WIPE' AS confirmed \gset
\if :confirmed
\else
  \echo 'Nothing deleted.'
  \quit
\endif

BEGIN;
TRUNCATE "TreatmentCase", "Appointment", "Patient", "AuditLog", "LoginAttempt";
\if :everything
  TRUNCATE "Session", "User", "Setting" CASCADE;
\endif
COMMIT;

\echo 'Rows after:'
SELECT
  (SELECT count(*) FROM "Patient")       AS patients,
  (SELECT count(*) FROM "TreatmentCase") AS cases,
  (SELECT count(*) FROM "Appointment")   AS appointments,
  (SELECT count(*) FROM "AuditLog")      AS audit_log,
  (SELECT count(*) FROM "User")          AS staff,
  (SELECT count(*) FROM "Setting")       AS settings;
