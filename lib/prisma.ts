import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as {
  pool?: Pool;
  db?: PrismaClient;
};

const connectionString = process.env.DATABASE_URL;
if (process.env.NODE_ENV === "production" && !connectionString) {
  throw new Error("Missing required env: DATABASE_URL");
}


const pool =
  globalForPrisma.pool ??
  new Pool({
    connectionString,
    max: 8, // you can even use 5 if your traffic is low
    idleTimeoutMillis: 30000, connectionTimeoutMillis: 2000
  });

const db =
  globalForPrisma.db ??
  new PrismaClient({
    adapter: new PrismaPg(pool),
  });


if (process.env.NODE_ENV !== "production") {
  globalForPrisma.pool = pool;
  globalForPrisma.db = db;
}

export { db };