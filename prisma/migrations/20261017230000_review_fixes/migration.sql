-- Failed sign-ins are limited per email and IP address as well as per email.
ALTER TABLE "LoginAttempt" ADD COLUMN "ipAddress" TEXT;

-- Why a doctor's answer given by phone was recorded by staff (encrypted).
ALTER TABLE "TreatmentCase" ADD COLUMN "doctorDecisionNote" TEXT;
