"use client";

import { useCallback, useMemo, useState } from "react";
import { Folder, Trash2, Undo2, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableCell } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDate, formatFileSize } from "@/lib/utils";
import type { FileItem, FolderItem } from "@/types";
import { FileIcon } from "@/components/DashboardComponents/FileIcon";
import { normalizeFileType } from "@/lib/helper";
import {
  deleteFilePermanentlyAction,
  deleteFolderPermanentlyAction,
  restoreFileAction,
  restoreFolderAction,
} from "@/app/actions/trashActions";

export type TrashClientProps = {
  files: FileItem[];
  folders: FolderItem[];
  retentionDays: number;
};

type TrashEntry =
  | { kind: "file"; item: FileItem }
  | { kind: "folder"; item: FolderItem };

function getRemainingDays(trashedDate: string | Date | null | undefined, retentionDays: number) {
  if (!trashedDate) return null;
  const trashedAt = new Date(trashedDate).getTime();
  const remainingMs = trashedAt + retentionDays * 24 * 60 * 60 * 1000 - Date.now();
  const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
  return Math.max(remainingDays, 0);
}

export default function TrashClient({
  files,
  folders,
  retentionDays,
}: TrashClientProps) {
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [confirmAction, setConfirmAction] = useState<
    | { type: "restore" | "delete"; entry: TrashEntry }
    | null
  >(null);

  const entries = useMemo<TrashEntry[]>(() => {
    return [
      ...folders.map((item) => ({ kind: "folder", item } as TrashEntry)),
      ...files.map((item) => ({ kind: "file", item } as TrashEntry)),
    ].filter((e) => !removedIds.includes(e.item.id));
  }, [files, folders, removedIds]);

  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      const aDate = a.item.trashedDate ? new Date(a.item.trashedDate).getTime() : 0;
      const bDate = b.item.trashedDate ? new Date(b.item.trashedDate).getTime() : 0;
      return bDate - aDate;
    });
  }, [entries]);

  const filteredEntries = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return sortedEntries;

    return sortedEntries.filter((entry) => {
      const name =
        entry.kind === "folder"
          ? entry.item.name
          : entry.item.fileName || entry.item.name || "";
      return name.toLowerCase().includes(term);
    });
  }, [searchTerm, sortedEntries]);

  // entries are derived from props (files/folders) and `removedIds`

  const handleRestore = useCallback(async (entry: TrashEntry) => {
    setBusyId(entry.item.id);
    const result =
      entry.kind === "file"
        ? await restoreFileAction(entry.item.id)
        : await restoreFolderAction(entry.item.id);
    setBusyId(null);

    if (!result.success) {
      toast.error(result.error || "Unable to restore");
      return;
    }
    setRemovedIds((prev) => [...prev, entry.item.id]);
    toast.success("Restored");
  }, []);

  const handleDelete = useCallback(async (entry: TrashEntry) => {
    setBusyId(entry.item.id);
    const result =
      entry.kind === "file"
        ? await deleteFilePermanentlyAction(entry.item.id)
        : await deleteFolderPermanentlyAction(entry.item.id);
    setBusyId(null);

    if (!result.success) {
      toast.error(result.error || "Unable to delete");
      return;
    }
    setRemovedIds((prev) => [...prev, entry.item.id]);
    toast.success("Deleted permanently");
  }, []);

  if (sortedEntries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-muted py-24">
        <p className="text-lg font-medium">Trash is empty</p>
        <p className="text-sm text-muted-foreground">Items you delete will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search trash"
          className="h-11 pl-9 pr-10"
        />
        {searchTerm ? (
          <button
            type="button"
            onClick={() => setSearchTerm("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {filteredEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-muted py-24">
          <p className="text-lg font-medium">No results found</p>
          <p className="text-sm text-muted-foreground">Try a different search term.</p>
        </div>
      ) : (
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <Table className="bg-white">
            <TableHeader className="bg-muted/60">
              <TableRow className="hover:bg-muted/60">
                <TableHead className="px-3 py-3 font-semibold text-foreground sm:px-4">Name</TableHead>
                <TableHead className="hidden sm:table-cell font-semibold text-foreground">Size</TableHead>
                <TableHead className="hidden md:table-cell font-semibold text-foreground">Trashed</TableHead>
                <TableHead className="hidden md:table-cell font-semibold text-foreground">Remaining</TableHead>
                <TableHead className="w-28 text-right font-semibold text-foreground pr-2 sm:pr-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEntries.map((entry) => {
                const remainingDays = getRemainingDays(entry.item.trashedDate, retentionDays);
                const isBusy = busyId === entry.item.id;
                const itemName =
                  entry.kind === "folder"
                    ? entry.item.name
                    : entry.item.fileName || entry.item.name || "Untitled file";
                return (
                  <TableRow key={entry.item.id} className="border-border/60 select-none">
                    <TableCell className="px-3 py-3 align-middle sm:px-4">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-muted/30 p-2">
                          {entry.kind === "folder" ? (
                            <Folder className="h-5 w-5 text-primary" />
                          ) : (
                            <FileIcon type={normalizeFileType(entry.item)} />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium select-none">{itemName}</p>
                          <p className="mt-1 text-xs text-muted-foreground sm:hidden">
                            {remainingDays === null
                              ? "Remaining: --"
                              : remainingDays === 0
                                ? "Expired"
                                : `${remainingDays} days left`}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">
                      {entry.kind === "folder"
                        ? "--"
                        : formatFileSize(entry.item.fileSize ?? entry.item.size ?? 0)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {entry.item.trashedDate ? formatDate(entry.item.trashedDate) : "--"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {remainingDays === null
                        ? "--"
                        : remainingDays === 0
                          ? "Expired"
                          : `${remainingDays} days`}
                    </TableCell>
                    <TableCell className="pr-2 text-right align-middle sm:pr-4">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setConfirmAction({ type: "restore", entry })}
                          disabled={isBusy}
                          className="gap-1"
                        >
                          <Undo2 className="h-4 w-4" /> <span className="md:block hidden">Restore</span>
                        </Button>
                        <Button
                          variant="delete"
                          size="sm"
                          onClick={() => setConfirmAction({ type: "delete", entry })}
                          disabled={isBusy}
                          className="gap-1"
                        >
                          <Trash2 className="h-4 w-4" /> <span className="md:block hidden">Delete</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
      )}

      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === "restore" ? "Restore item" : "Delete permanently"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === "restore"
                ? "Do you want to restore this item?"
                : confirmAction?.entry.kind === "folder"
                  ? `Are you sure you want to delete the folder "${confirmAction.entry.item.name}" permanently?`
                  : "Are you sure you want to delete this item permanently?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>
              Cancel
            </Button>
            <AlertDialogAction
              className={confirmAction?.type === "delete" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
              onClick={() => {
                if (!confirmAction) return;
                const { entry, type } = confirmAction;
                setConfirmAction(null);
                if (type === "restore") {
                  void handleRestore(entry);
                } else {
                  void handleDelete(entry);
                }
              }}
            >
              {confirmAction?.type === "restore" ? "Restore" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
