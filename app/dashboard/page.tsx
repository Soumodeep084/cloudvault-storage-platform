import { Files, Upload, Share2, TrendingUp } from "lucide-react";
import { mockFiles } from "@/lib/mock-data";
import { formatFileSize } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileIcon } from "@/components/DashboardComponents/FileIcon";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth-help";

export default async function DashboardHome() {
  const user = await getSessionUser();
  const recentFiles = mockFiles.slice(0, 5);
  const sharedCount = mockFiles.filter((f) => f.shared).length;
  const totalSize = mockFiles.reduce((a, f) => a + f.size, 0);

  const stats = [
    {
      label: "Total Files",
      value: mockFiles.length.toString(),
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
    { label: "Uploads Today", value: "3", icon: Upload, color: "text-info" },
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
                <FileIcon type={file.type} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  {formatDate(file.modifiedAt)}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
