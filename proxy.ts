import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import { db } from "@/lib/prisma";

function hasValidAuthToken(token?: string) {
  if (!token) return false;

  try {
    jwt.verify(token, process.env.JWT_SECRET || "dev-only-secret-change-me");
    return true;
  } catch {
    return false;
  }
}

async function hasValidSessionToken(token?: string) {
  if (!token) return false;

  const session = await db.session.findUnique({
    where: { token },
    select: { expiresAt: true },
  });

  return !!session && session.expiresAt > new Date();
}

export async function proxy(request: NextRequest) {
  const token = request.cookies.get("auth_token")?.value;
  const { pathname } = request.nextUrl;
  const isAuthenticated =
    hasValidAuthToken(token) && (await hasValidSessionToken(token));

  // If logged in and trying to access login/signup, go to dashboard
  if (isAuthenticated && (pathname === "/login" || pathname === "/signup" || pathname === "/")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // If NOT logged in and trying to access dashboard, go to login
  if (!isAuthenticated && pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/dashboard/:path*", "/login", "/signup"],
};
