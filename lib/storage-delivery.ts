import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { extractStoragePathFromUrl } from "@/lib/storage-path";

type StorageDeliveryOptions = {
  fileUrl: string;
  fileName?: string;
  download?: boolean;
  ttlSeconds?: number;
};

export async function redirectToStorageObject({
  fileUrl,
  fileName,
  download = false,
  ttlSeconds = 120,
}: StorageDeliveryOptions) {
  const storagePath = extractStoragePathFromUrl(fileUrl);

  const sourceUrls: string[] = [];

  if (supabaseAdmin && storagePath) {
    const { data } = await supabaseAdmin.storage.from("files").createSignedUrl(
      storagePath,
      ttlSeconds,
      download && fileName ? { download: fileName } : undefined,
    );

    if (data?.signedUrl) {
      sourceUrls.push(data.signedUrl);
    }
  }

  sourceUrls.push(fileUrl);

  for (const sourceUrl of sourceUrls) {
    const response = await fetch(sourceUrl, { cache: "no-store" });

    if (!response.ok || !response.body) {
      continue;
    }

    const headers = new Headers();
    const contentType = response.headers.get("content-type");
    if (contentType) headers.set("content-type", contentType);

    const contentLength = response.headers.get("content-length");
    if (contentLength) headers.set("content-length", contentLength);

    const contentRange = response.headers.get("content-range");
    if (contentRange) headers.set("content-range", contentRange);

    const acceptRanges = response.headers.get("accept-ranges");
    if (acceptRanges) headers.set("accept-ranges", acceptRanges);

    headers.set("cache-control", "private, no-store");
    headers.set("x-content-type-options", "nosniff");

    if (fileName) {
      const dispositionType = download ? "attachment" : "inline";
      headers.set(
        "content-disposition",
        `${dispositionType}; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      );
    }

    return new NextResponse(response.body, {
      status: response.status,
      headers,
    });
  }

  return NextResponse.json(
    { message: "Unable to deliver file" },
    { status: 502 },
  );
}