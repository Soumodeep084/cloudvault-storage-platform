import { NextRequest, NextResponse } from "next/server";
import { ActivityAction } from "@prisma/client";
import { db } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase";
import { extractStoragePathFromUrl } from "@/lib/storage-path";

export const runtime = "nodejs";

function getShareAccessCookieName(shareId: string) {
  return `share_access_${shareId}`;
}

function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || null;
  }

  const realIp = request.headers.get("x-real-ip");
  return realIp?.trim() || null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> | { token: string } },
) {
  const { token } = await Promise.resolve(params);

  const share = await db.share.findFirst({
    where: {
      shareLink: { endsWith: `/s/${token}` },
      isPublic: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    include: {
      file: {
        select: {
          id: true,
          userId: true,
          fileName: true,
          fileUrl: true,
          isDeleted: true,
        },
      },
    },
  });

  if (!share || !share.file || share.file.isDeleted) {
    return NextResponse.json({ message: "Share not found" }, { status: 404 });
  }

  if (share.password) {
    const accessCookie = request.cookies.get(getShareAccessCookieName(share.id))?.value;
    if (accessCookie !== token) {
      return NextResponse.json({ message: "Password validation required" }, { status: 401 });
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
    .createSignedUrl(storagePath, 60 * 2, { download: share.file.fileName });

  if (error || !data?.signedUrl) {
    return NextResponse.json({ message: "Unable to create download URL" }, { status: 500 });
  }

  await db.activity.create({
    data: {
      userId: share.userId,
      action: ActivityAction.DOWNLOAD,
      fileId: share.file.id,
      metadata: {
        shareId: share.id,
        fileId: share.file.id,
        fileName: share.file.fileName,
        shareToken: token,
        viewerIp: getClientIp(request),
        viewerAgent: request.headers.get("user-agent"),
      },
    },
  });

  return NextResponse.redirect(data.signedUrl, { status: 302 });
}
