// South African ID numbers start with the holder's date of birth (YYMMDD), so
// the practitioner doesn't have to ask for it separately. Anything that isn't
// a valid 13-digit SA ID (a passport number, say) gives no date.
export function dateOfBirthFromSaId(idNumber: string | undefined, now = new Date()): string | undefined {
  const id = (idNumber ?? "").replace(/\s/g, "");
  if (!/^\d{13}$/.test(id) || !luhnValid(id)) return undefined;
  const yy = Number(id.slice(0, 2));
  const century = 2000 + yy > now.getUTCFullYear() ? 1900 : 2000;
  const date = `${century + yy}-${id.slice(2, 4)}-${id.slice(4, 6)}`;
  const parsed = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : undefined;
}

function luhnValid(digits: string) {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}
