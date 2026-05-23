import { useState } from "react";

export function VideoPreview({ src, mimeType }: { src: string; mimeType?: string }) {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <div className="relative w-full overflow-hidden rounded-lg border border-border bg-muted/10">
      <video
        className="h-[80vh] w-full bg-black"
        controls
        preload="metadata"
        onLoadedData={() => setIsLoading(false)}
      >
        <source src={src} type={mimeType || undefined} />
        Your browser does not support the video tag.
      </video>
      {isLoading && <div className="absolute inset-0 animate-pulse bg-muted/30" />}
    </div>
  );
}
