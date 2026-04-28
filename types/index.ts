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
    | 'pdf'
    | 'image'
    | 'video'
    | 'document'
    | 'spreadsheet'
    | 'archive'
    | 'other';

export interface FileItem {
    id: string;
        // UI-oriented shape
        name?: string;
        type?: FileCategory;
        size?: number | null;
        uploadedAt?: string | Date;
        modifiedAt?: string | Date;
        shared?: boolean;
    shareLink?: string;
        shareExpiresAt?: string | Date | null;
        versions?: FileVersion[];

        // DB-oriented shape (Prisma File model)
        userId?: string;
        ownerId?: string;
        fileName?: string;
        fileUrl?: string;
        fileSize?: number | null;
        fileType?: string | null;
        isDeleted?: boolean;
        createdAt?: string | Date;
        updatedAt?: string | Date;
}

export interface FileVersion {
    id: string;
    version: number;
    size: number;
    createdAt: string;
    createdBy: string;
    changes: string;
}

export interface AdminStats {
    totalUsers: number;
    totalFiles: number;
    totalStorage: number;
    activeUsers: number;
    uploadsToday: number;
    sharesThisWeek: number;
}



