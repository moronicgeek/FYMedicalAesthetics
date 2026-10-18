import { Prisma, PrismaClient } from "@prisma/client";

// Never loaded unless a query asks for them by name: the password hash (only
// login checks it) and the ID photo (a few hundred KB each, only the photo
// route reads it). Every other query, including lists of patients or staff,
// gets the row without them.
const options = { omit: { user: { passwordHash: true }, patient: { idPhoto: true } } } satisfies Prisma.PrismaClientOptions;

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient<typeof options> };

export const db = globalForPrisma.prisma ?? new PrismaClient(options);

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
