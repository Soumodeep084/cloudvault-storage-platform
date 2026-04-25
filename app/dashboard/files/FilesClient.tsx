"use client";

import { useState } from "react";
import { Download, Trash2, Share2, MoreHorizontal, AlertTriangle } from "lucide-react";
import { formatFileSize, formatDate } from "@/lib/utils";
import { FileIcon } from "@/components/DashboardComponents/FileIcon"; // Ensure this exists
import { ShareModal } from "@/components/DashboardComponents/ShareModal";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FileCategory, FileItem } from "@/types";
import { createShareLink, deleteFileAction } from "@/app/actions/fileActions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

function generateDeleteCode(length = 8) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < length; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function normalizeFileType(file: FileItem): FileCategory {
  const rawType = (file.type || file.fileType || "").toLowerCase();
  const fileName = (file.name || file.fileName || "").toLowerCase();

  if (rawType.includes("pdf") || fileName.endsWith(".pdf")) return "pdf";
  if (rawType.includes("image") || /(png|jpg|jpeg|gif|webp|svg)$/i.test(fileName)) return "image";
  if (rawType.includes("video") || /(mp4|mov|mkv|avi|webm)$/i.test(fileName)) return "video";
  if (rawType.includes("sheet") || rawType.includes("excel") || /(xls|xlsx|csv)$/i.test(fileName)) return "spreadsheet";
  if (rawType.includes("archive") || /(zip|rar|7z|tar|gz)$/i.test(fileName)) return "archive";
  if (rawType.includes("doc") || /(doc|docx|txt|md)$/i.test(fileName)) return "document";
  return "other";
}

function getDisplayName(file: FileItem) {
  return file.name || file.fileName || "Untitled file";
}

function getDisplaySize(file: FileItem) {
  return file.size ?? file.fileSize ?? 0;
}

function getDisplayDate(file: FileItem) {
  return file.modifiedAt || file.updatedAt || file.uploadedAt || file.createdAt || new Date();
}

function isShared(file: FileItem) {
  return Boolean(file.shared ?? file.shareLink);
}

