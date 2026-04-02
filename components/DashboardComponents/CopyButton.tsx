"use client";

import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { toast } from "sonner";

export function CopyButton({ shareLink }: { shareLink?: string }) {
  const handleCopy = () => {
    if (!shareLink) {
      toast.error("No share link available");
      return;
    }
    navigator.clipboard.writeText(shareLink);
    toast.success("Link copied to clipboard!");
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="text-slate-400 hover:text-primary transition-colors"
      onClick={handleCopy}
    >
      <Copy className="h-4 w-4" />
    </Button>
  );
}
