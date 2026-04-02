import { getSessionUser } from "@/lib/auth-help";
import { NextResponse } from "next/server";

export async function GET() {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(user, { status: 200 });
}