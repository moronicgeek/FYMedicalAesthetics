import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { setStaffActiveAction } from "@/app/actions/staff";
import { AddStaffForm, ResetPasswordForm } from "@/components/StaffForms";

export const metadata = { title: "Staff" };

const ROLE = { ADMIN: "Administrator", DOCTOR: "Doctor", PRACTITIONER: "Practitioner (nurse)", RECEPTION: "Reception" } as const;

export default async function StaffPage() {
  const admin = await requireUser(["ADMIN"]);
  const staff = await db.user.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] });
  return (
    <div className="space-y-6">
      <h1 className="page-title">Staff</h1>
      <section className="card" aria-labelledby="add-heading">
        <h2 id="add-heading" className="section-title mb-4">Add a staff member</h2>
        <AddStaffForm />
      </section>
      <section className="card" aria-labelledby="list-heading">
        <h2 id="list-heading" className="section-title mb-2">Everyone with access</h2>
        <ul className="divide-y divide-line">
          {staff.map((s) => (
            <li key={s.id} className="space-y-3 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-bold">{s.name} {!s.active && <span className="badge badge-CANCELLED">No access</span>}</p>
                  <p className="muted">{ROLE[s.role]} · {s.email}{s.phone ? ` · ${s.phone}` : ""}</p>
                </div>
                {s.id !== admin.id && (
                  <form action={setStaffActiveAction}>
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="active" value={String(!s.active)} />
                    <button type="submit" className={s.active ? "btn btn-danger" : "btn btn-secondary"}>{s.active ? "Remove access" : "Restore access"}</button>
                  </form>
                )}
              </div>
              {s.active && <ResetPasswordForm id={s.id} name={s.name} />}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
