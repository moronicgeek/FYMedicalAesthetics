import "server-only";

// Messages deliberately leave out treatment details: SMS and email are not
// secure channels, so they only say when and where the appointment is.

const CLINIC = () => process.env.CLINIC_NAME || "FY Medical Aesthetics";

export type SendResult = { channel: "email" | "sms"; ok: boolean; skipped?: boolean; error?: string };

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

export async function sendSms(to: string, body: string, channel: "sms" | "whatsapp" = "sms"): Promise<SendResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const smsFrom = process.env.TWILIO_FROM_NUMBER;
  const waFrom = process.env.TWILIO_WHATSAPP_FROM;
  const from = channel === "whatsapp" ? waFrom && `whatsapp:${waFrom}` : smsFrom;
  if (channel === "whatsapp") to = `whatsapp:${to}`;
  if (!sid || !token || !from) {
    if (process.env.NODE_ENV !== "production") console.info("[sms skipped: not configured]");
    return { channel: "sms", ok: false, skipped: true };
  }
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
    });
    return res.ok ? { channel: "sms", ok: true } : { channel: "sms", ok: false, error: `HTTP ${res.status}` };
  } catch (e) {
    return { channel: "sms", ok: false, error: (e as Error).message };
  }
}

type Contact = { name: string; email?: string; phone?: string; contactPreference: "sms" | "email" | "both" };

export async function notifyPatient(patient: Contact, subject: string, message: string) {
  const results: SendResult[] = [];
  const text = `Hello ${patient.name},\n\n${message}\n\n${CLINIC()}`;
  if (patient.email && patient.contactPreference !== "sms") results.push(await sendEmail(patient.email, subject, text));
  if (patient.phone && patient.contactPreference !== "email") results.push(await sendSms(patient.phone, `${CLINIC()}: ${message}`));
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

// Doctors get IV drip approval requests by SMS, or WhatsApp when
// DOCTOR_CHANNEL=whatsapp.
export function doctorChannel(): "sms" | "whatsapp" {
  return process.env.DOCTOR_CHANNEL === "whatsapp" ? "whatsapp" : "sms";
}

export async function messageDoctor(phone: string, body: string) {
  return sendSms(phone, body, doctorChannel());
}
