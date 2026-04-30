import { getSessionUser } from "@/lib/auth-help";
import { db } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase";
import { extractStoragePathFromUrl } from "@/lib/storage-path";
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

  const storagePath = extractStoragePathFromUrl(file.fileUrl);
  if (supabaseAdmin && storagePath) {
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
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
          "Cache-Control": "private, no-store",
        },
      });
    }
  }

  try {
    const upstream = await fetch(file.fileUrl, { cache: "no-store" });
    if (!upstream.ok || !upstream.body) {
      // Fallback: URL is validated by ownership check above; let browser fetch directly.
      return NextResponse.redirect(file.fileUrl, { status: 302 });
    }

    const contentType =
      upstream.headers.get("content-type") || file.fileType || "application/octet-stream";
    const contentLength = upstream.headers.get("content-length");

    const headers = new Headers({
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      "Cache-Control": "private, no-store",
    });

    if (contentLength) {
      headers.set("Content-Length", contentLength);
    }

    return new Response(upstream.body, {
      status: 200,
      headers,
    });
  } catch {
    // Network/runtime fetch issues on server should not block download for valid owners.
    return NextResponse.redirect(file.fileUrl, { status: 302 });
  }
}
