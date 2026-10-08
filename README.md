# FY Medical Aesthetics: patient portal

A web app for FY Medical Aesthetics to register patients, book appointments with
doctors, and remind patients and doctors before each appointment.

## How the clinic uses it

1. **Patient arrives.** Reception taps **Hand device to patient**. The tablet
   switches to check-in mode: just the intake form, large text controls, and no
   way to reach other patients' records. Leaving check-in mode needs a staff
   password.
2. **Patient fills in the intake form**: personal and contact details, emergency
   contact, medical history (conditions, medicines, allergies, previous
   treatments) and consent, signed by typing their name. A returning patient
   (same ID number, email or mobile) updates their existing record instead of
   creating a duplicate.
3. **Reception books the appointment** with a doctor. Double-booking a doctor is
   blocked. The patient gets a confirmation by SMS and/or email (their choice)
   and the doctor gets an email.
4. **Reminders go out automatically** every morning for appointments in the next
   24 hours, and each doctor gets their list of upcoming patients.
5. **On the day**, staff mark patients as arrived, completed, cancelled or did
   not attend from the **Today** screen. Doctors see their own schedule.

Staff roles: **Administrator** (everything, plus staff accounts and the access
log), **Doctor** and **Reception**.

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
- **Messages carry no medical detail.** SMS and email only say when and where
  the appointment is.
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
7. **SMS (optional).** Create a [Twilio](https://twilio.com) account and set
   `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_FROM_NUMBER`.

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
