export function extractStoragePathFromUrl(fileUrl: string): string | null {
  const markers = [
    "/storage/v1/object/public/files/",
    "/storage/v1/object/sign/files/",
  ];

  for (const marker of markers) {
    const markerIndex = fileUrl.indexOf(marker);
    if (markerIndex === -1) continue;

    const rawPath = fileUrl.slice(markerIndex + marker.length).split("?")[0];
    return decodeURIComponent(rawPath);
  }

  return null;
}
