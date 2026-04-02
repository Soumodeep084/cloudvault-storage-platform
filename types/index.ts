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

export interface FileItem {
    id: string;
    name: string;
    type: 'pdf' | 'image' | 'video' | 'document' | 'spreadsheet' | 'archive' | 'other';
    size: number;
    uploadedAt: string;
    modifiedAt: string;
    shared: boolean;
    shareLink?: string;
    versions: FileVersion[];
    ownerId: string;
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



