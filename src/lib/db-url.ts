import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_RDS_CA, RDS_CAS, type RdsCa } from "./rds-ca";

// The database has a public endpoint (Amplify can't join a VPC), so the app
// must check it is talking to the real RDS server, not just encrypt. Prisma
// ignores libpq's sslmode=verify-full and sslrootcert: it wants the CA file in
// sslcert and sslaccept=strict, which checks the chain and the hostname.
export function verifiedDatabaseUrl(url: string, caFile: string): string {
  const u = new URL(url);
  if (!u.hostname.endsWith(".rds.amazonaws.com")) return url;
  u.searchParams.delete("sslrootcert");
  u.searchParams.set("sslmode", "require");
  u.searchParams.set("sslcert", caFile);
  u.searchParams.set("sslaccept", "strict");
  return u.toString();
}

// Prisma only takes the CA as a file path, and the app's own files aren't at a
// known path once deployed, so the bundled certificate goes in a temp file.
export function databaseUrlWithCa(url: string | undefined, ca = process.env.RDS_CA_CERTIFICATE || DEFAULT_RDS_CA): string | undefined {
  if (!url) return url;
  const pem = RDS_CAS[ca as RdsCa];
  if (!pem) throw new Error(`RDS_CA_CERTIFICATE must be one of: ${Object.keys(RDS_CAS).join(", ")}`);
  const caFile = join(tmpdir(), `${ca}.pem`);
  writeFileSync(caFile, pem);
  return verifiedDatabaseUrl(url, caFile);
}
