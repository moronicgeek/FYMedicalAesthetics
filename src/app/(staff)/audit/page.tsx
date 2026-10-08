import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/time";

export const metadata = { title: "Access log" };

export default async function AuditPage() {
  await requireUser(["ADMIN"]);
  const logs = await db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { user: { select: { name: true } } } });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Access log</h1>
        <p className="muted">Every time someone signs in, views or changes a patient record. Showing the latest 200 entries.</p>
      </div>
      <section className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr><th scope="col">When</th><th scope="col">Who</th><th scope="col">Action</th><th scope="col">Record</th><th scope="col">IP address</th></tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td>{formatDateTime(l.createdAt)}</td>
                <td>{l.user?.name ?? "System"}</td>
                <td>{l.action}</td>
                <td>{l.entity === "Patient" && l.entityId ? <Link href={`/patients/${l.entityId}`}>Patient</Link> : l.entity}</td>
                <td>{l.ipAddress ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
