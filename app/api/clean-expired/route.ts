import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";

export async function GET() {
  try {
    const now = new Date();

    const [expiredSessions, expiredTokens, expiredShares, expiredFolderShares] = await db.$transaction([
      db.session.deleteMany({ where: { expiresAt: { lte: now } } }),
      db.token.deleteMany({ where: { expiresAt: { lte: now } } }),
      db.share.deleteMany({ where: { expiresAt: { lte: now } } }),
      db.folderShare.deleteMany({ where: { expiresAt: { lte: now } } }),
    ]);

    return NextResponse.json({
      success: true,
      deletedSessions: expiredSessions.count,
      deletedTokens: expiredTokens.count,
      deletedShares: expiredShares.count,
      deletedFolderShares: expiredFolderShares.count,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Something went wrong";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}