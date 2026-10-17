import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { decryptPatient } from "@/lib/patients";
import { clinicDateString } from "@/lib/time";

// A cell that starts with = + - @ could run as a formula in Excel, so it is
// prefixed with an apostrophe; quotes are doubled and every cell quoted.
function cell(value: string | number | undefined | null) {
  const text = value == null ? "" : String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

const HEADERS = [
  "First name", "Surname", "Preferred name", "ID or passport number", "Date of birth", "Gender",
  "Mobile", "Email", "Address", "Emergency contact", "Emergency contact number",
  "Conditions", "Medications", "Allergies", "Previous treatments",
  "Marketing consent", "Registered", "Visits", "Last visit",
];

// Administrators download every patient's details as a spreadsheet (CSV).
export async function GET() {
  const user = await requireUser(["ADMIN"]);
  const rows = await db.patient.findMany({
    orderBy: { createdAt: "asc" },
    include: { cases: { select: { createdAt: true }, orderBy: { createdAt: "desc" } } },
  });
  const lines = rows.map((row) => {
    const p = decryptPatient(row);
    const last = row.cases[0]?.createdAt;
    return [
      p.firstName, p.lastName, p.preferredName, p.idNumber, p.dateOfBirth, p.gender,
      p.phone, p.email, p.address, p.emergencyContact?.name, p.emergencyContact?.phone,
      p.medical?.conditions, p.medical?.medications, p.medical?.allergies, p.medical?.previousTreatments,
      p.consent?.marketing ? "Yes" : "No", clinicDateString(row.createdAt), row.cases.length, last ? clinicDateString(last) : "",
    ].map(cell).join(",");
  });
  await audit(user, "patients-exported", "Patient");
  // The byte-order mark makes Excel read the file as UTF-8.
  const csv = "﻿" + [HEADERS.map(cell).join(","), ...lines].join("\r\n") + "\r\n";
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="lumiere-patients-${clinicDateString()}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
