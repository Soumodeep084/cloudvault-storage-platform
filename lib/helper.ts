
import { FileCategory, FileItem } from "@/types";

export function normalizeFileType(file: FileItem): FileCategory {
    const rawType = (file.type || file.fileType || "").toLowerCase();
    const fileName = (file.name || file.fileName || "").toLowerCase();

    const ext = fileName.includes(".") ? fileName.split(".").pop()! : "";

    // PDF
    if (ext === "pdf" || rawType.includes("pdf")) return "pdf";

    // Images
    if (
        ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext) ||
        rawType.startsWith("image/")
    )
        return "image";

    // Videos
    if (
        ["mp4", "mov", "mkv", "avi", "webm"].includes(ext) ||
        rawType.startsWith("video/")
    )
        return "video";

    // Audio (NEW)
    if (
        ["mp3", "wav", "ogg", "flac"].includes(ext) ||
        rawType.startsWith("audio/")
    )
        return "audio";

    // Spreadsheets
    if (
        ["xls", "xlsx", "csv", "tsv"].includes(ext) ||
        rawType.includes("sheet") ||
        rawType.includes("excel")
    )
        return "spreadsheet";

    // Presentations
    if (["ppt", "pptx", "key", "odp"].includes(ext)) return "presentation";

    // Documents
    if (
        ["doc", "docx"].includes(ext) ||
        rawType.includes("word") ||
        rawType.includes("document")
    )
        return "document";

    // Archives
    if (
        ["zip", "rar", "7z", "tar", "gz"].includes(ext) ||
        rawType.includes("archive") ||
        rawType.includes("compressed")
    )
        return "archive";

    // Code files
    if (
        [
            "py", "js", "ts", "tsx", "jsx", "java", "c", "h", "cpp", "cc", "cs",
            "go", "rb", "php", "rs", "swift", "kt", "scala", "sh", "sql",
            "yml", "yaml", "json", "xml", "toml",
        ].includes(ext)
    )
        return "code";

    // Text files
    if (["txt", "md", "log", "rtf"].includes(ext)) return "text";

    return "other";
}