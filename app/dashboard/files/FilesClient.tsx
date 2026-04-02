"use client";

import { useState } from "react";
import { Download, Trash2, Share2, MoreHorizontal } from "lucide-react";
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
import { FileItem } from "@/types";

export default function FilesClient({ initialFiles }: { initialFiles: FileItem[] }) {
  const [files, setFiles] = useState(initialFiles);
  const [shareFile, setShareFile] = useState<FileItem | null>(null);

  const handleDelete = async (id: string) => {
    // In industry level, you'd call a Server Action here: await deleteFileAction(id)
    setFiles((prev) => prev.filter((f) => f.id !== id));
    toast.success("File deleted");
  };

  const totalSize = files.reduce((a, f) => a + (f.size || 0), 0);

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
                      <FileIcon type={file.type} />
                      <span className="font-medium truncate max-w-50">
                        {file.name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">
                    {formatFileSize(file.size)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {formatDate(file.uploadedAt)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {file.shared ? (
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
                          onClick={() => toast.success("Download started")}
                        >
                          <Download className="mr-2 h-4 w-4"/> Download
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setShareFile(file)}>
                          <Share2 className="mr-2 h-4 w-4" /> Share
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(file.id)}
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
        fileName={shareFile?.name || ""}
        shareLink={shareFile?.shareLink}
      />
    </div>
  );
}
