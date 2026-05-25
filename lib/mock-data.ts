import { FileItem, User, AdminStats, FolderItem } from "@/types";
import { STORAGE_LIMIT_BYTES } from "@/lib/constants";

/* -------------------------------------------------------------------------- */
/*                                CURRENT USER                                */
/* -------------------------------------------------------------------------- */

export const currentUser: User = {
  id: "1",
  name: "Alex Johnson",
  email: "alex@cloudvault.com",
  avatar: "",
  role: "ADMIN",
  storageUsed: 420 * 1024 * 1024,
  storageLimit: STORAGE_LIMIT_BYTES,
  joinedAt: "2026-04-10",
};

/* -------------------------------------------------------------------------- */
/*                                   USERS                                    */
/* -------------------------------------------------------------------------- */

export const mockUsers: User[] = [
  currentUser,

  {
    id: "2",
    name: "Sarah Chen",
    email: "sarah@example.com",
    avatar: "",
    role: "USER",
    storageUsed: 180 * 1024 * 1024,
    storageLimit: STORAGE_LIMIT_BYTES,
    joinedAt: "2026-04-18",
  },

  {
    id: "3",
    name: "Mike Rivera",
    email: "mike@example.com",
    avatar: "",
    role: "USER",
    storageUsed: 720 * 1024 * 1024,
    storageLimit: STORAGE_LIMIT_BYTES,
    joinedAt: "2026-04-20",
  },

  {
    id: "4",
    name: "Emily Park",
    email: "emily@example.com",
    avatar: "",
    role: "USER",
    storageUsed: 90 * 1024 * 1024,
    storageLimit: STORAGE_LIMIT_BYTES,
    joinedAt: "2026-05-01",
  },
];

/* -------------------------------------------------------------------------- */
/*                                  FOLDERS                                   */
/* -------------------------------------------------------------------------- */

export const mockFolders: FolderItem[] = [
  {
    id: "folder-1",
    name: "Documents",
    parentId: null,
    createdAt: "2026-05-10",
    updatedAt: "2026-05-20",
  },

  {
    id: "folder-2",
    name: "Images",
    parentId: null,
    createdAt: "2026-05-11",
    updatedAt: "2026-05-18",
  },

  {
    id: "folder-3",
    name: "Projects",
    parentId: null,
    createdAt: "2026-05-12",
    updatedAt: "2026-05-22",
  },
];

/* -------------------------------------------------------------------------- */
/*                                   FILES                                    */
/* -------------------------------------------------------------------------- */

