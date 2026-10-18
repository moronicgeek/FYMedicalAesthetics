import { describe, expect, it } from "vitest";
import { databaseUrlWithCa, verifiedDatabaseUrl } from "@/lib/db-url";
import { RDS_CAS } from "@/lib/rds-ca";

// No password in the test URLs: secret scanners flag them even when fake.
function rdsUrl(query = "") {
  return `postgresql://example_user@example-db.eu-west-1.rds.amazonaws.com:5432/example${query}`;
}

describe("verifiedDatabaseUrl", () => {
  it("turns on certificate and hostname checks for RDS", () => {
    const u = new URL(verifiedDatabaseUrl(rdsUrl("?sslmode=require"), "/tmp/ca.pem"));
    expect(u.username).toBe("example_user");
    expect(u.searchParams.get("sslmode")).toBe("require");
    expect(u.searchParams.get("sslcert")).toBe("/tmp/ca.pem");
    expect(u.searchParams.get("sslaccept")).toBe("strict");
  });

  it("replaces libpq-style settings Prisma would ignore", () => {
    const u = new URL(verifiedDatabaseUrl(rdsUrl("?sslmode=verify-full&sslrootcert=bundle.pem&connection_limit=5"), "/tmp/ca.pem"));
    expect(u.searchParams.get("sslrootcert")).toBeNull();
    expect(u.searchParams.get("sslmode")).toBe("require");
    expect(u.searchParams.get("connection_limit")).toBe("5");
  });

  it("leaves a local database alone", () => {
    const url = "postgresql://localhost:5432/example";
    expect(verifiedDatabaseUrl(url, "/tmp/ca.pem")).toBe(url);
  });

  it("keeps exactly one certificate per CA, since Prisma reads only the first", () => {
    for (const pem of Object.values(RDS_CAS)) expect(pem.match(/BEGIN CERTIFICATE/g)).toHaveLength(1);
  });

  it("uses the chosen CA and refuses an unknown one", () => {
    const rds = rdsUrl();
    expect(new URL(databaseUrlWithCa(rds, "rds-ca-ecc384-g1")!).searchParams.get("sslcert")).toMatch(/rds-ca-ecc384-g1\.pem$/);
    expect(() => databaseUrlWithCa(rds, "rds-ca-2019")).toThrow(/RDS_CA_CERTIFICATE/);
  });
});
