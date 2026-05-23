import { getSessionUser } from "@/lib/auth-help";
import { db } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase";
import { extractStoragePathFromUrl } from "@/lib/storage-path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function buildContentDisposition(fileName: string) {
  const encodedName = encodeURIComponent(fileName);
  return `inline; filename*=UTF-8''${encodedName}`;
}

export async function GET(
  request: Request,
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

  const rangeHeader = request.headers.get("range");
  const storagePath = extractStoragePathFromUrl(file.fileUrl);
  if (!rangeHeader && supabaseAdmin && storagePath) {
    const { data, error } = await supabaseAdmin.storage
      .from("files")
      .download(storagePath);

    if (!error && data) {
      const fileBuffer = Buffer.from(await data.arrayBuffer());
      const contentType = file.fileType || data.type || "application/octet-stream";

      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": buildContentDisposition(file.fileName),
          "Cache-Control": "private, max-age=60",
        },
      });
    }
  }

  try {
    let upstreamUrl = file.fileUrl;
    if (rangeHeader && supabaseAdmin && storagePath) {
      const { data } = await supabaseAdmin.storage
        .from("files")
        .createSignedUrl(storagePath, 60);
      if (data?.signedUrl) {
        upstreamUrl = data.signedUrl;
      }
    }

    const upstream = await fetch(upstreamUrl, {
      cache: "no-store",
      headers: rangeHeader ? { range: rangeHeader } : undefined,
    });
    if (!upstream.ok || !upstream.body) {
      return NextResponse.redirect(file.fileUrl, { status: 302 });
    }

    const contentType =
      upstream.headers.get("content-type") || file.fileType || "application/octet-stream";
    const headers = new Headers(upstream.headers);
    headers.set("Content-Type", contentType);
    headers.set("Content-Disposition", buildContentDisposition(file.fileName));
    headers.set("Cache-Control", "private, max-age=60");
    headers.set("Accept-Ranges", "bytes");

    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch {
    return NextResponse.redirect(file.fileUrl, { status: 302 });
  }
}
