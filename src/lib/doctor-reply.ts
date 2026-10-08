// Matches a WhatsApp reply like "YES 4821", "no", "y #4821".
// Without a code it only works if exactly one case is waiting for that doctor.
export function parseDoctorReply(body: string): { approve: boolean; code?: string } | null {
  const m = body.trim().match(/^(yes|y|no|n)\b[\s#:.-]*(\d{4,5})?/i);
  if (!m) return null;
  return { approve: m[1].toLowerCase().startsWith("y"), code: m[2] };
}
