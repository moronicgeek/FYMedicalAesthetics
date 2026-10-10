# Running the Clinic During Downtime

Last updated 2026-10-10. Client-facing guide for clinic staff. The editable
version is the Claude Doc "Running the Clinic During Downtime"; keep the two in
step. For the technical recovery steps see
[disaster-recovery.md](disaster-recovery.md).

## Purpose

If the FY Medical app cannot be used, the clinic keeps seeing clients on paper and enters the records into the app once it is back. No treatment is ever skipped or rushed because the app is down: the same safety checks apply, they are just written down instead of typed.

Use this guide when:

- the app will not load on the tablet or the reception computer for more than 10 minutes,
- the clinic internet is down,
- the tablet is broken, flat or lost, or
- WhatsApp or email messages from the app are not arriving (see Partial outages).

## The downtime kit

Keep one labelled folder at reception with everything needed to run a full day on paper. Check it on the first Monday of each month and top it up.

| Item | How many to keep | Notes |
| --- | --- | --- |
| IV Drip consent form, printed | 20 | Same wording as the app |
| Botox / Filler / Peels / Microneedling consent form, printed | 20 | Same wording as the app |
| Laser consent form, printed | 10 | Same wording as the app |
| Paper check-in and vitals sheet | 30 | One per client: details, emergency contact, vitals before and after, doctor decision, notes, signatures |
| Daily paper register | 5 | Time, client name, treatment, staff member, "entered in app" tick |
| Doctors' mobile numbers | 1 list | So approvals can be phoned through |
| Lockable folder or drawer | 1 | Completed paper forms are patient records |
| Pens and a clipboard | 4 | |

The consent forms should be printed from the current app version so the wording matches. Ask the developer for fresh PDFs whenever a form changes.

## Is it downtime?

Try these in order before switching to paper:

1. Check the clinic Wi-Fi: can the tablet open any other website?
2. If not, restart the router and wait 5 minutes. If the internet is still down, use a phone hotspot for the tablet.
3. If other websites work but the app does not, try the reception computer as well.
4. If the app is still not working after 10 minutes, switch to paper and tell everyone on shift.
5. Message the app administrator with the time it stopped and what the screen showed. A photo of the error helps.

The administrator checks the hosting service and tells reception when the app is back. Until then, stay on paper even if the app seems to come back for a moment, so no visit is split between paper and app.

## IV drip visits on paper

The practitioner runs the visit exactly as in the app, with the paper vitals sheet in place of the screens.

1. **Reception checks the client in** on a paper vitals sheet: name, surname, ID number, contact number, emergency contact and treatment. Add the client to the daily paper register.
2. **The practitioner takes the client** and completes the details, medical history and vitals on the sheet: blood pressure, blood sugar, heart rate and temperature, plus oxygen saturation if measured.
3. **Check the vitals against the safe ranges.** If any reading is outside the range, stop: no drip, refer the client to a doctor, and write the reason on the sheet.
4. **Phone the doctor** with the vitals and ask for a YES or NO. Write the doctor's name, the time of the call and their answer on the sheet. If the answer is NO, stop and refer as above.
5. **After a YES, the client reads and signs** the printed IV Drip consent form. Nothing is signed before the doctor's YES.
6. **Give the drip.** Afterwards record the vitals again on the same sheet.
7. **Close the visit** with short notes and the practitioner's signature on the sheet. Staple the consent form to it and file both in the locked folder.

| Reading | Safe range |
| --- | --- |
| Blood pressure, top number | 90 to 140 mmHg |
| Blood pressure, bottom number | 60 to 90 mmHg |
| Heart rate | 50 to 100 bpm |
| Blood sugar | 3.9 to 11.0 mmol/L |
| Temperature | 35.5 to 37.5 °C |
| Oxygen saturation (optional) | 95 to 100 % |

These are the ranges currently set in the app (`src/lib/vitals.ts`). The clinic's medical lead should confirm them and the printed copy should be updated if they change.

## Injections and laser visits on paper

These stay doctor-only, as in the app. Practitioners do not start or close them.

1. **Reception checks the client in** on a paper vitals sheet (name, surname, ID number, contact number, emergency contact) and adds them to the daily paper register.
2. **The client fills in and signs** the printed Botox / Filler / Peels / Microneedling form or the Laser form, including all the yes/no questions.
3. **Reception passes the signed form to the doctor.** The client waits for the doctor as usual.
4. **The doctor reviews the answers**, writes the treatment given on the form (for example Botox or Filler), treats the client, and closes the visit with notes and their signature.
5. **File the form** with its check-in sheet in the locked folder.

## Partial outages

When only one part is down, keep using the app for everything else.

| What is down | What still works | What to do |
| --- | --- | --- |
| WhatsApp messages | The app, check-in, forms, signing | Phone the doctor for the IV drip YES or NO, then on the case page open "Doctor answered by phone instead?" and tap "Doctor said YES" or "Doctor said NO". The case shows who recorded it. |
| Email | The app and signing | Consent copies are not emailed to the client. Resend them from the client's page once email is back. |
| Tablet broken, flat or lost | The app on the reception computer | Run check-in on the computer. For signatures, use paper consent forms and note "paper consent" in the case notes. Report a lost tablet to the administrator straight away so its sign-in can be cut off. |
| Appointment reminders | Everything else | Reception phones the next day's clients if reminders did not go out by 08:00. |

## When the app is back

Enter every paper visit into the app the same day, or first thing the next morning.

1. Work through the daily paper register from the first visit to the last.
2. Check each client in and complete the case in the app from the paper sheet: details, vitals, the doctor's decision and the closing notes.
3. In the case notes write "Paper record, downtime on [date]" and the name of the person entering it.
4. Tick "entered in app" on the register.
5. Keep the signed paper consent forms. They are the legal originals for those visits: file them in the locked cabinet, sorted by date.

Signatures made on paper are not redrawn in the app; the paper form is the signed record. Open question for the developer: the app currently expects the client to sign on the tablet before a case can be closed, so a "paper consent" option is needed to enter these visits cleanly.

## Keeping paper records private

Paper forms hold the same personal and health information as the app, so POPIA applies to them in the same way.

- Keep completed forms in the locked folder at all times, never loose on the desk or in a tray clients can see.
- Only staff on shift handle them.
- Do not photograph forms on personal phones or send them over WhatsApp.
- After the visits are entered in the app, file the originals in the locked cabinet. Keep them for as long as the clinic keeps patient records.
- Shred blank forms that were spoiled or filled in by mistake; do not put them in the bin.
- If a paper form goes missing, tell the clinic manager the same day.

## Quick checklist and contacts

Pin this page next to the downtime kit.

- [ ] App down for 10 minutes: switch to paper and tell the team
- [ ] Message the administrator with the time and a photo of the error
- [ ] Use the daily paper register for every client
- [ ] IV drips: vitals in range and doctor's YES by phone before signing
- [ ] Injections and laser: client signs the paper form, doctor treats and closes
- [ ] Completed forms go straight into the locked folder
- [ ] App back: enter every paper visit and tick the register

| Who | Name | Number |
| --- | --- | --- |
| App administrator | | |
| Clinic manager | | |
| Doctor on call | | |
| Second doctor | | |
| Internet provider support | | |
