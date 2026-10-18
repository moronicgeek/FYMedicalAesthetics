// Prints the given database URL with full certificate checks for RDS, for
// commands run outside the app (migrations at build, psql from a Mac):
//   export DIRECT_URL="$(npx tsx scripts/db-url.ts "$DIRECT_URL")"
import { databaseUrlWithCa } from "../src/lib/db-url";

const url = process.argv[2];
if (!url) {
  console.error("Usage: npx tsx scripts/db-url.ts <postgresql://...>");
  process.exit(1);
}
process.stdout.write(databaseUrlWithCa(url)!);
