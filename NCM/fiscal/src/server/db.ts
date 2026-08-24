import "server-only";

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export async function withTenant<T>(
  companyId: string,
  fn: (db: PrismaClient) => Promise<T>,
  options?: { timeout?: number; maxWait?: number },
): Promise<T> {
  if (!companyId) {
    throw new Error("Empresa ativa não informada");
  }
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.company_id', ${companyId}, true)`;
      return fn(tx as unknown as PrismaClient);
    },
    {
      maxWait: options?.maxWait ?? 2_000,
      timeout: options?.timeout ?? 5_000,
    },
  );
}

export const LONG_TX = { timeout: 60_000, maxWait: 10_000 } as const;
