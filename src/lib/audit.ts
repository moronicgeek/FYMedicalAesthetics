import "server-only";
import { headers } from "next/headers";
import { db } from "./db";
import { ipFromForwardedFor } from "./client-ip";
import type { SessionUser } from "./auth";

export async function clientIp(): Promise<string | null> {
  const h = await headers();
  return ipFromForwardedFor(h.get("x-forwarded-for")) ?? h.get("x-real-ip");
}

export async function audit(user: Pick<SessionUser, "id"> | null, action: string, entity: string, entityId?: string) {
  await db.auditLog.create({
    data: { userId: user?.id, action, entity, entityId, ipAddress: await clientIp() },
  });
}