export default function FilesClient({ initialFiles }: { initialFiles: FileItem[] }) {
  const [files, setFiles] = useState(initialFiles);
  const [shareFile, setShareFile] = useState<FileItem | null>(null);
  const [deleteFile, setDeleteFile] = useState<FileItem | null>(null);
  const [deleteStep, setDeleteStep] = useState<"confirm" | "verify">("confirm");
  const [deleteCode, setDeleteCode] = useState("");
  const [deleteInput, setDeleteInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDownload = (file: FileItem) => {
    if (!file.id) {
      toast.error("File id not found");
      return;
    }

    const anchor = document.createElement("a");
    anchor.href = `/api/files/${file.id}/download`;
    anchor.rel = "noopener noreferrer";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    toast.success("Download started");
  };

  const resetDeleteDialog = () => {
    if (isDeleting) return;
    setDeleteFile(null);
    setDeleteStep("confirm");
    setDeleteCode("");
    setDeleteInput("");
  };

  const openDeleteDialog = (file: FileItem) => {
    setDeleteFile(file);
    setDeleteStep("confirm");
    setDeleteCode("");
    setDeleteInput("");
  };

  const startDeleteVerification = () => {
    setDeleteStep("verify");
    setDeleteCode(generateDeleteCode());
    setDeleteInput("");
  };

  const handleDelete = async () => {
    if (!deleteFile?.id) {
      toast.error("File id not found");
      return;
    }

    if (deleteInput.trim().toUpperCase() !== deleteCode) {
      toast.error("Confirmation code does not match");
      return;
    }

    setIsDeleting(true);
    const result = await deleteFileAction(deleteFile.id);
    setIsDeleting(false);

    if (!result.success) {
      toast.error(result.error || "Failed to delete file");
      return;
    }

    setFiles((prev) => prev.filter((f) => f.id !== deleteFile.id));
    resetDeleteDialog();
    toast.success("File deleted");
  };

  const handleShare = async (file: FileItem) => {
    if (file.shareLink) {
      setShareFile(file);
      return;
    }

    const result = await createShareLink(file.id);
    if (!result.success) {
      toast.error(result.error || "Failed to create share link");
      return;
    }

    const updatedFile = { ...file, shareLink: result.shareLink, shared: true };
    setFiles((prev) => prev.map((f) => (f.id === file.id ? updatedFile : f)));
    setShareFile(updatedFile);
    toast.success("Share link created");
  };

  const totalSize = files.reduce((a, f) => a + getDisplaySize(f), 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Files</h1>
          <p className="text-sm text-muted-foreground">
            {files.length} files • {formatFileSize(totalSize)} total
          </p>
        </div>
      </div>

      {files.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 border-2 border-dashed rounded-xl border-muted">
          <p className="text-lg font-medium">No files found</p>
          <p className="text-sm text-muted-foreground">
            Your uploaded files will appear here.
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <Table className="bg-white">
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="font-semibold text-foreground px-2">
                  Name
                </TableHead>
                <TableHead className="hidden sm:table-cell font-semibold text-foreground">
                  Size
                </TableHead>
                <TableHead className="hidden md:table-cell font-semibold text-foreground">
                  Modified
                </TableHead>
                <TableHead className="hidden md:table-cell font-semibold text-foreground">
                  Status
                </TableHead>
                <TableHead className="hidden md:table-cell font-semibold text-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.map((file) => (
                
                <TableRow
                  key={file.id}
                  className="group hover:bg-muted/30 transition-colors "
                >
                  <TableCell>
                    <div className="flex items-center gap-3 px-2">
                      <FileIcon type={normalizeFileType(file)} />
                      <span className="font-medium truncate max-w-50">
                        {getDisplayName(file)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">
                    {formatFileSize(getDisplaySize(file))}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {formatDate(getDisplayDate(file))}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {isShared(file) ? (
                      <Badge variant="secondary">Shared</Badge>
                    ) : (
                      <Badge variant="outline">Private</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="subtle" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem
                          onClick={() => handleDownload(file)}
                        >
                          <Download className="mr-2 h-4 w-4"/> Download
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleShare(file)}>
                          <Share2 className="mr-2 h-4 w-4" />
                          {file.shareLink ? "Share" : "Create share link"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => openDeleteDialog(file)}
                          className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ShareModal
        open={!!shareFile}
        onOpenChange={() => setShareFile(null)}
        fileName={shareFile ? getDisplayName(shareFile) : ""}
        shareLink={shareFile?.shareLink}
      />

      <Dialog open={!!deleteFile} onOpenChange={(open) => (!open ? resetDeleteDialog() : undefined)}>
        <DialogContent className="sm:max-w-lg p-0 overflow-hidden" showCloseButton={!isDeleting}>
          <div className="border-b bg-linear-to-b from-rose-50 to-white px-6 py-5">
            <DialogHeader className="gap-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-full bg-rose-100 p-2 text-rose-700">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <DialogTitle className="text-base font-semibold text-slate-900">
                    Delete file permanently?
                  </DialogTitle>
                  <DialogDescription className="text-sm leading-relaxed text-slate-600">
                    {deleteStep === "confirm"
                      ? "This action is permanent and cannot be undone."
                      : "Confirm by typing the generated security code."}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="px-6 py-5 space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5">
              <p className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">Selected file</p>
              <p className="mt-1 text-sm font-medium text-slate-900 break-all">
                {deleteFile ? getDisplayName(deleteFile) : ""}
              </p>
            </div>

            {deleteStep === "verify" && (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">
                  Enter <span className="font-semibold text-rose-600">&quot;{deleteCode}&quot;</span> to permanently delete this file.
                </p>

                <Input
                  value={deleteInput}
                  onChange={(e) => setDeleteInput(e.target.value.toUpperCase())}
                  placeholder="Type the confirmation code"
                  autoComplete="off"
                  disabled={isDeleting}
                  className="h-10"
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t bg-slate-50 px-6 py-4">
            <Button variant="outline" onClick={resetDeleteDialog} disabled={isDeleting} className="h-9">
              Cancel
            </Button>

            {deleteStep === "confirm" ? (
              <Button
                onClick={startDeleteVerification}
                className="h-9 bg-slate-900 text-white hover:bg-slate-800"
              >
                Yes, continue
              </Button>
            ) : (
              <Button
                onClick={handleDelete}
                disabled={isDeleting || deleteInput.trim().toUpperCase() !== deleteCode}
                className="h-9 bg-rose-600 text-white hover:bg-rose-700 disabled:bg-rose-300"
              >
                {isDeleting ? "Deleting..." : "Permanently delete"}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
