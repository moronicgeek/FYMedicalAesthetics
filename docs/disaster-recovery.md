# Disaster recovery

What to do when something goes badly wrong with the FY Medical app, and what to
set up now so that recovery is possible. Everything runs on AWS in Ireland
(`eu-west-1`), as described in [hosting-and-costs.md](hosting-and-costs.md).

## What there is to lose

| Piece | Where it lives | How it comes back |
| --- | --- | --- |
| Patient records, cases, consents, signatures, ID photos, audit log, staff accounts | One PostgreSQL database on Amazon RDS | RDS backups (below). This is the only thing that cannot be rebuilt. |
| `ENCRYPTION_KEY` and `BLIND_INDEX_KEY` | Amplify environment variables, plus the password manager | Only from your own copy. **Without `ENCRYPTION_KEY` the database backups are unreadable.** |
| The app itself | GitHub (`moronicgeek/FYMedicalAesthetics`), built by Amplify | Redeploy from GitHub. Copies also sit on Muhammed's Mac. |
| Reminder schedule | `infra/reminders-schedule.yml` (CloudFormation) | Redeploy the stack. |
| Email and WhatsApp | Resend and Twilio accounts | Nothing to restore; only the API keys, which can be reissued. |

Signed consent PDFs are also emailed to the patient and to the clinic inbox at
signing time, so the clinic inbox is a second, readable copy of every consent.

## Set this up now (one-off)

Most of the recovery below depends on these. Tick them off once done.

- [ ] **Keys in two safe places.** `ENCRYPTION_KEY`, `BLIND_INDEX_KEY` and the
  database password in the password manager, and a second copy held by someone
  else at the clinic (for example a sealed printout in the clinic safe). If both
  Muhammed and AWS lose them, every backup becomes useless.
- [ ] **RDS backup retention at 35 days** (the maximum). RDS console →
  Databases → the database → *Modify* → *Backup retention period*. The default
  is 7 days, which is too short to notice a slow problem.
- [ ] **Deletion protection on** for the database (same *Modify* page). Stops
  the database, and with it the automatic backups, being deleted by mistake.
- [ ] **"Retain automated backups" on** when deleting is ever needed, and always
  take a final snapshot.
- [ ] **A copy outside this account and region.** In AWS Backup, create a plan
  that takes a daily snapshot of the database, keeps it for 1 year, and copies it
  to a backup vault in Frankfurt (`eu-central-1`, still in the EU for POPIA),
  ideally in a second AWS account with *Vault Lock* on. This is what saves the
  data if the AWS account is hacked or Ireland is down. For a 20 GB database this
  costs a few dollars a month.
- [ ] **Root account locked down.** MFA on the AWS root user and on every
  IAM Identity Center user, and the root email/password in the password manager.
- [ ] **Test a restore twice a year** (see "Test the backups" below).

## Scenarios

### 1. A deploy broke the app

Symptoms: the site errors or a screen is broken right after a change went live.

1. Amplify console → the app → *Deployments* → pick the last good deployment →
   *Redeploy this version*. The site is back within a few minutes.
2. Revert the bad change on GitHub so the next push does not bring it back.
3. If the bad deploy included a database migration that damaged data, go to
   scenario 2.

### 2. Data was deleted or damaged

Symptoms: patients or cases missing, wrong, or garbled after a bug or a mistake.

RDS keeps a continuous log, so the database can be restored to any minute within
the retention period (within about 5 minutes of now).

1. Note the time just **before** the damage happened (the audit log helps).
2. RDS console → the database → *Actions* → *Restore to point in time* → choose
   that time. Name it e.g. `fymedical-restore-2026-10-10`. Keep the same
   settings (public access, security group, encryption). This creates a **new**
   database next to the old one; the old one is not touched.
3. Decide how to use it:
   - **Only a few records were lost:** connect to the restored copy with the
     same `ENCRYPTION_KEY` and copy the missing rows across, then delete the
     restored copy.
   - **Everything is damaged:** switch the app over. In Amplify set
     `DATABASE_URL` and `DIRECT_URL` to the new database's endpoint and
     redeploy. Anything entered after the restore time is lost, so re-enter it
     from paper or the consent emails.
4. Keep the old database (stopped) until you are sure, then delete it with a
   final snapshot.

### 3. The database server fails

Symptoms: every page errors with a database connection error.

