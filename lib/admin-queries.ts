import { db } from "@/lib/prisma";
import { ADMIN_PAGE_SIZE, getPageOffset } from "./admin-utils";
import type {
  AdminDashboardData,
  AdminSearchParams,
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
  const where = buildUserSearchWhere(query);

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

async function getAdminDeletions(
  scheduledQuery: string,
  archivedQuery: string,
  permanentPage: number,
  scheduledPage: number,
  archivedPage: number,
) {
  const scheduledWhere = buildDeletionSearchWhere(scheduledQuery, true);
  const archivedWhere = buildDeletionSearchWhere(archivedQuery, false);
  const permanentWhere = { action: "ADMIN_PERMANENT_DELETE_USER" };

  const [scheduledTotal, scheduledRows, archivedTotal, archivedRows, permanentTotal, permanentRows] = await Promise.all([
    db.user.count({ where: scheduledWhere }),
    db.user.findMany({
      where: scheduledWhere,
      orderBy: { deletionScheduledAt: "asc" },
      skip: getPageOffset(scheduledPage),
      take: ADMIN_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        deletionScheduledAt: true,
        updatedAt: true,
      },
    }),
    db.user.count({ where: archivedWhere }),
    db.user.findMany({
      where: archivedWhere,
      orderBy: { updatedAt: "desc" },
      skip: getPageOffset(archivedPage),
      take: ADMIN_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        updatedAt: true,
      },
    }),
    db.systemLog.count({ where: permanentWhere }),
    db.systemLog.findMany({
      where: permanentWhere,
      orderBy: { createdAt: "desc" },
      skip: getPageOffset(permanentPage),
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
    scheduled: {
      total: scheduledTotal,
      rows: scheduledRows,
      page: scheduledPage,
    },
    archived: {
      total: archivedTotal,
      rows: archivedRows,
      page: archivedPage,
    },
    permanent: {
      total: permanentTotal,
      rows: permanentRows.map((row) => ({
        id: row.id,
        name: getMetadataString(row.metadata, "targetName"),
        email: row.targetEmail ?? "-",
        deletedBy: getMetadataString(row.metadata, "deletedBy"),
        deletedAt: row.createdAt,
      })),
      page: permanentPage,
    },
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
    where: { deleted: false },
    orderBy: { storageUsed: "desc" },
    take: 5,
    select: { id: true, name: true, email: true, storageUsed: true },
  });

  return { topUsers: rows };
}

export async function getAdminDashboardData(
  params: AdminSearchParams,
): Promise<AdminDashboardData> {
  const usersQuery = "";
  const scheduledQuery = "";
  const archivedQuery = "";
  const logsQuery = "";

  const [stats, users, deletions, logs, storage] = await Promise.all([
    getAdminStats(),
    getAdminUsers(usersQuery, params.userPage),
    getAdminDeletions(
      scheduledQuery,
      archivedQuery,
      params.permanentPage,
      params.scheduledPage,
      params.archivedPage,
    ),
    getAdminLogs(logsQuery, params.logsPage),
    getAdminStorage(),
  ]);

  return {
    stats,
    users,
    deletions,
    logs,
    storage,
  };
}
