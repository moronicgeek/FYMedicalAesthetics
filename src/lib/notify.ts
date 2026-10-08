import "server-only";

// Patients and doctors are messaged by WhatsApp (through Twilio) and email.
// Appointment messages deliberately leave out treatment details, so they only
// say when and where the appointment is.

const CLINIC = () => process.env.CLINIC_NAME || "FY Medical Aesthetics";

export type SendResult = { channel: "email" | "whatsapp"; ok: boolean; skipped?: boolean; error?: string };

export type Attachment = { filename: string; content: Buffer };

export async function sendEmail(to: string | string[], subject: string, text: string, attachments: Attachment[] = []): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    if (process.env.NODE_ENV !== "production") console.info(`[email skipped: not configured] ${subject}`);
    return { channel: "email", ok: false, skipped: true };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: Array.isArray(to) ? to : [to],
        subject,
        text,
        attachments: attachments.map((a) => ({ filename: a.filename, content: a.content.toString("base64") })),
      }),
    });
    return res.ok ? { channel: "email", ok: true } : { channel: "email", ok: false, error: `HTTP ${res.status}` };
  } catch (e) {
    return { channel: "email", ok: false, error: (e as Error).message };
  }
}

// WhatsApp only allows free-form text inside a 24-hour window after the person
// last wrote to the clinic. Anything the clinic starts (confirmations,
// reminders, approval requests) must use a template Meta has approved. Each
// template's Twilio Content SID is set in the environment; the variables are
// numbered {{1}}, {{2}}… in the order given here. See README for the wording.
export const WHATSAPP_TEMPLATES = {
  bookingConfirmation: "TWILIO_TEMPLATE_BOOKING",
  appointmentReminder: "TWILIO_TEMPLATE_REMINDER",
  doctorApproval: "TWILIO_TEMPLATE_DOCTOR_APPROVAL",
} as const;

export type WhatsAppTemplate = keyof typeof WHATSAPP_TEMPLATES;

export type WhatsAppMessage = { template: WhatsAppTemplate; variables: string[]; fallbackText: string };

export function whatsAppParams(to: string, from: string, msg: WhatsAppMessage): Record<string, string> {
  const contentSid = process.env[WHATSAPP_TEMPLATES[msg.template]];
  const base = { To: `whatsapp:${to}`, From: `whatsapp:${from}` };
  if (!contentSid) return { ...base, Body: msg.fallbackText };
  // Template variables can't contain newlines or tabs, or more than 4 spaces in a row.
  const variables = Object.fromEntries(msg.variables.map((v, i) => [String(i + 1), v.replace(/\s+/g, " ").trim() || "-"]));
  return { ...base, ContentSid: contentSid, ContentVariables: JSON.stringify(variables) };
}

export async function sendWhatsApp(to: string, msg: WhatsAppMessage): Promise<SendResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!sid || !token || !from) {
    if (process.env.NODE_ENV !== "production") console.info(`[whatsapp skipped: not configured] ${msg.template}`);
    return { channel: "whatsapp", ok: false, skipped: true };
  }
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(whatsAppParams(to, from, msg)),
    });
    return res.ok ? { channel: "whatsapp", ok: true } : { channel: "whatsapp", ok: false, error: `HTTP ${res.status}` };
  } catch (e) {
    return { channel: "whatsapp", ok: false, error: (e as Error).message };
  }
}

export type ContactPreference = "whatsapp" | "email" | "both";

type Contact = { name: string; email?: string; phone?: string; contactPreference: ContactPreference };

export async function notifyPatient(patient: Contact, email: { subject: string; text: string }, whatsapp: WhatsAppMessage) {
  const results: SendResult[] = [];
  if (patient.email && patient.contactPreference !== "whatsapp") {
    results.push(await sendEmail(patient.email, email.subject, `Hello ${patient.name},\n\n${email.text}\n\n${CLINIC()}`));
  }
  if (patient.phone && patient.contactPreference !== "email") results.push(await sendWhatsApp(patient.phone, whatsapp));
  return results;
}

export async function notifyDoctor(doctor: { name: string; email: string; phone?: string | null }, subject: string, message: string) {
  return [await sendEmail(doctor.email, subject, `Hello ${doctor.name},\n\n${message}\n\n${CLINIC()}`)];
}

export function anySent(results: SendResult[]) {
  return results.some((r) => r.ok);
}

export function clinicName() {
  return CLINIC();
}
