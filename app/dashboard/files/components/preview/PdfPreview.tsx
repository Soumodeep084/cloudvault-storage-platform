import { useState } from "react";

export function PdfPreview({ src, title }: { src: string; title: string }) {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <div className="relative w-full overflow-hidden rounded-lg border border-border bg-muted/10">
      <iframe
        title={title}
        src={src}
        className="h-[80vh] w-full"
        onLoad={() => setIsLoading(false)}
      />
      {isLoading && (
        <div className="absolute inset-0 flex animate-pulse items-center justify-center bg-muted/30">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted-foreground/30 border-t-primary" />
        </div>
      )}
    </div>
  );
}
