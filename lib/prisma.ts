import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForDB = global as unknown as { db: PrismaClient };

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

export const db =
  globalForDB.db ||
  new PrismaClient({
    // @ts-expect-error - Sometimes TS takes a second to catch up to the new adapter type
    adapter: adapter,
  });

if (process.env.NODE_ENV !== "production") globalForDB.db = db;