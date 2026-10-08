import "server-only";
import { db } from "./db";
import { clientIp, type SessionUser } from "./auth";

export async function audit(user: SessionUser | null, action: string, entity: string, entityId?: string) {
  await db.auditLog.create({
    data: { userId: user?.id, action, entity, entityId, ipAddress: await clientIp() },
  });
}
