import {
  FileText,
  Image,
  Video,
  FileSpreadsheet,
  Archive,
  File,
} from "lucide-react";
import { FileCategory, FileItem } from "@/types/index";

const iconMap = {
  pdf: FileText,
  document: FileText,
  image: Image,
  video: Video,
  spreadsheet: FileSpreadsheet,
  archive: Archive,
  other: File,
};

const colorMap = {
  pdf: "text-destructive",
  document: "text-primary",
  image: "text-success",
  video: "text-warning",
  spreadsheet: "text-success",
  archive: "text-muted-foreground",
  other: "text-muted-foreground",
};

// New map to create the background box effect from the image
const bgMap = {
  pdf: "bg-destructive/10",
  document: "bg-primary/10",
  image: "bg-success/10",
  video: "bg-warning/10",
  spreadsheet: "bg-success/10",
  archive: "bg-muted/10",
  other: "bg-muted/10",
};

export function FileIcon({
  type,
  className = "h-5 w-5",
}: {
  type: FileItem["type"];
  className?: string;
}) {
  const resolvedType: FileCategory = type ?? "other";
  const Icon = iconMap[resolvedType] || File;
  const color = colorMap[resolvedType] || "";
  const bgColor = bgMap[resolvedType] || "bg-muted/10";

  return (
    <div
      className={`p-2 rounded-lg ${bgColor} flex items-center justify-center shrink-0`}
    >
      <Icon className={`${className} ${color}`} />
    </div>
  );
}
