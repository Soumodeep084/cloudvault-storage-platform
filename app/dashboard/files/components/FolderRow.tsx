import { Folder, MoreHorizontal, Pencil, Trash2, ArrowRightLeft } from "lucide-react";
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
import type { FolderItem } from "@/types";

export type FolderRowProps = {
  folder: FolderItem;
  sizeBytes: number;
  isDragOver: boolean;
  onOpen: (folderId: string) => void;
  onCreateInside: (folderId: string) => void;
  onRename: (folder: FolderItem) => void;
  onMove: (folder: FolderItem) => void;
  onDelete: (folder: FolderItem) => void;
  onDragStart: (event: React.DragEvent<HTMLTableRowElement>, folder: FolderItem) => void;
  onDragOver: (event: React.DragEvent<HTMLTableRowElement>) => void;
  onDragLeave: () => void;
  onDrop: (event: React.DragEvent<HTMLTableRowElement>) => void;
  status: "private" | "shared" | "expired";
};

export function FolderRow({
  folder,
  sizeBytes,
  isDragOver,
  onOpen,
  onCreateInside,
  onRename,
  onMove,
  onDelete,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  status,
}: FolderRowProps) {
  return (
    <TableRow
      className={`group border-border/60 hover:bg-muted/30 transition-colors ${
        isDragOver ? "bg-muted/40" : ""
      }`}
      draggable
      onDragStart={(event) => onDragStart(event, folder)}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <TableCell className="px-3 py-3 align-middle sm:px-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted/20 flex items-center justify-center shrink-0">
            <Folder className="h-5 w-5 text-primary" />
          </div>
          <button
            type="button"
            onClick={() => onOpen(folder.id)}
            className="min-w-0 text-left cursor-pointer"
          >
            <p className="font-medium truncate max-w-40 sm:max-w-56 md:max-w-80 hover:underline">
              {folder.name}
            </p>
          </button>
        </div>
      </TableCell>
      <TableCell className="hidden sm:table-cell text-muted-foreground">
        {formatFileSize(sizeBytes)}
      </TableCell>
      <TableCell className="hidden md:table-cell text-muted-foreground">
        {folder.updatedAt || folder.createdAt
          ? formatDate(folder.updatedAt ?? folder.createdAt ?? "")
          : "--"}
      </TableCell>
      <TableCell className="hidden md:table-cell">
        {status === "expired" ? (
          <Badge
            className="border-rose-200 bg-rose-50 text-rose-700"
            variant="outline"
          >
            Expired
          </Badge>
        ) : status === "shared" ? (
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
            <DropdownMenuItem onClick={() => onCreateInside(folder.id)}>
              <Folder className="mr-2 h-4 w-4" /> New Folder
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onOpen(folder.id)}>
              <Folder className="mr-2 h-4 w-4" /> Open Folder
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onRename(folder)}>
              <Pencil className="mr-2 h-4 w-4" /> Rename Folder
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onMove(folder)}>
              <ArrowRightLeft className="mr-2 h-4 w-4" /> Move
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(folder)}
              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4 focus:bg-destructive/10 focus:text-destructive" /> Move to Trash
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
