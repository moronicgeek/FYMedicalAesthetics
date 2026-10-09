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

The app runs on **AWS only**: AWS Amplify Hosting for the Next.js server, a
PostgreSQL database, and an EventBridge schedule for the daily reminders. Use
the Cape Town region (`af-south-1`) for everything so patient data stays in
South Africa (POPIA).

1. **Database.** Create an Amazon RDS for PostgreSQL instance in `af-south-1`
   with encryption at rest and `rds.force_ssl` on. Amplify's servers can't join
   a private network (VPC), so the database needs a public endpoint protected by
   TLS and a long generated password. Set `DATABASE_URL` and `DIRECT_URL` to the
   same connection string, ending in `?sslmode=require`.
2. **Keys.** Generate two encryption keys and a cron secret:
   ```sh
   openssl rand -base64 32   # ENCRYPTION_KEY
   openssl rand -base64 32   # BLIND_INDEX_KEY
   openssl rand -hex 32      # CRON_SECRET
   ```
   Store the encryption keys in a password manager as well. **If
   `ENCRYPTION_KEY` is lost, patient records cannot be recovered.**
3. **Deploy.** In the Amplify console (region `af-south-1`), choose *Create new
   app → GitHub*, pick this repo and the `main` branch. Amplify reads the build
   settings from `amplify.yml`. Add every variable from `.env.example` under
   *Hosting → Environment variables*. Each deploy runs the database migrations
   first, and `amplify.yml` passes the variables through to the running app.
4. **First administrator.** From your computer, with `DATABASE_URL` and
   `DIRECT_URL` pointing at the RDS database:
   ```sh
   ADMIN_EMAIL=you@yourclinic.com ADMIN_PASSWORD='a long password' ADMIN_NAME='Your Name' npm run db:seed
   ```
   Then sign in and add doctors and reception under **Staff**.
5. **Custom domain.** In Amplify go to *Hosting → Custom domains*, add e.g.
   `portal.fymedical.co.za`, and create the DNS records Amplify shows you at your
   domain registrar (or let Amplify do it if the domain is in Route 53). Amplify
   issues the HTTPS certificate automatically. Set `APP_URL` to this address.
6. **Reminders.** Create the daily schedule from
   [`infra/reminders-schedule.yml`](infra/reminders-schedule.yml), in the same
   region, giving it the app's URL and the same `CRON_SECRET`:
   ```sh
   aws cloudformation deploy --region af-south-1 \
     --stack-name fymedical-reminders \
     --template-file infra/reminders-schedule.yml \
     --capabilities CAPABILITY_IAM \
     --parameter-overrides AppUrl=https://portal.fymedical.co.za CronSecret=<CRON_SECRET>
   ```
   (Or upload the file in the CloudFormation console.) It calls
   `/api/cron/reminders` every day at 06:00 Johannesburg time; change the
   `Schedule` parameter (UTC) to run it at another time or hourly. EventBridge
   keeps the secret in AWS Secrets Manager. If you change `CRON_SECRET`, deploy
   the stack again with the new value. To test it by hand:
   `curl -H "Authorization: Bearer $CRON_SECRET" https://<your domain>/api/cron/reminders`.
7. **Email.** Create a [Resend](https://resend.com) account, verify the same
   domain (it gives you DNS records to add), and set `RESEND_API_KEY` and
   `EMAIL_FROM`.
8. **WhatsApp.** See [WhatsApp setup](#whatsapp-setup) below.
9. **Doctor replies.** In Twilio, set the WhatsApp sender's *A message comes
   in* webhook to `POST https://<your domain>/api/twilio/inbound` so YES/NO
   replies reach the app. `APP_URL` must be exactly this domain: it builds the
   approval links and verifies the webhook.
10. **Doctors' mobile numbers.** Add each doctor under **Staff** with the mobile
    number they will reply from.

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
