import { db } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === "production" && !secret) {
    throw new Error("Missing required env: JWT_SECRET");
  }
  return secret || "";
}

export async function hashPassword(password: string) {
  return await bcrypt.hash(password, 12);
}

export async function comparePasswords(password: string, hash: string) {
  return await bcrypt.compare(password, hash);
}

export async function createSession(userId: string) {
  const token = jwt.sign({ userId }, getJwtSecret(), { expiresIn: "7d" });
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // Prisma 7 requires the session to be stored
  await db.session.create({
    data: {
      userId,
      token,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set("auth_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

export async function getSessionUser() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;

    if (!token) return null;

    // 1. Verify JWT signature and expiry.
    const decoded = jwt.verify(token, getJwtSecret()) as { userId: string };

    if (!decoded || !decoded.userId) return null;

    // 2. Ensure session token still exists and has not expired.
    const session = await db.session.findUnique({
      where: { token },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isVerified: true,
            deleted: true,
          },
        },
      },
    });

    if (!session || session.expiresAt <= new Date()) {
      cookieStore.delete("auth_token");
      return null;
    }

    if (session.userId !== decoded.userId) {
      cookieStore.delete("auth_token");
      return null;
    }

    if (session.user.deleted) {
      await db.session.deleteMany({ where: { userId: session.userId } });
      cookieStore.delete("auth_token");
      return null;
    }

    return session.user;
  } catch {
    // If token is expired or invalid, jwt.verify throws an error
    return null;
  }
}

export async function deleteSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (token) {
    // Use deleteMany to avoid "Record not found" crashes
    await db.session.deleteMany({ where: { token } });
  }
  cookieStore.delete("auth_token");
}