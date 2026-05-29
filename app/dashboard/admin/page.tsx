import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileText,
  HardDrive,
  RefreshCw,
  UserX,
  Users,
} from "lucide-react";
import { getSessionUser } from "@/lib/auth-help";
import { formatFileSize } from "@/lib/utils";
import { AdminRefreshButton } from "./refresh-button";
import { AdminUserActions } from "./user-actions";
import { DataCard, Pager, StatCard } from "./admin-components";
import { getAdminDashboardData } from "@/lib/admin-queries";
import type {
  AdminDashboardData,
  AdminSearchParamsInput,
} from "@/lib/admin-types";
import {
  buildAdminHref,
  formatDateSafe,
  formatLogAction,
  getLogActionTone,
  getLogMetadataNumber,
  getLogMetadataValue,
  getPageCount,
  getPageOffset,
  normalizeAdminSearchParams,
} from "@/lib/admin-utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<AdminSearchParamsInput>;
}) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/login");
  if (sessionUser.role !== "ADMIN") redirect("/dashboard");

  const rawSearchParams = await searchParams;
  const params = normalizeAdminSearchParams(rawSearchParams);
  const data: AdminDashboardData = await getAdminDashboardData(params);

  const activeUserRows = data.users.rows.map((user) => ({
    ...user,
    storageLabel: formatFileSize(Number(user.storageUsed)),
  }));

  const scheduledDeletionRows = data.deletions.scheduled.rows.map((user) => ({
    ...user,
    scheduledForLabel: formatDateSafe(user.deletionScheduledAt),
    deletedOnLabel: formatDateSafe(user.updatedAt),
  }));

  const permanentDeletionRows = data.deletions.permanent.rows.map((user) => ({
    ...user,
    deletedAtLabel: formatDateSafe(user.deletedAt),
  }));

  const logRows = data.logs.rows.map((log, index) => ({
    ...log,
    srNo: getPageOffset(data.logs.page) + index + 1,
    actionLabel: formatLogAction(log.action),
    actionTone: getLogActionTone(log.action),
    targetEmailLabel: log.targetEmail || "-",
    totalFilesLabel: getLogMetadataValue(log.metadata, "totalFiles"),
    totalFoldersLabel: getLogMetadataValue(log.metadata, "totalFolders"),
    storageUsedLabel: formatFileSize(
      getLogMetadataNumber(log.metadata, "storageUsedBytes"),
    ),
    deletedByLabel: getLogMetadataValue(log.metadata, "deletedBy"),
    createdAtLabel: log.createdAt.toLocaleString(),
  }));

  const tabHref = (tab: string) =>
    buildAdminHref(rawSearchParams, {
      tab,
      userPage: 1,
      scheduledPage: 1,
      permanentPage: 1,
      logsPage: 1,
    });

  return (
    <div className="relative mx-auto w-full max-w-7xl space-y-6 px-2 py-2">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold">
            Welcome back, Admin {sessionUser?.name?.split(" ")[0]}!
          </h1>

          <p className="text-muted-foreground">
            Here&apos;s an overview of your System
          </p>
        </div>

        <div className="flex justify-start md:justify-end">
          <AdminRefreshButton />
        </div>
      </div>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="Total Users"
          value={String(data.stats.totalUsers)}
          helper="Registered accounts"
          icon={Users}
          accent="bg-primary/10 text-primary"
        />
        <StatCard
          title="Active Users"
          value={String(data.stats.activeUsers)}
          helper="Currently available"
          icon={RefreshCw}
          accent="bg-emerald-500/10 text-emerald-600"
        />
        <StatCard
          title="Deleted Users"
          value={String(data.stats.deletedUsers)}
          helper="Accounts in deletion flow"
          icon={UserX}
          accent="bg-destructive/10 text-destructive"
        />
        <StatCard
          title="Total Files"
          value={String(data.stats.totalFiles)}
          helper="Stored items"
          icon={FileText}
          accent="bg-sky-500/10 text-sky-600"
        />
        <StatCard
          title="Storage Used"
          value={formatFileSize(data.stats.totalStorageBytes)}
          helper="Across active users"
          icon={HardDrive}
          accent="bg-amber-500/10 text-amber-600"
        />
      </section>

      <Tabs value={params.tab} className="space-y-4">
        <TabsList className="w-full justify-start gap-2 overflow-x-auto rounded-sm bg-muted/70 p-1 sm:w-fit">
          <TabsTrigger
            asChild
            value="users"
            className="min-w-fit rounded-md px-4 py-2"
          >
            <Link href={tabHref("users")} scroll={false}>
              Users
            </Link>
          </TabsTrigger>
          <TabsTrigger
            asChild
            value="deletions"
            className="min-w-fit rounded-md px-4 py-2"
          >
            <Link href={tabHref("deletions")} scroll={false}>
              Scheduled Deletions
            </Link>
          </TabsTrigger>
          <TabsTrigger
            asChild
            value="deleted"
            className="min-w-fit rounded-md px-4 py-2"
          >
            <Link href={tabHref("deleted")} scroll={false}>
              Deleted Users
            </Link>
          </TabsTrigger>
          <TabsTrigger
            asChild
            value="logs"
            className="min-w-fit rounded-md px-4 py-2"
          >
            <Link href={tabHref("logs")} scroll={false}>
              System Logs
            </Link>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <DataCard title="Active Users" badge={`${data.users.total} matching`}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Storage</TableHead>
                  <TableHead>Files</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeUserRows.length > 0 &&
                  activeUserRows.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {user.name || "Unknown"}
                      </TableCell>
                      <TableCell className="max-w-[16rem] truncate text-muted-foreground">
                        {user.email}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            user.role === "ADMIN" ? "default" : "secondary"
                          }
                        >
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {user.storageLabel}
                      </TableCell>
                      <TableCell>{user.filesCount}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {user.createdAt.toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {user.role === "ADMIN" ? (
                          <span className="text-xs text-muted-foreground">
                            -
                          </span>
                        ) : (
                          <AdminUserActions
                            userId={user.id}
                            isDeleted={false}
                            userEmail={user?.email}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                {activeUserRows.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-6 text-center font-semibold"
                    >
                      No active users found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            <Pager
              current={data.users.page}
              total={getPageCount(data.users.total)}
              hrefBuilder={(page) =>
                buildAdminHref(rawSearchParams, {
                  tab: "users",
                  userPage: page,
                })
              }
            />
          </DataCard>
        </TabsContent>

        <TabsContent value="deletions" className="space-y-4">
          <DataCard
            title="Scheduled Deletions"
            badge={`${data.deletions.scheduled.total} matching`}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Scheduled For</TableHead>
                  <TableHead>Deleted On</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scheduledDeletionRows.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium whitespace-nowrap">
                      {user.name || "Unknown"}
                    </TableCell>
                    <TableCell className="max-w-[16rem] truncate text-muted-foreground">
                      {user.email}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {user.scheduledForLabel}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {user.deletedOnLabel}
                    </TableCell>
                    <TableCell className="text-right">
                      <AdminUserActions
                        userId={user.id}
                        isDeleted
                        userEmail={user?.email}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {scheduledDeletionRows.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-6 text-center font-semibold"
                    >
                      No scheduled deletions found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            <Pager
              current={data.deletions.scheduled.page}
              total={getPageCount(data.deletions.scheduled.total)}
              hrefBuilder={(page) =>
                buildAdminHref(rawSearchParams, {
                  tab: "deletions",
                  scheduledPage: page,
                })
              }
            />
          </DataCard>
        </TabsContent>
        <TabsContent value="deleted" className="space-y-4">
          

          <DataCard
            title="Permanently Deleted Accounts"
            badge={`${data.deletions.permanent.total} matching`}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Deleted On</TableHead>
                  <TableHead>Deleted By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {permanentDeletionRows.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="max-w-[16rem] truncate text-muted-foreground">
                      {user.email}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {user.deletedAtLabel}
                    </TableCell>
                    <TableCell className="max-w-[16rem] truncate text-muted-foreground">
                      {user.deletedBy || "-"}
                    </TableCell>
                  </TableRow>
                ))}
                {permanentDeletionRows.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="py-6 text-center font-semibold"
                    >
                      No permanently deleted accounts found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            <Pager
              current={data.deletions.permanent.page}
              total={getPageCount(data.deletions.permanent.total)}
              hrefBuilder={(page) =>
                buildAdminHref(rawSearchParams, {
                  tab: "deleted",
                  permanentPage: page,
                })
              }
            />
          </DataCard>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <DataCard title="System Logs" badge={`${data.logs.total} matching`}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sr No</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Target Email</TableHead>
                  <TableHead>Total Files</TableHead>
                  <TableHead>Total Folders</TableHead>
                  <TableHead>Storage Used</TableHead>
                  <TableHead>Deleted By</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logRows.map((log) => (
                  <TableRow key={log.id} className="align-top">
                    <TableCell className="whitespace-nowrap font-medium text-muted-foreground">
                      {log.srNo}
                    </TableCell>
                    <TableCell>
                      <Badge variant={log.actionTone}>{log.actionLabel}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[16rem] truncate">
                      {log.targetEmailLabel}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {log.totalFilesLabel}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {log.totalFoldersLabel}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {log.storageUsedLabel}
                    </TableCell>
                    <TableCell className="max-w-[16rem] truncate">
                      {log.deletedByLabel}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {log.createdAtLabel}
                    </TableCell>
                  </TableRow>
                ))}
                {logRows.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="py-6 text-center font-semibold"
                    >
                      No logs found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            <Pager
              current={data.logs.page}
              total={getPageCount(data.logs.total)}
              hrefBuilder={(page) =>
                buildAdminHref(rawSearchParams, { tab: "logs", logsPage: page })
              }
            />
          </DataCard>
        </TabsContent>

        
      </Tabs>
    </div>
  );
}
