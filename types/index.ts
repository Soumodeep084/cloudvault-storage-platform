export interface User {
    id: string;
    name: string;
    email: string;
    avatar: string;
    role: 'admin' | 'user';
    storageUsed: number;
    storageLimit: number;
    joinedAt: string;
}

export type FileCategory =
    | "pdf"
    | "image"
    | "video"
    | "audio"
    | "spreadsheet"
    | "presentation"
    | "document"
    | "archive"
    | "code"
    | "text"
    | "other";

export interface FileItem {
    id: string;
    name?: string;
    type?: FileCategory;
    size?: number | null;
    uploadedAt?: string | Date;
    modifiedAt?: string | Date;
    shared?: boolean;
    shareLink?: string;
    shareExpiresAt?: string | Date | null;

    // DB-oriented shape (Prisma File model)
    userId?: string;
    ownerId?: string;
    fileName?: string;
    fileUrl?: string;
    fileSize?: number | null;
    fileType?: string | null;
    isDeleted?: boolean;
    isTrashed?: boolean;
    folderId?: string | null;
    createdAt?: string | Date;
    updatedAt?: string | Date;

    versions?: Array<{
        id: string;
        version: number;
        size: number;
        createdAt: string | Date;
        createdBy: string;
        changes: string;
    }>;
}

export interface FolderItem {
    id: string;
    name: string;
    parentId?: string | null;
    shared?: boolean;
    shareLink?: string;
    shareExpiresAt?: string | Date | null;
    isTrashed?: boolean;
    createdAt?: string | Date;
    updatedAt?: string | Date;
}

export interface AdminStats {
    totalUsers: number;
    totalFiles: number;
    totalStorage: number;
    activeUsers: number;
    uploadsToday: number;
    sharesThisWeek: number;
}