1. Check RDS console → the database → *Status*, and the
   [AWS Health Dashboard](https://health.aws.amazon.com/) for `eu-west-1`.
2. If it is rebooting or "storage-full", wait or increase storage.
3. If it does not come back, restore to the latest point in time (scenario 2,
   choosing "Latest restorable time") and point the app at it.

The database is single-zone to save money, so a hardware or data-centre problem
means downtime until it recovers or is restored, typically under an hour. The
*Multi-AZ* option in [hosting-and-costs.md](hosting-and-costs.md) turns this into
an automatic failover of a minute or two.

### 4. All of AWS Ireland is down

Rare, and usually over within hours. The clinic runs on paper forms meanwhile
(see "Running the clinic without the app").

If it lasts too long, rebuild in Frankfurt from the copied backup:

1. AWS Backup → the Frankfurt vault → restore the latest database snapshot.
2. Create a new Amplify app in `eu-central-1` from the same GitHub repo, with the
   same environment variables and the new database URL (README → *Deploy*).
3. Move the custom domain to the new app and redeploy
   `infra/reminders-schedule.yml` in Frankfurt.
4. Update the Twilio WhatsApp incoming webhook to the domain if it changed.

Without the cross-region copy from "Set this up now", there is nothing to
rebuild from until Ireland is back.

### 5. The AWS account is hacked, locked or closed

Everything inside the account, backups included, may be gone or under someone
else's control.

1. Contact AWS Support from the root account (or the *account recovery* page)
   to regain access, and change all passwords and keys.
2. If the database or its backups were deleted, restore from the copy in the
   second account (AWS Backup vault with Vault Lock), then rebuild as in
   scenario 4.
3. Rotate `CRON_SECRET`, the database password, and the Twilio and Resend keys.
4. A breach of patient data must be reported to the Information Regulator and
   the affected patients under POPIA section 22. The data itself is encrypted
   with keys that are not stored in the database, which matters for that
   assessment.

Without a copy in a second account, this scenario can mean losing all records.

### 6. The encryption key is lost

If `ENCRYPTION_KEY` is lost from Amplify **and** from every other copy, the
patient data cannot be decrypted by anyone, including AWS. There is no
recovery. Prevent it with the two-place copy above.

If only Amplify lost it, copy it back from the password manager and redeploy.

If `BLIND_INDEX_KEY` is lost, the data is still readable but searching patients
by ID number, phone or email stops matching. A new key can be generated and the
indexes recomputed from the decrypted data; this needs a small one-off script.

### 7. A key or password leaked

1. Database password: change it in RDS, update `DATABASE_URL`/`DIRECT_URL` in
   Amplify, redeploy.
2. `CRON_SECRET`, Twilio, Resend: reissue, update Amplify (and the reminders
   stack for `CRON_SECRET`), redeploy.
3. `ENCRYPTION_KEY`: on its own it reveals nothing without the database. If both
   may have leaked, treat it as a breach (scenario 5, step 4). Re-encrypting with
   a new key needs a migration script; the ciphertext carries a version prefix
   (`v1.`) so this can be added without downtime, but it is not built yet.

### 8. GitHub repository lost

The app keeps running. Push a copy back to a new repository from Muhammed's Mac
(`/Users/moe/Code/FYMedicalAesthetics`) and reconnect it in Amplify.

### 9. WhatsApp or email is down

The app keeps working. Doctors' IV drip approvals can be phoned through and
recorded on the case page by staff ("recorded by …" is shown on the case).
Consents can be re-emailed from the patient's page once email is back.

## Running the clinic without the app

Keep a small stock of printed consent forms (Laser, IV Drip,
Botox/Filler/Peels/Microneedling) and a paper vitals sheet at reception. IV drips
still need a doctor's YES by phone before starting. Enter the paper records into
the app once it is back, and file the paper originals.

## Test the backups

Twice a year, and after any big change:

1. Restore the database to a new instance (scenario 2, step 2).
2. Run the app locally against it (`DATABASE_URL` set to the restored copy, the
   real `ENCRYPTION_KEY`), sign in, and open a few recent patients and consents.
3. Note the date and how long the restore took, then delete the restored copy.

A backup that has never been restored is a guess.

## Contacts

| What | Who / where |
| --- | --- |
| AWS account owner (root) | _fill in_ |
| Person holding the second key copy | _fill in_ |
| Developer | Muhammed |
| AWS Support | AWS console → Support Center |
| Information Regulator (POPIA breaches) | https://inforegulator.org.za |
