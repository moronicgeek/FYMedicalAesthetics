"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { encryptJson } from "@/lib/crypto";
import { db } from "@/lib/db";
import { appUrl, clinicName, sendEmail } from "@/lib/notify";
import { deviceLabel, problemSchema, screenPath, type ProblemDetails } from "@/lib/problem-reports";
import { formatDateTime } from "@/lib/time";
import { fieldErrors, formToObject, type FieldErrors } from "@/lib/validation";

export type ProblemFormState = { errors?: FieldErrors; values?: Record<string, string>; sent?: boolean };

const ROLE_LABEL = { ADMIN: "Administrator", DOCTOR: "Doctor", PRACTITIONER: "Practitioner", RECEPTION: "Reception" } as const;

export async function reportProblemAction(_prev: ProblemFormState, form: FormData): Promise<ProblemFormState> {
  const user = await requireUser();
  const values = formToObject(form);
  const parsed = problemSchema.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  const details: ProblemDetails = { whatHappened: parsed.data.whatHappened, expected: parsed.data.expected };
  const path = screenPath(parsed.data.path);
  const device = deviceLabel((await headers()).get("user-agent"), parsed.data.screen);
  const report = await db.problemReport.create({
    data: { userId: user.id, role: user.role, path, device, details: encryptJson(details) },
  });
  await audit(user, "create", "ProblemReport", report.id);

  // What they typed stays in the app: staff may mention a patient however
  // clearly we ask them not to, and email is the wrong place for that.
  const to = process.env.PROBLEM_REPORT_EMAIL;
  if (to) {
    await sendEmail(
      to,
      `Problem reported in the ${clinicName()} app`,
      [
        `${user.name} (${ROLE_LABEL[user.role]}) reported a problem.`,
        `Screen: ${path}\nWhen: ${formatDateTime(report.createdAt)}${device ? `\nDevice: ${device}` : ""}`,
        `Read what they wrote: ${appUrl()}/problems`,
      ].join("\n\n"),
    );
  }
  revalidatePath("/problems");
  return { sent: true };
}

export async function setProblemStatusAction(form: FormData) {
  const admin = await requireUser(["ADMIN"]);
  const id = String(form.get("id"));
  const fixed = form.get("status") === "FIXED";
  await db.problemReport.update({ where: { id }, data: { status: fixed ? "FIXED" : "OPEN", fixedAt: fixed ? new Date() : null } });
  await audit(admin, fixed ? "mark-fixed" : "reopen", "ProblemReport", id);
  revalidatePath("/problems");
}
