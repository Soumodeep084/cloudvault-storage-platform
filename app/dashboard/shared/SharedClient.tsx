"use client";

import { useMemo, useState } from "react";
import {
  Search,
  ShieldCheck,
  ShieldOff,
  Clock3,
  Link2Off,
} from "lucide-react";
import { toast } from "sonner";
import { FileIcon } from "@/components/DashboardComponents/FileIcon";
import { ShareButton } from "@/components/DashboardComponents/ShareButton";
import { CopyButton } from "@/components/DashboardComponents/CopyButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate, formatDateTime, formatFileSize } from "@/lib/utils";
import { revokeShareLink } from "@/app/actions/fileActions";
import type { FileCategory } from "@/types";

const EMPTY_QUERY = "";

type SharedFileItem = {
  id: string;
  fileId: string;
  fileName: string;
  fileSize: number | null;
  fileType: string | null;
  updatedAt: string | Date;
  shareLink: string;
  expiresAt: string | Date | null;
  sharedAt: string | Date;
};

function toFileCategory(fileType: string | null, fileName: string): FileCategory {
  const rawType = (fileType || "").toLowerCase();
  const lowerName = fileName.toLowerCase();

  if (rawType.includes("pdf") || lowerName.endsWith(".pdf")) return "pdf";
  if (rawType.includes("image") || /(png|jpg|jpeg|gif|webp|svg)$/i.test(lowerName)) return "image";
  if (rawType.includes("video") || /(mp4|mov|mkv|avi|webm)$/i.test(lowerName)) return "video";
  if (rawType.includes("sheet") || rawType.includes("excel") || /(xls|xlsx|csv|tsv)$/i.test(lowerName)) return "spreadsheet";
  if (/(ppt|pptx|key|odp)$/i.test(lowerName)) return "presentation";
  if (rawType.includes("archive") || /(zip|rar|7z|tar|gz)$/i.test(lowerName)) return "archive";
  if (/(py|js|ts|tsx|jsx|java|c|h|cpp|cc|cs|go|rb|php|rs|swift|kt|scala|sh|sql|yml|yaml|json|xml|toml)$/i.test(lowerName)) return "code";
  if (/(txt|md|log|rtf)$/i.test(lowerName)) return "text";
  if (rawType.includes("doc") || /(doc|docx)$/i.test(lowerName)) return "document";
  return "other";
}

function isExpired(expiresAt: string | Date | null) {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
}

export default function SharedClient({ initialShares }: { initialShares: SharedFileItem[] }) {
  const [shares, setShares] = useState(initialShares);
  const [query, setQuery] = useState(EMPTY_QUERY);
  const [isRevokingId, setIsRevokingId] = useState<string | null>(null);

  const filteredShares = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return shares;

    return shares.filter((share) =>
      [share.fileName, share.shareLink].some((value) =>
        value.toLowerCase().includes(normalizedQuery)
      )
    );
  }, [shares, query]);

  const activeCount = shares.filter((share) => !isExpired(share.expiresAt)).length;
  const expiredCount = shares.length - activeCount;

  const handleRevoke = async (fileId: string) => {
    if (isRevokingId) return;

    const confirmed = window.confirm("Stop sharing this file? This will disable the current link.");
    if (!confirmed) return;

    setIsRevokingId(fileId);
    const result = await revokeShareLink(fileId);
    setIsRevokingId(null);

    if (!result.success) {
      toast.error(result.error || "Unable to stop sharing");
      return;
    }

    setShares((prev) => prev.filter((share) => share.fileId !== fileId));
    toast.success("Share link stopped");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="px-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Shared Files</h1>
          <p className="text-sm text-slate-500 mt-1">
            {shares.length} links • {activeCount} active • {expiredCount} expired
          </p>
        </div>

        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search shared files"
            className="h-10 pl-9"
          />
        </div>
      </div>

      {filteredShares.length === 0 ? (
        <div className="text-center py-20 bg-slate-50/60 rounded-2xl border border-dashed border-slate-200">
          <p className="text-slate-900 font-semibold">No shared files</p>
          <p className="text-sm text-slate-500">
            {shares.length === 0
              ? "Create a share link to make files available here."
              : "Try a different search term."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredShares.map((share) => {
            const expired = isExpired(share.expiresAt);
            return (
              <div
                key={share.id}
                className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 md:flex-row md:items-center"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <FileIcon type={toFileCategory(share.fileType, share.fileName)} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {share.fileName}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span>{formatFileSize(share.fileSize ?? 0)}</span>
                      <span className="h-1 w-1 rounded-full bg-slate-300" />
                      <span>Shared {formatDate(share.sharedAt)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 md:ml-auto">
                  <Badge
                    variant={expired ? "outline" : "secondary"}
                    className={
                      expired
                        ? "inline-flex items-center gap-1 px-2 py-1 border-rose-200 bg-rose-50 text-rose-700"
                        : "inline-flex items-center gap-1 px-2 py-1"
                    }
                  >
                    {expired ? <ShieldOff className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
                    {expired ? "Expired" : "Active"}
                  </Badge>

                  <Badge variant="outline" className="inline-flex items-center gap-1 px-2 py-1 text-slate-500">
                    <Clock3 className="h-3 w-3" />
                    {share.expiresAt ? `Expires ${formatDateTime(share.expiresAt)}` : "No expiry"}
                  </Badge>

                  <div className="flex items-center gap-1">
                    {!expired && (
                      <>
                        <ShareButton fileName={share.fileName} shareLink={share.shareLink} />
                        <CopyButton shareLink={share.shareLink} />
                      </>
                    )}

                    {!expired && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-slate-400 hover:text-rose-600"
                        onClick={() => handleRevoke(share.fileId)}
                        disabled={isRevokingId === share.fileId}
                        aria-label="Stop sharing"
                      >
                        <Link2Off className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
