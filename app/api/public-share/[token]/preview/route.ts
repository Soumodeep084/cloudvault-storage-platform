import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase";
import { extractStoragePathFromUrl } from "@/lib/storage-path";
import {
  getPublicShareAccessCookieName,
  isValidPublicShareAccessCookie,
} from "@/lib/public-share-access";

export const runtime = "nodejs";

function buildContentDisposition(fileName: string) {
  const encodedName = encodeURIComponent(fileName);
  return `inline; filename*=UTF-8''${encodedName}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> | { token: string } },
) {
  const { token } = await Promise.resolve(params);

  const share = await db.share.findFirst({
    where: {
      token,
      isPublic: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    include: {
      file: {
        select: {
          id: true,
          fileName: true,
          fileUrl: true,
          fileType: true,
          isDeleted: true,
        },
      },
    },
  });

  if (!share || !share.file || share.file.isDeleted) {
    return NextResponse.json({ message: "Share not found" }, { status: 404 });
  }

  if (share.password) {
    const accessCookie = request.cookies.get(getPublicShareAccessCookieName(share.id))?.value;
    if (!isValidPublicShareAccessCookie(share.id, accessCookie)) {
      return NextResponse.redirect(new URL(`/s/${token}?error=auth-required`, request.url));
    }
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ message: "Server storage config missing" }, { status: 500 });
  }

  const storagePath = extractStoragePathFromUrl(share.file.fileUrl);
  if (!storagePath) {
    return NextResponse.json({ message: "Invalid storage path" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.storage
    .from("files")
    .download(storagePath);

  if (error || !data) {
    return NextResponse.json({ message: "Unable to fetch file" }, { status: 500 });
  }

  const fileBuffer = Buffer.from(await data.arrayBuffer());
  const contentType = share.file.fileType || data.type || "application/octet-stream";

  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": buildContentDisposition(share.file.fileName),
      "Cache-Control": "private, max-age=60",
    },
  });
}
