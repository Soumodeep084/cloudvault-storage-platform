"use client";

import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";

export function RestoreButton({ version }: { version: number }) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8 text-xs font-semibold border-slate-200 hover:bg-slate-50"
      onClick={() => toast.success(`Restored to version ${version}`)}
    >
      <RotateCcw className="h-3 w-3 mr-1.5 text-slate-500" />
      Restore
    </Button>
  );
}
