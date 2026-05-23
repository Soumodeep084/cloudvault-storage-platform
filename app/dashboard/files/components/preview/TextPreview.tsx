import { useEffect, useMemo, useState } from "react";

export function TextPreview({
  src,
  extension,
}: {
  src: string;
  extension: string;
}) {
  const [content, setContent] = useState<string>("");
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  const isJson = useMemo(() => extension === "json", [extension]);

  useEffect(() => {
    let active = true;

    async function loadText() {
      try {
        setStatus("loading");
        const response = await fetch(src, { cache: "no-store" });
        if (!response.ok) throw new Error("Failed to load file");
        const text = await response.text();

        if (!active) return;

        if (isJson) {
          try {
            const parsed = JSON.parse(text);
            setContent(JSON.stringify(parsed, null, 2));
          } catch {
            setContent(text);
          }
        } else {
          setContent(text);
        }

        setStatus("ready");
      } catch {
        if (!active) return;
        setStatus("error");
      }
    }

    loadText();

    return () => {
      active = false;
    };
  }, [src, isJson]);

  if (status === "error") {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/10 p-6 text-sm text-muted-foreground">
        Unable to load text preview. Try downloading the file instead.
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="h-[70vh] w-full animate-pulse flex items-center justify-center rounded-lg bg-muted/30">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted-foreground/30 border-t-primary" />
      </div>
    );
  }

  return (
    <div className="max-h-[70vh]  overflow-auto rounded-lg border border-border bg-muted/5 p-4 text-sm">
      <pre className="whitespace-pre-wrap wrap-break-word text-foreground">
        {content}
      </pre>
    </div>
  );
}
