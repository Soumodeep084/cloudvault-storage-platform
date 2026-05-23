import { FileIcon } from "@/components/DashboardComponents/FileIcon";
import { normalizeFileType } from "@/lib/helper";
import type { FileItem } from "@/types";
import { FilePreviewMeta } from "./FilePreviewMeta";
import { Button } from "@/components/ui/button";

export function UnsupportedPreview({
  file,
  onOpenChange,
  onDownload,
}: {
  file: FileItem;
  onOpenChange: (open: boolean) => void;
  onDownload: (file: FileItem) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 rounded-lg border border-dashed border-border bg-muted/10 p-4">
        <div className="rounded-lg bg-muted/30 p-3">
          <FileIcon type={normalizeFileType(file)} />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">
            Preview unavailable
          </p>
          <p className="text-xs text-muted-foreground">
            This file type cannot be previewed yet. Download to view it.
          </p>
        </div>
      </div>
      <FilePreviewMeta file={file} />

      <div className="border-t py-2 px-4 flex justify-end gap-2">
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Close
        </Button>

        <Button onClick={() => onDownload(file)}>Download</Button>
      </div>
    </div>
  );
}
