# FY Medical Aesthetics: patient portal

A web app for FY Medical Aesthetics to take patient consent on a tablet, run IV
drip treatments through a doctor's approval, book appointments with
doctors, and remind patients and doctors before each appointment.

## The IV drip visit

This is the clinic's process for an IV drip (process flow V4), step by step.

1. **Check-in.** Reception or the practitioner takes the client's first name,
   surname, ID or passport number and treatment under **Check in**. The client
   joins the **Waiting** list on the Today and Treatments screens. A returning
   client is recognised from their ID number.
2. **The practitioner starts the case** from the waiting list (or straight
   from the check-in screen) and fills in, with the client:
   1. **Patient details.** The date of birth is read from a South African ID
      number, and a returning client's contact details are filled in. A photo
      of the ID document can be taken with the tablet camera; it is stored
      encrypted.
   2. **Medical history.** The questions from the clinic's consent form.
   3. **Vital signs.** Blood pressure, blood sugar, heart rate and temperature
      are required; oxygen saturation is optional.
3. **Submit.**
   - **If every reading is within range**, the doctor gets a WhatsApp message
     with the patient's age, the drip, the vitals and a link. They reply
     **YES** or **NO** (with the case number), or tap the link and choose. The
     practitioner's screen updates by itself.
   - **If any reading is outside the range**, nothing is sent to the doctor.
     The screen says not to administer the drip and to refer the patient to a
     doctor immediately. The patient signs nothing.
4. **Doctor says YES: the patient signs.** The practitioner taps **Hand the
   tablet to the patient**. The tablet locks to a screen with only that
   client's consent conditions, acknowledgements and signature box. The signed
   form is saved and emailed as a PDF to the patient and the clinic inbox
   (`CLINIC_INBOX_EMAIL`). A staff member signs in again to take the tablet
   back.
5. **The drip.** When it is finished, the practitioner records a second set of
   vitals, with the drip's batch number and expiry.
6. **Close.** The practitioner closes the case with optional notes (up to 200
   characters) and their signature.

If the doctor says **NO**, or the vitals were out of range, the practitioner
does not proceed, refers the patient, and closes the case with notes and a
signature. A client who leaves before being seen can be removed from the
waiting list.

Botox, filler, peel, microneedling and laser visits follow the same check-in,
details and history, signing and closing steps, without the vitals and doctor
approval.

The ranges that decide step 3, and the default on-call doctor, are under
**Settings** (administrators only). The defaults are a starting point: the
clinic's medical lead should confirm them before going live.

The original self-service check-in, where the patient fills in and signs the
whole form on the tablet first, is still in the app under `/kiosk` but no
longer linked from the staff screens.

## Appointments

1. **Reception books an appointment** with a doctor. Double-booking a doctor is
   blocked. The patient gets a confirmation by WhatsApp and/or email (their choice)
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
- **Appointment messages carry no medical detail.** WhatsApp and email only say when
  and where the appointment is. The doctor's approval request is the exception:
  it carries the vitals a doctor needs to decide, with the patient's surname
  reduced to an initial.
- **The doctor's approval link** is a single-use token that expires after four
  hours, and the doctor's own number is checked before a WhatsApp reply is accepted.
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

> **Hosting isn't decided yet** (AWS is being considered). The app is a standard
> Node.js (Next.js) server plus PostgreSQL, so it runs on any host that offers
> those, a custom domain with HTTPS, and a scheduled call to
> `GET /api/cron/reminders` with `Authorization: Bearer $CRON_SECRET`. The
> steps below use Vercel + Neon as a worked example; the WhatsApp, email and
> first-administrator steps are the same everywhere.

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
7. **WhatsApp.** See [WhatsApp setup](#whatsapp-setup) below.
8. **Doctor replies.** In Twilio, set the WhatsApp sender's *A message comes
   in* webhook to `POST https://<your domain>/api/twilio/inbound` so YES/NO
   replies reach the app. Set `APP_URL` to the same domain: it builds the
   approval links and verifies the webhook.
9. **Doctors' mobile numbers.** Add each doctor under **Staff** with the mobile
   number they will reply from.

Reminders run daily at 06:00 UTC (`vercel.json`). On Vercel Pro you can run
them hourly by changing the schedule to `0 * * * *`.

Without email or WhatsApp configured the app still works; the booking screen
tells staff when no confirmation went out, and a doctor's answer can be
recorded by phone on the case screen.

## WhatsApp setup

All messages to patients and doctors go by WhatsApp through Twilio (and email,
for patients who choose it). There is no SMS.

1. In Twilio, register the clinic's number as a **WhatsApp sender** (this
   links it to a Meta Business account). Set `TWILIO_ACCOUNT_SID`,
   `TWILIO_AUTH_TOKEN` and `TWILIO_WHATSAPP_FROM` (the number, e.g.
   `+27100000000`).
2. WhatsApp only allows free text within 24 hours of the person last messaging
   the clinic. Confirmations, reminders and approval requests are started by the
   clinic, so each needs a **template approved by Meta**. Create these in
   Twilio's *Content Template Builder*, submit them for WhatsApp approval, and
   put each Content SID (`HX…`) in the matching variable:

   | Variable | Category | Template text |
   | --- | --- | --- |
   | `TWILIO_TEMPLATE_BOOKING` | Utility | Hello {{1}}, your appointment with {{2}} at FY Medical Aesthetics is booked for {{3}}. Please call us if you need to change it. |
   | `TWILIO_TEMPLATE_REMINDER` | Utility | Hello {{1}}, this is a reminder of your appointment with {{2}} at FY Medical Aesthetics on {{3}}. Please call us if you can't make it. |
   | `TWILIO_TEMPLATE_DOCTOR_APPROVAL` | Utility | FY Medical Aesthetics IV drip approval #{{1}}. Patient: {{2}}. Drip: {{3}}. Vitals: {{4}}. Reply YES {{1}} to approve or NO {{1}} to decline, or open {{5}} |

   The variables must stay in that order. Quick-reply buttons labelled **YES**
   and **NO** can be added to the approval template: a tap is read the same as
   typing the word, as long as only one case is waiting for that doctor (the
   app asks for the case number otherwise).
3. Until a template is approved, the app sends the same text as a plain
   message. That works in Twilio's WhatsApp sandbox and within the 24-hour
   window, which is enough for testing.
4. Ask each doctor to save the clinic's WhatsApp number, and add their mobile
   number under **Staff**.

## Running locally

```sh
cp .env.example .env        # fill in a local Postgres URL and generated keys
npm install
npm run db:migrate:dev
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='change me please' npm run db:seed
npm run dev
```

`npm test` runs the unit tests; `npm run lint` type-checks.
