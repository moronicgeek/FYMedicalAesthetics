import { isIP } from "node:net";

const PRIVATE_V4 = [/^10\./, /^127\./, /^169\.254\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./];

function isPrivate(ip: string) {
  if (isIP(ip) === 4) return PRIVATE_V4.some((re) => re.test(ip));
  const v6 = ip.toLowerCase();
  return v6 === "::1" || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6);
}

// The visitor's IP address from X-Forwarded-For. Each proxy in front of the
// app (CloudFront, on Amplify) appends the address the request came from, so
// the leftmost entries are whatever the browser sent and can be faked. The
// last public address is the one our own proxy saw; private addresses after it
// are internal AWS hops.
export function ipFromForwardedFor(header: string | null): string | null {
  const hops = (header ?? "").split(",").map((s) => s.trim()).filter((s) => isIP(s));
  if (hops.length === 0) return null;
  return [...hops].reverse().find((ip) => !isPrivate(ip)) ?? hops[hops.length - 1];
}
