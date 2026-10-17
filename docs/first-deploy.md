# First deploy checklist (AWS eu-west-1)

Follows the README section "Hosting with a custom domain", with the commands filled in.
Every command uses the `fymedical` profile so nothing lands in another account.

```sh
export AWS_PROFILE=fymedical AWS_REGION=eu-west-1
aws sts get-caller-identity   # must show the clinic's account
cd ~/Code/FYMedicalAesthetics && git checkout main && git pull && npm install
```

Resend and Twilio can stay blank for the first deploy. The app works without
them (bookings say no confirmation went out, doctor answers can be entered by phone).

## 1. Secrets (do this first, store them in a password manager)

```sh
sh scripts/generate-secrets.sh ~/fymedical-secrets.env   # ENCRYPTION_KEY, BLIND_INDEX_KEY, CRON_SECRET, DB_PASSWORD, APP_DB_PASSWORD
set -a; . ~/fymedical-secrets.env; set +a                 # load them into this shell for the steps below
```

Losing `ENCRYPTION_KEY` makes patient records unrecoverable: keep two offline copies.
Once everything is in the password manager, delete the file. Never commit it.

## 2. Database (RDS PostgreSQL, about 10 minutes to create)

Amplify can't join a VPC, so the DB has a public endpoint protected by TLS and
the long password. RDS PostgreSQL 15 and later has `rds.force_ssl` on by default.

```sh
VPC=$(aws ec2 describe-vpcs --filters Name=isDefault,Values=true --query 'Vpcs[0].VpcId' --output text)
SG=$(aws ec2 create-security-group --group-name fymedical-db --description "FY Medical Postgres" \
      --vpc-id "$VPC" --query GroupId --output text)
aws ec2 authorize-security-group-ingress --group-id "$SG" --protocol tcp --port 5432 --cidr 0.0.0.0/0

aws rds create-db-instance \
  --db-instance-identifier fymedical-db \
  --engine postgres \
  --db-instance-class db.t4g.micro \
  --allocated-storage 20 --storage-type gp3 --storage-encrypted \
  --db-name fymedical \
  --master-username fymedical_admin --master-user-password "$DB_PASSWORD" \
  --vpc-security-group-ids "$SG" --publicly-accessible \
  --backup-retention-period 35 --deletion-protection --copy-tags-to-snapshot

aws rds wait db-instance-available --db-instance-identifier fymedical-db
aws rds describe-db-instances --db-instance-identifier fymedical-db \
  --query 'DBInstances[0].Endpoint.Address' --output text
```

If `VPC` comes back `None`, the account has no default VPC: run `aws ec2 create-default-vpc` and repeat.

Turn on GuardDuty with RDS login monitoring (flags brute-force and unusual logins; first 30 days free):

```sh
DET=$(aws guardduty create-detector --enable --query DetectorId --output text)
aws guardduty update-detector --detector-id "$DET" --features '[{"Name":"RDS_LOGIN_EVENTS","Status":"ENABLED"}]'
```

## 3. Migrate, create the app's login and the first administrator (from your Mac)

Migrations need the admin login; the running app gets a login that can only read and write rows.

```sh
export DATABASE_URL="postgresql://fymedical_admin:$DB_PASSWORD@<endpoint>:5432/fymedical?sslmode=require"
export DIRECT_URL="$DATABASE_URL"
npm run db:migrate
ADMIN_EMAIL=<clinic admin email> ADMIN_PASSWORD='<12+ chars>' ADMIN_NAME='<name>' npm run db:seed

psql "$DATABASE_URL" <<SQL
CREATE ROLE fymedical_app LOGIN PASSWORD '$APP_DB_PASSWORD';
GRANT CONNECT ON DATABASE fymedical TO fymedical_app;
GRANT USAGE ON SCHEMA public TO fymedical_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO fymedical_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO fymedical_app;
ALTER DEFAULT PRIVILEGES FOR ROLE fymedical_admin IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO fymedical_app;
ALTER DEFAULT PRIVILEGES FOR ROLE fymedical_admin IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO fymedical_app;
SQL
```

(`psql` comes with `brew install libpq` if it isn't on your Mac.)

## 4. Amplify app (console, because it connects GitHub)

1. Amplify console, region **Europe (Ireland)**: *Create new app*, *GitHub*, authorise,
   pick `moronicgeek/FYMedicalAesthetics`, branch `main`. It detects Next.js SSR and reads `amplify.yml`.
2. Before the first build, add the environment variables (*Advanced settings*, or later
   *Hosting, Environment variables*):

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | the app login: `postgresql://fymedical_app:<APP_DB_PASSWORD>@<endpoint>:5432/fymedical?sslmode=require` |
   | `DIRECT_URL` | the admin URL from step 3 (the build uses it for migrations) |
   | `ENCRYPTION_KEY`, `BLIND_INDEX_KEY`, `CRON_SECRET` | from step 1 |
   | `CLINIC_NAME`, `CLINIC_ADDRESS` | clinic details |
   | `CLINIC_TIMEZONE` | `Africa/Johannesburg` |
   | `DEFAULT_COUNTRY_CODE` | `27` |
   | `REMINDER_HOURS_AHEAD` | `24` |
   | `CLINIC_INBOX_EMAIL` | clinic inbox for signed consents |
   | `APP_URL` | `https://main.<app id>.amplifyapp.com` for now (the app id is in the console URL after creating) |

3. Save and deploy. The build runs `npm ci`, the migrations (already applied, so a no-op), then `next build`.
   If `APP_URL` was a guess, correct it and choose *Redeploy this version*.
4. Sign in at the Amplify URL with the administrator from step 3.

## 5. After it's live

- **Full certificate checks (follow-up code change):** commit the RDS CA bundle
  (`https://truststore.pki.rds.amazonaws.com/eu-west-1/eu-west-1-bundle.pem`) to `prisma/` and change
  both URLs' `sslmode=require` to `sslmode=verify-full&sslrootcert=eu-west-1-bundle.pem`, so the app refuses
  a server that isn't the real RDS instance.
- **Custom domain:** *Hosting, Custom domains*, add e.g. `portal.<clinic domain>`, add the DNS records at the registrar,
  then set `APP_URL` to it and redeploy.
- **Reminders:** once `APP_URL` is final:
  ```sh
  aws cloudformation deploy --stack-name fymedical-reminders \
    --template-file infra/reminders-schedule.yml --capabilities CAPABILITY_IAM \
    --parameter-overrides AppUrl=<APP_URL> CronSecret=<CRON_SECRET>
  ```
- **Email:** Resend API key and `EMAIL_FROM` once the domain verifies, then redeploy.
- **WhatsApp:** Twilio SID, token, sender number and template SIDs once Meta approves; set the inbound webhook to
  `POST <APP_URL>/api/twilio/inbound`.
- **Disaster recovery gaps** still open (docs/disaster-recovery.md): offline key copies, Frankfurt backup copy, restore test.
