import { createHmac, timingSafeEqual } from "node:crypto";
import { handleDoctorReply } from "@/lib/cases";

export const dynamic = "force-dynamic";

// Twilio signs each webhook: HMAC-SHA1 over the full URL followed by every
// POST parameter (sorted by name, key then value), keyed with the auth token.
function validSignature(url: string, params: URLSearchParams, signature: string | null) {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token || !signature) return false;
  const data = [...params.keys()].sort().reduce((acc, k) => acc + k + params.getAll(k).join(""), url);
  const expected = Buffer.from(createHmac("sha1", token).update(data).digest("base64"));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

function twiml(message: string) {
  const escaped = message.replace(/[<>&'"]/g, (ch) => `&#${ch.charCodeAt(0)};`);
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`, {
    headers: { "Content-Type": "text/xml" },
  });
}

// Configure in Twilio as the "A message comes in" webhook (HTTP POST) for the
// WhatsApp sender: https://<your domain>/api/twilio/inbound
export async function POST(req: Request) {
  const params = new URLSearchParams(await req.text());
  const url = `${(process.env.APP_URL || "").replace(/\/$/, "")}/api/twilio/inbound`;
  if (!validSignature(url, params, req.headers.get("x-twilio-signature"))) {
    return new Response("Forbidden", { status: 403 });
  }
  const answer = await handleDoctorReply(params.get("From") ?? "", params.get("Body") ?? "");
  return twiml(answer);
}
