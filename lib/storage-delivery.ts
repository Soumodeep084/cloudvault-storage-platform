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

  if (supabaseAdmin && storagePath) {
    const { data } = await supabaseAdmin.storage.from("files").createSignedUrl(
      storagePath,
      ttlSeconds,
      download && fileName ? { download: fileName } : undefined,
    );

    if (data?.signedUrl) {
      return NextResponse.redirect(data.signedUrl, { status: 302 });
    }
  }

  return NextResponse.redirect(fileUrl, { status: 302 });
}