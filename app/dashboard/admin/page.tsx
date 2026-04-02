"use client";

import {
  Users,
  Files,
  HardDrive,
  Activity,
  TrendingUp,
  Share2,
} from "lucide-react";
import {
  adminStats,
  mockUsers,
  storageChartData,
  fileTypeDistribution,
} from "@/lib/mock-data";
import { formatFileSize } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

export default function AdminPage() {
  const stats = [
    {
      label: "Total Users",
      value: adminStats.totalUsers.toLocaleString(),
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Total Files",
      value: adminStats.totalFiles.toLocaleString(),
      icon: Files,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "Storage Used",
      value: formatFileSize(adminStats.totalStorage),
      icon: HardDrive,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      label: "Active Users",
      value: adminStats.activeUsers.toString(),
      icon: Activity,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      label: "Uploads Today",
      value: adminStats.uploadsToday.toString(),
      icon: TrendingUp,
      color: "text-rose-600",
      bg: "bg-rose-50",
    },
    {
      label: "Shares This Week",
      value: adminStats.sharesThisWeek.toString(),
      icon: Share2,
      color: "text-cyan-600",
      bg: "bg-cyan-50",
    },
  ];

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Admin Dashboard
        </h1>
        <p className="text-slate-500 mt-1">
          Real-time platform overview and system health.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-none shadow-sm bg-white">
            <CardContent className="p-6 flex items-center gap-4">
              <div
                className={`h-12 w-12 rounded-xl ${stat.bg} flex items-center justify-center shrink-0`}
              >
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">
                  {stat.value}
                </p>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  {stat.label}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-slate-100 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">
              Upload Activity (7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-75 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={storageChartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#f1f5f9"
                  />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    fontSize={12}
                    tick={{ fill: "#64748b" }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    fontSize={12}
                    tick={{ fill: "#64748b" }}
                  />
                  <Tooltip
                    cursor={{ fill: "#f8fafc" }}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "none",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    }}
                  />
                  <Bar
                    dataKey="uploads"
                    fill="#3b82f6"
                    radius={[6, 6, 0, 0]}
                    barSize={30}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-100 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">
              File Type Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <div className="h-75 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={fileTypeDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {fileTypeDistribution.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User Management Table */}
      <Card className="border-slate-100 shadow-sm overflow-hidden">
        <CardHeader className="bg-white border-b border-slate-50">
          <CardTitle className="text-lg font-semibold">
            User Management
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="font-semibold py-4">User</TableHead>
                <TableHead className="font-semibold">Role</TableHead>
                <TableHead className="font-semibold">Storage Usage</TableHead>
                <TableHead className="hidden md:table-cell font-semibold">
                  Joined
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockUsers.map((u) => (
                <TableRow
                  key={u.id}
                  className="hover:bg-slate-50/50 transition-colors"
                >
                  <TableCell className="py-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 ring-2 ring-slate-100">
                        <AvatarFallback className="text-xs font-bold bg-slate-100 text-slate-600">
                          {u.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold text-sm text-slate-900">
                          {u.name}
                        </p>
                        <p className="text-xs text-slate-500">{u.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={u.role === "admin" ? "default" : "secondary"}
                      className={
                        u.role === "admin"
                          ? "bg-indigo-600 hover:bg-indigo-700"
                          : "bg-slate-100 text-slate-600 border-none"
                      }
                    >
                      {u.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="min-w-50">
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[10px] font-bold uppercase text-slate-400">
                        <span>{formatFileSize(u.storageUsed)}</span>
                        <span>
                          {((u.storageUsed / u.storageLimit) * 100).toFixed(0)}%
                        </span>
                      </div>
                      <Progress
                        value={(u.storageUsed / u.storageLimit) * 100}
                        className="h-1.5 bg-slate-100"
                      />
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-slate-500 text-sm font-medium">
                    {new Date(u.joinedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
