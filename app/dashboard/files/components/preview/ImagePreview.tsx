import { useState } from "react";
import Image from "next/image";

export function ImagePreview({ src, alt }: { src: string; alt: string }) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const useUnoptimized = src.startsWith("/api/");

  return (
    <div className="relative w-full overflow-hidden rounded-lg border border-border bg-muted/10">
      <div className="relative h-[70vh] w-full">
        {!hasError ? (
          <Image
            src={src}
            alt={alt}
            fill
            sizes="(max-width: 768px) 100vw, 900px"
            className="object-contain"
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              setHasError(true);
            }}
            unoptimized={useUnoptimized}
            priority
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Image preview unavailable.
          </div>
        )}
        {isLoading && !hasError && (
          <div className="absolute inset-0 flex animate-pulse items-center justify-center bg-muted/30">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted-foreground/30 border-t-primary" />
          </div>
        )}
      </div>
    </div>
  );
}
