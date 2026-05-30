export const ADMIN_TABS = ["users", "deletions", "deleted", "logs", "storage"] as const;

export type AdminTab = (typeof ADMIN_TABS)[number];

export type AdminSearchParamsInput = Record<
  string,
  string | string[] | undefined
>;

export type AdminSearchParams = {
  tab: AdminTab;
  userPage: number;
  scheduledPage: number;
  archivedPage: number;
  permanentPage: number;
  logsPage: number;
};

export type AdminUserRow = {
  id: string;
  name: string | null;
  email: string;
  role: "USER" | "ADMIN";
  storageUsed: bigint;
  createdAt: Date;
  filesCount: number;
};

export type AdminScheduledDeletionRow = {
  id: string;
  name: string | null;
  email: string;
  deletionScheduledAt: Date | null;
  updatedAt: Date;
};

export type AdminArchivedDeletionRow = {
  id: string;
  name: string | null;
  email: string;
  updatedAt: Date;
};

export type AdminPermanentDeletionRow = {
  id: string;
  name: string | null;
  email: string;
  deletedBy: string | null;
  deletedAt: Date;
};

export type AdminLogMetadata = {
  totalFiles?: number | null;
  totalFolders?: number | null;
  storageUsedBytes?: number | string | null;
  deletedBy?: string | null;
  [key: string]: unknown;
};

export type AdminLogRow = {
  id: string;
  action: string;
  targetEmail: string | null;
  metadata: unknown;
  createdAt: Date;
};

export type AdminStorageUserRow = {
  id: string;
  name: string | null;
  email: string;
  storageUsed: bigint;
};

export type AdminDashboardStats = {
  totalUsers: number;
  deletedUsers: number;
  totalFiles: number;
  totalFolders: number;
  totalStorageBytes: bigint;
  activeUsers: number;
};

export type AdminDashboardData = {
  stats: AdminDashboardStats;
  users: {
    total: number;
    rows: AdminUserRow[];
    page: number;
  };
  deletions: {
    scheduled: {
      total: number;
      rows: AdminScheduledDeletionRow[];
      page: number;
    };
    archived: {
      total: number;
      rows: AdminArchivedDeletionRow[];
      page: number;
    };
    permanent: {
      total: number;
      rows: AdminPermanentDeletionRow[];
      page: number;
    };
  };
  logs: {
    total: number;
    rows: AdminLogRow[];
    page: number;
  };
  storage: {
    topUsers: AdminStorageUserRow[];
  };
};
