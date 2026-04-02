"use client";

import { useState } from "react";
import { Copy, Check, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  shareLink?: string;
}

export function ShareModal({
  open,
  onOpenChange,
  fileName,
  shareLink,
}: ShareModalProps) {
  const [copied, setCopied] = useState(false);

  // Use the actual share link if available, otherwise a placeholder
  const link =
    shareLink ||
    `https://cloudvault.io/s/${Math.random().toString(36).slice(2, 8)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy!", err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" /> Share File
          </DialogTitle>
          <DialogDescription className="pt-2">
            Anyone with the link can view{" "}
            <span className="font-semibold text-foreground">"{fileName}"</span>
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center space-x-2 mt-4">
          <div className="grid flex-1 gap-2">
            <Input
              value={link}
              readOnly
              className="font-mono text-xs bg-muted/50 border-0 h-9"
            />
          </div>
          <Button onClick={handleCopy} size="sm" className="px-3" >
            <span className="sr-only">Copy</span>
            {copied ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
        <div className="mt-4 p-3 bg-primary/5 rounded-lg border border-primary/10">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            <strong>Pro Tip:</strong> Link sharing is public. Make sure you
            trust the people you share with.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
