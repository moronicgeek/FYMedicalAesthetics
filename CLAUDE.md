# CLAUDE.md

Lumiere Clinic patient portal (repo still named FYMedicalAesthetics; the clinic was FY Medical Aesthetics until 2026-10). Staff web app for check-in, consent on a tablet, IV drip doctor approval over WhatsApp, appointments and reminders. Holds patient health records, so privacy rules below are not optional. README.md describes the visit flows in full; read it only when you need the step-by-step.

## Stack
Next.js 15 (App Router, server actions) · React 19 · Prisma 6 + PostgreSQL · Tailwind 4 · zod 4 · Vitest · pdf-lib for consent PDFs · Resend (email) · Twilio (WhatsApp).

## Commands
- `npm run dev` local server (needs Postgres: `brew services start postgresql@16` on the Mac, and a `.env` from `.env.example`)
- `npm run db:migrate` apply migrations (`prisma migrate deploy`); run after every pull that adds a migration
- `npm run db:migrate:dev` create a new migration after editing `prisma/schema.prisma`
- `npm run db:seed` creates the first admin: `ADMIN_EMAIL=... ADMIN_PASSWORD='12+ chars' npm run db:seed`. It uses `DATABASE_URL` from the local `.env`, so check which database that points at
- `npm run lint` is a typecheck (`tsc --noEmit`), not ESLint
- `npm test` Vitest, `tests/**/*.test.ts`, pure unit tests, no database
- CI (`.github/workflows/ci.yml`) runs lint, test, build on every PR. Run all three before pushing.

## Map
- `src/app/(staff)/` staff pages: dashboard (Today), checkin, cases, patients, appointments, overview, settings, staff, audit
- `src/app/kiosk/` patient-facing tablet screens (check-in, client form, sign). `/kiosk` self-service consent is kept but unlinked
- `src/app/d/[token]` doctor's YES/NO approval link · `src/app/api/twilio/inbound` doctor WhatsApp replies · `src/app/api/cron/reminders` reminder job (EventBridge, `CRON_SECRET`)
- `src/app/actions/` server actions, one file per area
- `src/lib/` all domain logic; `src/components/` client/UI components
- `src/middleware.ts` session gate, tablet lock redirect, per-request CSP nonce
- `prisma/` schema, migrations, seed · `infra/` EventBridge schedule · `docs/` hosting, first deploy, DR, downtime · `scripts/` secret generation, test-data wipe

## Conventions
- **Encryption.** Patient PII/health data is AES-256-GCM encrypted JSON (`Patient.data`, case records, `summary`, `idPhoto`) via `src/lib/crypto.ts` (`encrypt`/`encryptJson`/`decrypt`). Lookups use HMAC blind indexes (`emailHash`, `phoneHash`, `idNumberHash`) from `blindIndex()` on the normalised value (`normaliseEmail/Phone/IdNumber`). Never add a plaintext PII column or query by plaintext. List views read the encrypted `summary` column, not the full record.
- **Patient matching** (`src/lib/patient-match.ts`): a record is reused only for the same person (same first name + DOB; never across different ID numbers). Never merge on a shared phone or email.
- **Roles** ADMIN, DOCTOR, PRACTITIONER, RECEPTION. Who sees/does what lives only in `src/lib/access.ts` (`canSeeCase`, `visibleCasesWhere`, `canTreat`, `canSeeService`, `DOCTOR_ONLY_SERVICES`) plus `canSeePatient` in `src/lib/patients.ts`. Practitioners do IV drips only and never see injection/laser cases or doctor-only bookings. Only doctors/admins start or close injection/laser cases. Reception checks in but cannot start cases. Settings are admin-only. Guard every page and action with `requireUser([roles])` from `src/lib/auth.ts`.
- **Case flow** is the `CaseStatus` enum comment in `prisma/schema.prisma`. IV: QUEUED → ASSESSMENT → AWAITING_DOCTOR → AWAITING_SIGNATURE → IN_PROGRESS → READY_TO_CLOSE → CLOSED; out-of-range vitals → REFERRED, doctor NO → DECLINED, and nothing is signed. Injections/laser: client fills the form on the tablet → CONSENTED ("Waiting for the doctor") → doctor closes. Vital ranges, IV drip list and on-call doctor are `Setting` rows (`src/lib/settings.ts`). A phoned-in doctor YES may be recorded by a practitioner but needs the doctor's name and a reason.
- **Tablet lock**: `lockTablet()`/`unlockTablet()` in `src/lib/tablet.ts` set the `fy_kiosk` cookie; middleware then keeps the device on `/kiosk/*` until staff sign in again. Use these helpers, don't set the cookie directly.
- **Audit**: every read or change of patient data, export, and login-relevant action calls `audit(user, action, entity, id)` from `src/lib/audit.ts`. IP comes from `src/lib/client-ip.ts` (last public X-Forwarded-For entry).
- **Shared helpers, reuse them**: `listCases` / `OPEN_STATUSES` / `checkInCase` (`src/lib/cases.ts`), `listAppointments` / `listDoctors` (`src/lib/queries.ts`), zod field helpers and `fieldErrors` (`src/lib/validation.ts`), `notifyPatient` / `notifyDoctor` / `sendWhatsApp` (`src/lib/notify.ts`), time helpers in `src/lib/time.ts` (clinic timezone `CLINIC_TIMEZONE`, default Africa/Johannesburg).
- **CSP**: nonce per request (`src/lib/csp.ts`). No inline scripts or `dangerouslySetInnerHTML` scripts.
- Comments are sparse and explain why; user-facing copy is plain English for elderly users.

## Messaging
WhatsApp via Twilio only, no SMS. Clinic-initiated messages must use Meta-approved Content templates (`TWILIO_TEMPLATE_*`, `WHATSAPP_TEMPLATES` in `notify.ts`). Email via Resend; signed consent PDFs go to the patient and `CLINIC_INBOX_EMAIL` (hello@lumiereclinic.co.za).

## Hosting
AWS only, everything in eu-west-1 (Ireland). Nothing may depend on Vercel. Amplify Hosting (`amplify.yml` copies env vars into `.env.production` and runs migrations at build) + RDS Postgres (public endpoint, hardened: low-privilege `DATABASE_URL` for the app, admin `DIRECT_URL` for migrations only) + EventBridge for reminders. AWS CLI profile: `fymedical` (SSO). AWS resource names keep "fymedical". See `docs/hosting-and-costs.md` and `docs/first-deploy.md`.

## Branding and theme
Lumiere Clinic. Wordmark `public/logo.png`, "L" icon; PDFs embed the logo via `src/lib/logo-png.ts`. "Stone & Charcoal" theme tokens in `src/app/globals.css`: charcoal menu, 4px corners (no pill buttons), AAA text contrast, Atkinson Hyperlegible. Rose accent `#a46a5e` for lines only; rose text uses `#6e3e35`. Use the tokens, not new hex values.

## Gotchas
- Losing `ENCRYPTION_KEY` or `BLIND_INDEX_KEY` makes patient data unreadable or unsearchable. Never rotate or log them.
- After pulling a branch with a new migration: `npm install && npm run db:migrate` before `npm run dev`.
- On Muhammed's Mac the repo is `/Users/moe/Code/FYMedicalAesthetics`, but that device folder cannot reach GitHub. Push from a cloud clone and let Muhammed `git pull` locally.
- `prisma generate` runs on `postinstall` and `build`; rerun it if Prisma types look stale.
