import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForDB = global as unknown as { db: PrismaClient };

const connectionString = process.env.DATABASE_URL;
if (process.env.NODE_ENV === "production" && !connectionString) {
  throw new Error("Missing required env: DATABASE_URL");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

export const db =
  globalForDB.db ||
  new PrismaClient({
    adapter: adapter,
  });

if (process.env.NODE_ENV !== "production") globalForDB.db = db;