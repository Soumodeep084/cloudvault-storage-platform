"use client";

import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FileItem } from "@/types";
import { FilePreviewMeta } from "./FilePreviewMeta";
import { ImagePreview } from "./ImagePreview";
import { PdfPreview } from "./PdfPreview";
import { TextPreview } from "./TextPreview";
import { UnsupportedPreview } from "./UnsupportedPreview";
import { VideoPreview } from "./VideoPreview";
import {
  getDisplayName,
  getFileExtension,
  getFileMime,
  getPreviewType,
  getPreviewUrl,
} from "./filePreviewUtils";

export type FilePreviewDialogProps = {
  file: FileItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDownload: (file: FileItem) => void;
};

export function FilePreviewDialog({
  file,
  open,
  onOpenChange,
  onDownload,
}: FilePreviewDialogProps) {
  const previewType = useMemo(
    () => (file ? getPreviewType(file) : "unsupported"),
    [file],
  );
  const previewUrl = useMemo(() => (file ? getPreviewUrl(file) : ""), [file]);
  const extension = useMemo(() => (file ? getFileExtension(file) : ""), [file]);
  const mimeType = useMemo(() => (file ? getFileMime(file) : ""), [file]);
  const title = file ? getDisplayName(file) : "File preview";

  if (!file) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[95vw]! max-w-400! h-[96vh] p-0 overflow-hidden"
        onInteractOutside={(event) => event.preventDefault()}
        aria-describedby="file-preview-description"
      >
        <div className="flex h-full flex-col">
          <DialogHeader className="px-6 pt-5">
            <DialogTitle className="truncate">{title}</DialogTitle>
{/* 
            <DialogDescription className="text-sm text-muted-foreground">
              File preview
            </DialogDescription> */}
          </DialogHeader>

          <div className="flex-1 px-6 py-4 min-h-0 overflow-hidden">
            {previewUrl ? (
              <>
                {previewType === "image" && (
                  <ImagePreview src={previewUrl} alt={title} />
                )}

                {previewType === "pdf" && (
                  <PdfPreview src={previewUrl} title={title} />
                )}

                {previewType === "video" && (
                  <VideoPreview
                    src={previewUrl}
                    mimeType={mimeType || undefined}
                  />
                )}

                {previewType === "text" && (
                  <TextPreview src={previewUrl} extension={extension} />
                )}

                {previewType === "unsupported" && (
                  <UnsupportedPreview file={file} onOpenChange={onOpenChange} onDownload={onDownload} />
                )}
              </>
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-muted/10 p-6 text-sm text-muted-foreground">
                Preview unavailable. File URL missing.
              </div>
            )}

            {previewType !== "unsupported" && (
              <div className="mt-2 mb-0">
                <FilePreviewMeta file={file} />
              </div>
            )}
          </div>

          {/* <div className="border-t py-2 px-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>

            <Button onClick={() => onDownload(file)}>Download</Button>
          </div> */}
        </div>
      </DialogContent>
    </Dialog>
  );
}
