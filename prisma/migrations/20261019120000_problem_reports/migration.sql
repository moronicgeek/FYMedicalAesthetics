-- Problems staff report from the app.
CREATE TYPE "ProblemStatus" AS ENUM ('OPEN', 'FIXED');

CREATE TABLE "ProblemReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "role" "Role" NOT NULL,
    "path" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "device" TEXT,
    "status" "ProblemStatus" NOT NULL DEFAULT 'OPEN',
    "fixedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProblemReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProblemReport_status_createdAt_idx" ON "ProblemReport"("status", "createdAt");

ALTER TABLE "ProblemReport" ADD CONSTRAINT "ProblemReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
