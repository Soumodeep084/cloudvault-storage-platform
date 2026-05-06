import {
  FileText,
  FileCode,
  Image,
  Video,
  FileSpreadsheet,
  Archive,
  File,
  FileAudio,
} from "lucide-react";
import { FileCategory, FileItem } from "@/types/index";

const iconMap = {
  pdf: FileText,
  document: FileText,
  presentation: FileText,
  image: Image,
  video: Video,
  audio: FileAudio, // NEW
  spreadsheet: FileSpreadsheet,
  archive: Archive,
  code: FileCode,
  text: FileText,
  other: File,
};

const colorMap = {
  pdf: "text-destructive",
  document: "text-primary",
  presentation: "text-warning",
  image: "text-success",
  video: "text-warning",
  audio: "text-purple-600", // NEW
  spreadsheet: "text-success",
  archive: "text-muted-foreground",
  code: "text-sky-600",
  text: "text-slate-700",
  other: "text-muted-foreground",
};

const bgMap = {
  pdf: "bg-destructive/10",
  document: "bg-primary/10",
  presentation: "bg-warning/10",
  image: "bg-success/10",
  video: "bg-warning/10",
  audio: "bg-purple-100", // NEW
  spreadsheet: "bg-success/10",
  archive: "bg-muted/10",
  code: "bg-sky-50",
  text: "bg-slate-100",
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
