import { db } from "@/lib/prisma";
import { ADMIN_PAGE_SIZE, getPageOffset } from "./admin-utils";
import type { Prisma } from "@prisma/client";
import type {
  AdminDashboardData,
  AdminArchivedDeletionRow,
  AdminSearchParams,
  AdminScheduledDeletionRow,
  AdminStorageUserRow,
  AdminUserRow,
} from "./admin-types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getMetadataString(metadata: unknown, key: string) {
  if (!isRecord(metadata)) return null;
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function buildUserSearchWhere(query: string) {
  return query
    ? {
        deleted: false,
        OR: [
          { name: { contains: query, mode: "insensitive" as const } },
          { email: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : { deleted: false };
}

function buildDeletionSearchWhere(query: string, scheduledOnly: boolean) {
  return query
    ? {
        deleted: true,
        deletionScheduledAt: scheduledOnly ? { not: null } : null,
        OR: [
          { name: { contains: query, mode: "insensitive" as const } },
          { email: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : {
        deleted: true,
        deletionScheduledAt: scheduledOnly ? { not: null } : null,
      };
}

function buildLogSearchWhere(query: string) {
  return query
    ? {
        OR: [
          { action: { contains: query, mode: "insensitive" as const } },
          { targetEmail: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : {};
}

async function getAdminStats() {
  const [totalUsers, deletedUsers, totalFiles, totalFolders, storageAgg] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { deleted: true } }),
    db.file.count({ where: { isDeleted: false } }),
    db.folder.count({ where: { isDeleted: false } }),
    db.user.aggregate({ _sum: { storageUsed: true } }),
  ]);

  const totalStorageBytes = storageAgg._sum.storageUsed ?? BigInt(0);

  return {
    totalUsers,
    deletedUsers,
    totalFiles,
    totalFolders,
    totalStorageBytes,
    activeUsers: Math.max(0, totalUsers - deletedUsers),
  };
}

async function getAdminUsers(query: string, page: number) {
  const baseWhere = buildUserSearchWhere(query);
  const where: Prisma.UserWhereInput = { ...baseWhere, role: "USER" as const };

  const [total, rows] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: getPageOffset(page),
      take: ADMIN_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        storageUsed: true,
        createdAt: true,
        _count: { select: { files: true } },
      },
    }),
  ]);

  return {
    total,
    rows: rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      storageUsed: row.storageUsed,
      createdAt: row.createdAt,
      filesCount: row._count.files,
    })),
    page,
  };
}

async function getAdminScheduledDeletions(query: string, page: number) {
  const where: Prisma.UserWhereInput = {
    ...buildDeletionSearchWhere(query, true),
    role: "USER" as const,
  };

  const [total, rows] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: { deletionScheduledAt: "asc" },
      skip: getPageOffset(page),
      take: ADMIN_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        deletionScheduledAt: true,
        updatedAt: true,
      },
    }),
  ]);

  return {
    total,
    rows,
    page,
  };
}

async function getAdminPermanentDeletions(page: number) {
  const permanentWhere = { action: "ADMIN_PERMANENT_DELETE_USER" };

  const [total, rows] = await Promise.all([
    db.systemLog.count({ where: permanentWhere }),
    db.systemLog.findMany({
      where: permanentWhere,
      orderBy: { createdAt: "desc" },
      skip: getPageOffset(page),
      take: ADMIN_PAGE_SIZE,
      select: {
        id: true,
        targetEmail: true,
        metadata: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    total,
    rows: rows.map((row) => ({
      id: row.id,
      name: getMetadataString(row.metadata, "targetName"),
      email: row.targetEmail ?? "-",
      deletedBy: getMetadataString(row.metadata, "deletedBy"),
      deletedAt: row.createdAt,
    })),
    page,
  };
}

async function getAdminLogs(query: string, page: number) {
  const where = buildLogSearchWhere(query);

  const [total, rows] = await Promise.all([
    db.systemLog.count({ where }),
    db.systemLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: getPageOffset(page),
      take: ADMIN_PAGE_SIZE,
      select: {
        id: true,
        action: true,
        targetEmail: true,
        metadata: true,
        createdAt: true,
      },
    }),
  ]);

  return { total, rows, page };
}

async function getAdminStorage() {
  const rows = await db.user.findMany({
    where: { deleted: false, role: "USER" as const },
    orderBy: { storageUsed: "desc" },
    take: 5,
    select: { id: true, name: true, email: true, storageUsed: true },
  });

  return { topUsers: rows };
}

function createEmptyAdminDashboardData(
  params: AdminSearchParams,
): Omit<AdminDashboardData, "stats"> {
  return {
    users: {
      total: 0,
      rows: [] as AdminUserRow[],
      page: params.userPage,
    },
    deletions: {
      scheduled: {
        total: 0,
        rows: [] as AdminScheduledDeletionRow[],
        page: params.scheduledPage,
      },
      archived: {
        total: 0,
        rows: [] as AdminArchivedDeletionRow[],
        page: params.archivedPage,
      },
      permanent: {
        total: 0,
        rows: [] as AdminDashboardData["deletions"]["permanent"]["rows"],
        page: params.permanentPage,
      },
    },
    logs: {
      total: 0,
      rows: [] as AdminDashboardData["logs"]["rows"],
      page: params.logsPage,
    },
    storage: {
      topUsers: [] as AdminStorageUserRow[],
    },
  };
}

export async function getAdminDashboardData(
  params: AdminSearchParams,
): Promise<AdminDashboardData> {
  const [stats, activeData] = await Promise.all([
    getAdminStats(),
    (async () => {
      const emptyData = createEmptyAdminDashboardData(params);

      switch (params.tab) {
        case "users":
          return {
            ...emptyData,
            users: await getAdminUsers("", params.userPage),
          };
        case "deletions":
          return {
            ...emptyData,
            deletions: {
              ...emptyData.deletions,
              scheduled: await getAdminScheduledDeletions("", params.scheduledPage),
            },
          };
        case "deleted":
          return {
            ...emptyData,
            deletions: {
              ...emptyData.deletions,
              permanent: await getAdminPermanentDeletions(params.permanentPage),
            },
          };
        case "logs":
          return {
            ...emptyData,
            logs: await getAdminLogs("", params.logsPage),
          };
        case "storage":
          return {
            ...emptyData,
            storage: await getAdminStorage(),
          };
      }
    })(),
  ]);

  return {
    stats,
    ...activeData,
  };
}
