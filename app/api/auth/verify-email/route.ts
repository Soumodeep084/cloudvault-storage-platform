import { consumeEmailVerificationToken } from "@/lib/email-verification";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/verify-email?status=missing", request.url));
  }

  const result = await consumeEmailVerificationToken(token);

  if (result.status === "verified") {
    return NextResponse.redirect(new URL("/verify-email?status=success", request.url));
  }

  if (result.status === "expired") {
    return NextResponse.redirect(new URL("/verify-email?status=expired", request.url));
  }

  return NextResponse.redirect(new URL("/verify-email?status=invalid", request.url));
}
