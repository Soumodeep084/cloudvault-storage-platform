"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AdminRefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => startTransition(() => router.refresh())}
      disabled={isPending}
      className="h-11 gap-2 rounded-xl border-border/70 bg-background/80 px-4 shadow-sm backdrop-blur transition-colors hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
    >
      <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
      {isPending ? "Refreshing..." : "Refresh"}
    </Button>
  );
}

