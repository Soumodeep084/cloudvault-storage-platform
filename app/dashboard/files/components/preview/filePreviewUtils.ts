import type { FileItem } from "@/types";

export type FilePreviewType = "image" | "pdf" | "video" | "text" | "unsupported";

const imageExtensions = new Set(["png", "jpg", "jpeg", "webp", "gif"]);
const videoExtensions = new Set(["mp4", "webm"]);
const textExtensions = new Set(["txt", "json", "md"]);

const textMimeTypes = new Set([
  "application/json",
  "application/ld+json",
  "application/markdown",
  "text/plain",
  "text/markdown",
]);

export function getFileExtension(file: FileItem): string {
  const rawName = file.name || file.fileName || "";
  const parts = rawName.split(".");
  if (parts.length < 2) return "";
  return (parts[parts.length - 1] || "").toLowerCase();
}

export function getFileMime(file: FileItem): string {
  return (file.fileType || "").toLowerCase();
}

export function getPreviewType(file: FileItem): FilePreviewType {
  const extension = getFileExtension(file);
  const mime = getFileMime(file);

  if (mime.startsWith("image/") || imageExtensions.has(extension)) return "image";
  if (mime === "application/pdf" || extension === "pdf") return "pdf";
  if (mime.startsWith("video/") || videoExtensions.has(extension)) return "video";
  if (mime.startsWith("text/") || textMimeTypes.has(mime) || textExtensions.has(extension)) {
    return "text";
  }

  return "unsupported";
}

export function getPreviewUrl(file: FileItem): string {
  if (file.id) return `/api/files/${file.id}/preview`;
  return file.fileUrl || "";
}

export function getDisplayName(file: FileItem): string {
  return file.name || file.fileName || "Untitled file";
}

export function getDisplaySize(file: FileItem): number {
  return file.size ?? file.fileSize ?? 0;
}

export function getDisplayDate(file: FileItem): string | Date | null {
  return (
    file.modifiedAt ||
    file.updatedAt ||
    file.uploadedAt ||
    file.createdAt ||
    null
  );
}
