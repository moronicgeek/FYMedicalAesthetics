# FY Medical Aesthetics: patient portal

A web app for FY Medical Aesthetics to take patient consent on a tablet, run IV
drip treatments through a doctor's approval, book appointments with
doctors, and remind patients and doctors before each appointment.

## The IV drip visit

This is the clinic's process for an IV drip, step by step.

1. **Consent on the tablet.** Reception taps **Hand device to patient**; the
   tablet switches to check-in mode, where only the consent screens are
   reachable. The patient picks their treatment, fills in the clinic's consent
   form and signs it with their finger. The signed form is saved immediately and
   emailed as a PDF to the patient and to the clinic inbox
   (`CLINIC_INBOX_EMAIL`).
2. **The case stays open.** The tablet shows a thank-you screen with the case
   reference. A practitioner continues on that tablet, or opens the case from
   any other device under **Treatments**.
3. **Vital signs.** The practitioner records blood pressure, heart rate, blood
   sugar and, optionally, oxygen saturation and temperature.
4. **If every reading is within range**, the case moves on and the vitals are
   sent to the doctor to approve.
   1. The doctor gets an SMS or WhatsApp with the patient's age, the drip, the
      vitals and a link. They reply **YES** or **NO** (with the case number), or
      tap the link and choose. The practitioner's screen updates by itself.
   2. **YES**: the practitioner administers the drip.
   3. The case stays open. When the drip is finished, a second set of vitals is
      recorded, along with the drip's batch number and expiry.
   4. The practitioner closes the case with optional notes (up to 200
      characters) and their signature.
5. **If any reading is outside the range**, nothing is sent to the doctor. The
   screen says in plain words not to administer the drip and to refer the
   patient to a doctor immediately. The practitioner closes the case with notes
   and a signature, and it is recorded as "not treated, referred".
6. **If the doctor says NO**, the same applies: do not proceed, refer the
   patient, then close the case with notes and a signature.

Botox, filler, peel, microneedling and laser visits use the same consent and
closing steps, without the vitals and doctor approval.

The ranges that decide step 4 or 5, and the default on-call doctor, are under
**Settings** (administrators only). The defaults are a starting point: the
clinic's medical lead should confirm them before going live.

## Appointments

1. **Reception books an appointment** with a doctor. Double-booking a doctor is
   blocked. The patient gets a confirmation by SMS and/or email (their choice)
   and the doctor gets an email.
2. **Reminders go out automatically** every morning for appointments in the next
   24 hours, and each doctor gets their list of upcoming patients.
3. **On the day**, staff mark patients as arrived, completed, cancelled or did
   not attend from the **Today** screen. Doctors see their own schedule.

Staff roles: **Administrator** (everything, plus staff accounts, settings and
the access log), **Doctor**, **Practitioner** (nurse: vitals, drips, closing
cases) and **Reception** (patients and bookings, no clinical steps).

## How patient data is protected

- **Encrypted at rest.** Every patient's personal and health details, and each
  appointment's treatment and notes, are encrypted with AES-256-GCM before they
  reach the database (`src/lib/crypto.ts`). Someone with a copy of the database
  sees only ciphertext.
- **Lookups without decryption.** Mobile, email and ID number are also stored as
  keyed HMACs with a separate key, so reception can find a returning patient
  without decrypting everyone.
- **Staff sign-in only.** Passwords are bcrypt hashed, sessions expire after 8
  hours and live in the database so access can be revoked instantly. Five wrong
  passwords lock an account for 15 minutes.
- **Access log.** Every sign-in, patient view, search, change and booking is
  recorded with who did it and from where. Administrators can review it under
  **Access log**.
- **Appointment messages carry no medical detail.** SMS and email only say when
  and where the appointment is. The doctor's approval request is the exception:
  it carries the vitals a doctor needs to decide, with the patient's surname
  reduced to an initial.
- **The doctor's approval link** is a single-use token that expires after four
  hours, and the clinic's own number is checked before an SMS reply is accepted.
  Twilio webhooks are verified by signature.
- **Hardened HTTP.** HTTPS only (HSTS), strict Content Security Policy, no
  framing, and patient pages are marked `no-store` so browsers don't cache them.
- The app is set to `noindex` so search engines don't list it.

## Accessibility

18px base text with **A / A+ / A++** controls on every page (remembered per
device), high-contrast colours that meet WCAG AA, 48px+ touch targets, visible
focus outlines, a skip link, labelled fields with inline error messages, and
reduced motion respected. Works on phones, tablets and desktops.

## Hosting with a custom domain

Recommended: **Vercel** (app) + **Neon** (PostgreSQL). Both give you HTTPS on
your own domain at no extra cost, and nothing needs patching or maintaining.

> The clinic is a business, so use **Vercel Pro** (Hobby is for personal,
> non-commercial use). Choose a Neon database region that fits your data
> protection obligations (for example POPIA or GDPR), and close to the clinic.

1. **Database.** Create a Neon project. Copy the *pooled* connection string as
   `DATABASE_URL` and the *direct* one as `DIRECT_URL`.
2. **Keys.** Generate two encryption keys and a cron secret:
   ```sh
   openssl rand -base64 32   # ENCRYPTION_KEY
   openssl rand -base64 32   # BLIND_INDEX_KEY
   openssl rand -hex 32      # CRON_SECRET
   ```
   Store the encryption keys in a password manager as well. **If
   `ENCRYPTION_KEY` is lost, patient records cannot be recovered.**
3. **Deploy.** Import this GitHub repo into Vercel and add every variable from
   `.env.example` under *Settings → Environment Variables*. Each deploy runs the
   database migrations automatically (see `vercel.json`).
4. **First administrator.** From your computer, with `DATABASE_URL` and
   `DIRECT_URL` pointing at Neon:
   ```sh
   ADMIN_EMAIL=you@yourclinic.com ADMIN_PASSWORD='a long password' ADMIN_NAME='Your Name' npm run db:seed
   ```
   Then sign in and add doctors and reception under **Staff**.
5. **Custom domain.** In Vercel go to *Settings → Domains*, add e.g.
   `portal.fymedical.co.za`, and create the DNS record Vercel shows you (a
   `CNAME` to `cname.vercel-dns.com` for a subdomain) at your domain registrar.
   Vercel issues the HTTPS certificate automatically.
6. **Email.** Create a [Resend](https://resend.com) account, verify the same
   domain (it gives you DNS records to add), and set `RESEND_API_KEY` and
   `EMAIL_FROM`.
7. **SMS.** Create a [Twilio](https://twilio.com) account and set
   `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_FROM_NUMBER`. This is
   what carries IV drip approvals to the doctor. For WhatsApp instead, set
   `DOCTOR_CHANNEL=whatsapp` and `TWILIO_WHATSAPP_FROM`.
8. **Doctor replies.** In Twilio, set the number's *A message comes in* webhook
   to `POST https://<your domain>/api/twilio/inbound` so YES/NO replies reach
   the app. Set `APP_URL` to the same domain: it signs the approval links and
   verifies the webhook.
9. **Doctors' mobile numbers.** Add each doctor under **Staff** with the mobile
   number they will reply from.

Reminders run daily at 06:00 UTC (`vercel.json`). On Vercel Pro you can run
them hourly by changing the schedule to `0 * * * *`.

Without email or SMS configured the app still works; the booking screen tells
staff when no confirmation went out.

## Running locally

```sh
cp .env.example .env        # fill in a local Postgres URL and generated keys
npm install
npm run db:migrate:dev
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='change me please' npm run db:seed
npm run dev
```

`npm test` runs the unit tests; `npm run lint` type-checks.