export const mockFiles: FileItem[] = [
  {
    id: "1",

    name: "Resume.pdf",
    type: "pdf",
    size: 2.4 * 1024 * 1024,

    uploadedAt: "2026-05-12",
    modifiedAt: "2026-05-12",

    shared: true,
    shareLink: "https://cloudvault.com/share/resume123",

    ownerId: "1",

    // Prisma-aligned fields
    userId: "1",
    fileName: "Resume.pdf",
    fileUrl: "/mock/resume.pdf",
    fileSize: 2.4 * 1024 * 1024,
    fileType: "application/pdf",

    folderId: "folder-1",

    isDeleted: false,
    isTrashed: false,

    createdAt: "2026-05-12",
    updatedAt: "2026-05-12",
  },

  {
    id: "2",

    name: "ProfilePhoto.png",
    type: "image",
    size: 3.2 * 1024 * 1024,

    uploadedAt: "2026-05-14",
    modifiedAt: "2026-05-14",

    shared: false,

    ownerId: "1",

    userId: "1",
    fileName: "ProfilePhoto.png",
    fileUrl: "/mock/profile-photo.png",
    fileSize: 3.2 * 1024 * 1024,
    fileType: "image/png",

    folderId: "folder-2",

    isDeleted: false,
    isTrashed: false,

    createdAt: "2026-05-14",
    updatedAt: "2026-05-14",
  },

  {
    id: "3",

    name: "CollegeNotes.docx",
    type: "document",
    size: 1.1 * 1024 * 1024,

    uploadedAt: "2026-05-16",
    modifiedAt: "2026-05-17",

    shared: false,

    ownerId: "1",

    userId: "1",
    fileName: "CollegeNotes.docx",
    fileUrl: "/mock/college-notes.docx",
    fileSize: 1.1 * 1024 * 1024,
    fileType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

    folderId: "folder-1",

    isDeleted: false,
    isTrashed: false,

    createdAt: "2026-05-16",
    updatedAt: "2026-05-17",
  },

  {
    id: "4",

    name: "ProjectDemo.mp4",
    type: "video",
    size: 85 * 1024 * 1024,

    uploadedAt: "2026-05-18",
    modifiedAt: "2026-05-18",

    shared: true,
    shareLink: "https://cloudvault.com/share/demo456",

    ownerId: "1",

    userId: "1",
    fileName: "ProjectDemo.mp4",
    fileUrl: "/mock/project-demo.mp4",
    fileSize: 85 * 1024 * 1024,
    fileType: "video/mp4",

    folderId: "folder-3",

    isDeleted: false,
    isTrashed: false,

    createdAt: "2026-05-18",
    updatedAt: "2026-05-18",
  },

  {
    id: "5",

    name: "DesignAssets.zip",
    type: "archive",
    size: 24 * 1024 * 1024,

    uploadedAt: "2026-05-19",
    modifiedAt: "2026-05-19",

    shared: false,

    ownerId: "1",

    userId: "1",
    fileName: "DesignAssets.zip",
    fileUrl: "/mock/design-assets.zip",
    fileSize: 24 * 1024 * 1024,
    fileType: "application/zip",

    folderId: "folder-3",

    isDeleted: false,
    isTrashed: false,

    createdAt: "2026-05-19",
    updatedAt: "2026-05-19",
  },

  {
    id: "6",

    name: "Invoice.xlsx",
    type: "spreadsheet",
    size: 0.8 * 1024 * 1024,

    uploadedAt: "2026-05-20",
    modifiedAt: "2026-05-21",

    shared: false,

    ownerId: "1",

    userId: "1",
    fileName: "Invoice.xlsx",
    fileUrl: "/mock/invoice.xlsx",
    fileSize: 0.8 * 1024 * 1024,
    fileType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

    folderId: "folder-1",

    isDeleted: false,
    isTrashed: false,

    createdAt: "2026-05-20",
    updatedAt: "2026-05-21",
  },
];

/* -------------------------------------------------------------------------- */
/*                                ADMIN STATS                                 */
/* -------------------------------------------------------------------------- */

export const adminStats: AdminStats = {
  totalUsers: 124,
  totalFiles: 856,
  totalStorage: 320 * 1024 * 1024 * 1024,
  activeUsers: 38,
  uploadsToday: 24,
  sharesThisWeek: 12,
};

/* -------------------------------------------------------------------------- */
/*                              STORAGE CHART DATA                            */
/* -------------------------------------------------------------------------- */

export const storageChartData = [
  { name: "Jan", uploads: 24, storage: 40 },
  { name: "Feb", uploads: 38, storage: 75 },
  { name: "Mar", uploads: 52, storage: 110 },
  { name: "Apr", uploads: 67, storage: 160 },
  { name: "May", uploads: 81, storage: 240 },
  { name: "Jun", uploads: 95, storage: 320 },
];

/* -------------------------------------------------------------------------- */
/*                           FILE TYPE DISTRIBUTION                           */
/* -------------------------------------------------------------------------- */

export const fileTypeDistribution = [
  {
    name: "Documents",
    value: 35,
    fill: "hsl(217, 91%, 60%)",
  },

  {
    name: "Images",
    value: 25,
    fill: "hsl(142, 71%, 45%)",
  },

  {
    name: "Videos",
    value: 15,
    fill: "hsl(38, 92%, 50%)",
  },

  {
    name: "Archives",
    value: 10,
    fill: "hsl(0, 84%, 60%)",
  },

  {
    name: "Others",
    value: 15,
    fill: "hsl(215, 16%, 47%)",
  },
];