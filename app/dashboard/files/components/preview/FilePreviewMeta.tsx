import { formatDate, formatFileSize } from "@/lib/utils";
import type { FileItem } from "@/types";
import { getDisplayDate, getDisplayName, getDisplaySize, getFileExtension, getFileMime } from "./filePreviewUtils";

export function FilePreviewMeta({ file }: { file: FileItem }) {
  const displayName = getDisplayName(file);
  const displaySize = getDisplaySize(file);
  const displayDate = getDisplayDate(file);
  const extension = getFileExtension(file);
  const mime = getFileMime(file);

  return (
    <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
      <div className="flex items-center gap-2">
        <span className="font-semibold uppercase tracking-wide text-[0.65rem]">Name : </span>
        <span className="truncate text-foreground">{displayName}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-semibold uppercase tracking-wide text-[0.65rem]">Size : </span>
        <span className="text-foreground">{formatFileSize(displaySize)}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-semibold uppercase tracking-wide text-[0.65rem]">Type : </span>
        <span className="text-foreground">
          {mime || (extension ? `.${extension}` : "Unknown")}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-semibold uppercase tracking-wide text-[0.65rem]">Modified : </span>
        <span className="text-foreground">
          {displayDate ? formatDate(displayDate) : "--"}
        </span>
      </div>
    </div>
  );
}
