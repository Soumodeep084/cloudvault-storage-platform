import { getSessionUser } from "@/lib/auth-help";
import { db } from "@/lib/prisma";
import { redirectToStorageObject } from "@/lib/storage-delivery";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await Promise.resolve(params);

  const file = await db.file.findFirst({
    where: {
      id,
      userId: user.id,
      isDeleted: false,
      isTrashed: false,
    },
    select: {
      fileUrl: true,
      fileName: true,
      fileType: true,
    },
  });

  if (!file) {
    return NextResponse.json({ message: "File not found" }, { status: 404 });
  }

  return redirectToStorageObject({
    fileUrl: file.fileUrl,
    fileName: file.fileName,
  });
}
