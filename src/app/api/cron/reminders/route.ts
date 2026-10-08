import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { sendReminders } from "@/lib/appointments";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function authorised(req: Request) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization") ?? "";
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

// Called by the hosting scheduler (see vercel.json). Vercel sends
// "Authorization: Bearer $CRON_SECRET" automatically.
export async function GET(req: Request) {
  if (!authorised(req)) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const hours = Number(process.env.REMINDER_HOURS_AHEAD || 24);
  const result = await sendReminders(new Date(), hours);
  // Expired sessions and old login attempts are cleaned up on the same schedule.
  await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await db.loginAttempt.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 30 * 86_400_000) } } });
  await db.auditLog.create({ data: { action: "reminders", entity: "System", entityId: `${result.patientReminders}/${result.appointments}` } });
  return NextResponse.json(result);
}
