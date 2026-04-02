import { Files, Upload, Share2, TrendingUp } from "lucide-react";
import { formatFileSize } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileIcon } from "@/components/DashboardComponents/FileIcon";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth-help";
import { db } from "@/lib/prisma";
import { FileCategory } from "@/types";

function toFileCategory(fileType: string | null, fileName: string): FileCategory {
  const rawType = (fileType || "").toLowerCase();
  const lowerName = fileName.toLowerCase();

  if (rawType.includes("pdf") || lowerName.endsWith(".pdf")) return "pdf";
  if (rawType.includes("image") || /(png|jpg|jpeg|gif|webp|svg)$/i.test(lowerName)) return "image";
  if (rawType.includes("video") || /(mp4|mov|mkv|avi|webm)$/i.test(lowerName)) return "video";
  if (rawType.includes("sheet") || rawType.includes("excel") || /(xls|xlsx|csv)$/i.test(lowerName)) return "spreadsheet";
  if (rawType.includes("archive") || /(zip|rar|7z|tar|gz)$/i.test(lowerName)) return "archive";
  if (rawType.includes("doc") || /(doc|docx|txt|md)$/i.test(lowerName)) return "document";
  return "other";
}

export default async function DashboardHome() {
  const user = await getSessionUser();
  if (!user) return null;

  const [allFiles, sharedCount, uploadsToday] = await Promise.all([
    db.file.findMany({
      where: { userId: user.id, isDeleted: false },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.share.count({ where: { userId: user.id } }),
    db.file.count({
      where: {
        userId: user.id,
        isDeleted: false,
        createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    }),
  ]);

  const fileStats = await db.file.aggregate({
    where: { userId: user.id, isDeleted: false },
    _count: { _all: true },
    _sum: { fileSize: true },
  });

  const recentFiles = allFiles;
  const totalSize = fileStats._sum.fileSize ?? 0;
  const totalFiles = fileStats._count._all;

  const stats = [
    {
      label: "Total Files",
      value: totalFiles.toString(),
      icon: Files,
      color: "text-primary",
    },
    {
      label: "Storage Used",
      value: formatFileSize(totalSize),
      icon: TrendingUp,
      color: "text-success",
    },
    {
      label: "Shared Files",
      value: sharedCount.toString(),
      icon: Share2,
      color: "text-warning",
    },
    {
      label: "Uploads Today",
      value: uploadsToday.toString(),
      icon: Upload,
      color: "text-info",
    },
  ];

  return (
    <div className="space-y-6 bg-primary-foreground">
      <div>
        <h1 className="text-2xl font-bold">
          Welcome back, {user?.name?.split(" ")[0]}!
        </h1>
        <p className="text-muted-foreground">
          Here's an overview of your files
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="bg-white">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-white">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Recent Files</CardTitle>
          <Button variant="subtle" size="sm" asChild>
            <Link href="/dashboard/files">View all</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors"
              >
                <FileIcon type={toFileCategory(file.fileType, file.fileName)} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{file.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.fileSize ?? 0)}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  {formatDate(file.updatedAt)}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
