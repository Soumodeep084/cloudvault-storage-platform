import { Download, MoreHorizontal, Pencil, Share2, Trash2, Link2Off, ArrowRightLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TableCell, TableRow } from "@/components/ui/table";
import { formatDate, formatFileSize } from "@/lib/utils";
import { FileIcon } from "@/components/DashboardComponents/FileIcon";
import { normalizeFileType } from "@/lib/helper";
import type { FileItem } from "@/types";

export type FileRowProps = {
  file: FileItem;
  isRevokingShareId: string | null;
  onDownload: (file: FileItem) => void;
  onRename: (file: FileItem) => void;
  onMove: (file: FileItem) => void;
  onShare: (file: FileItem) => void;
  onStopSharing: (file: FileItem) => void;
  onDelete: (file: FileItem) => void;
  onPreview: (file: FileItem) => void;
  onDragStart: (event: React.DragEvent<HTMLTableRowElement>, file: FileItem) => void;
};

function getDisplayName(file: FileItem) {
  return file.name || file.fileName || "Untitled file";
}

function getDisplaySize(file: FileItem) {
  return file.size ?? file.fileSize ?? 0;
}

function getDisplayDate(file: FileItem) {
  return (
    file.modifiedAt ||
    file.updatedAt ||
    file.uploadedAt ||
    file.createdAt ||
    new Date()
  );
}

function isShared(file: FileItem) {
  return Boolean(file.shared ?? file.shareLink);
}

function isShareExpired(file: FileItem) {
  if (!file.shareLink || !file.shareExpiresAt) return false;
  return new Date(file.shareExpiresAt).getTime() < Date.now();
}

export function FileRow({
  file,
  isRevokingShareId,
  onDownload,
  onRename,
  onMove,
  onShare,
  onStopSharing,
  onDelete,
  onPreview,
  onDragStart,
}: FileRowProps) {
  const expired = isShareExpired(file);
  const shared = isShared(file);

  return (
    <TableRow
      className="group border-border/60 hover:bg-muted/30 transition-colors"
      draggable
      onDragStart={(event) => onDragStart(event, file)}
    >
      <TableCell className="px-3 py-3 align-middle sm:px-4">
        <div className="flex items-center gap-3">
          <div>
            <FileIcon type={normalizeFileType(file)} />
          </div>
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => onPreview(file)}
              className="max-w-40 sm:max-w-56 md:max-w-80 text-left font-medium truncate hover:underline"
            >
              {getDisplayName(file)}
            </button>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground sm:hidden">
              <span>{formatFileSize(getDisplaySize(file))}</span>
              <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
              <span>{formatDate(getDisplayDate(file))}</span>
              {expired ? (
                <Badge
                  className="h-5 px-2 border-rose-200 bg-rose-50 text-rose-700"
                  variant="outline"
                >
                  Expired
                </Badge>
              ) : (
                <Badge
                  variant={shared ? "secondary" : "outline"}
                  className="h-5 px-2"
                >
                  {shared ? "Shared" : "Private"}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell className="hidden sm:table-cell text-muted-foreground">
        {formatFileSize(getDisplaySize(file))}
      </TableCell>
      <TableCell className="hidden md:table-cell text-muted-foreground">
        {formatDate(getDisplayDate(file))}
      </TableCell>
      <TableCell className="hidden md:table-cell">
        {expired ? (
          <Badge className="border-rose-200 bg-rose-50 text-rose-700" variant="outline">
            Expired
          </Badge>
        ) : shared ? (
          <Badge variant="secondary">Shared</Badge>
        ) : (
          <Badge variant="outline">Private</Badge>
        )}
      </TableCell>
      <TableCell className="w-12 pr-2 text-right align-middle sm:pr-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="subtle" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => onDownload(file)}>
              <Download className="mr-2 h-4 w-4" /> Download
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onRename(file)}>
              <Pencil className="mr-2 h-4 w-4" /> Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onMove(file)}>
              <ArrowRightLeft className="mr-2 h-4 w-4" /> Move
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onShare(file)}>
              <Share2 className="mr-2 h-4 w-4" />
              {expired ? "Renew Share Link" : file.shareLink ? "Share" : "Create Share Link"}
            </DropdownMenuItem>
            {file.shareLink && !expired && (
              <DropdownMenuItem
                onClick={() => onStopSharing(file)}
                disabled={isRevokingShareId === file.id}
                className="text-amber-700 focus:bg-amber-50 focus:text-amber-700"
              >
                <Link2Off className="mr-2 h-4 w-4" />
                {isRevokingShareId === file.id ? "Stopping..." : "Stop sharing"}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() => onDelete(file)}
              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Move to Trash
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
