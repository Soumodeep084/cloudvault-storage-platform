"use client";

import {
  Files,
  Upload,
  Share2,
  History,
  Settings,
  LayoutDashboard,
  Shield,
  Cloud,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { formatFileSize, cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

// Define the shape of the user prop
interface AppSidebarProps {
  user: {
    name: string | null;
    email: string;
    role: string;
    storageUsed?: number;
    storageLimit?: number;
  } | null;
}

const mainItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "My Files", url: "/dashboard/files", icon: Files },
  { title: "Upload", url: "/dashboard/upload", icon: Upload },
  { title: "Shared Files", url: "/dashboard/shared", icon: Share2 },
  { title: "Activity Feed", url: "/dashboard/history", icon: History },
  { title: "Settings", url: "/dashboard/settings", icon: Settings },
];

const adminItems = [
  { title: "Admin Panel", url: "/dashboard/admin", icon: Shield },
];

export function AppSidebar({ user }: AppSidebarProps) {
  // Accept user here
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = usePathname();

  // Handle default storage values if not in DB yet
  const used = user?.storageUsed || 0;
  const limit = user?.storageLimit || 50 * 1024 * 1024; // Default 50MB
  const storagePercent = (used / limit) * 100;

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="bg-white">
        <SidebarGroup>
          <SidebarGroupLabel className="px-3 py-6">
            {!collapsed ? (
              <div className="flex items-center gap-2">
                <Cloud className="h-6 w-6 text-primary" />
                <span className="font-bold text-lg text-foreground text-nowrap">
                  CloudVault
                </span>
              </div>
            ) : (
              <Cloud className="h-6 w-6 text-primary mx-auto" />
            )}
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => {
                const isActive =
                  item.url === "/dashboard"
                    ? pathname === item.url
                    : pathname.startsWith(item.url);

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={item.title}>
                      <Link
                        href={item.url}
                        className={cn(
                          "flex items-center my-0.5",
                          isActive &&
                            "bg-sidebar-accent font-semibold text-primary",
                        )}
                      >
                        <item.icon className="h-4 w-4 mr-2" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {user?.role === "ADMIN" && ( // Check real role from DB
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => {
                  const isActive =
                    item.url === "/dashboard"
                      ? pathname === item.url
                      : pathname.startsWith(item.url);
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild tooltip={item.title}>
                        <Link
                          href={item.url}
                          className={cn(
                            "flex items-center",
                            isActive &&
                              "bg-sidebar-accent font-semibold text-primary",
                          )}
                        >
                          <item.icon className="h-4 w-4 mr-2" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      {!collapsed && (
        <SidebarFooter className="p-4 border-t border-sidebar-border bg-white">
          <div className="space-y-2">
            <div className="flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
              <span>Storage</span>
              <span>{Math.round(storagePercent)}%</span>
            </div>
            <Progress value={storagePercent} className="h-1.5" />
            <p className="text-[10px] text-muted-foreground text-center">
              {formatFileSize(used)} of {formatFileSize(limit)} used
            </p>
          </div>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
