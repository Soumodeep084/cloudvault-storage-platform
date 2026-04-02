import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/DashboardComponents/AppSidebar";
import { DashboardNavbar } from "@/components/DashboardComponents/DashboardNavbar";
import { getSessionUser } from "@/lib/auth-help";
import { db } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Real check: Get user from cookie/DB
  const user = await getSessionUser();

  // If no user is found, kick them to login
  if (!user) {
    redirect("/login");
  }

  const storage = await db.file.aggregate({
    where: { userId: user.id, isDeleted: false },
    _sum: { fileSize: true },
  });

  const sidebarUser = {
    ...user,
    storageUsed: storage._sum.fileSize ?? 0,
    storageLimit: 50 * 1024 * 1024,
  };

  return (
    <TooltipProvider>
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          {/* Pass the real user data to your Sidebar if needed */}
          <AppSidebar user={sidebarUser} />

          <div className="flex-1 flex flex-col min-w-0">
            <DashboardNavbar user={user} />

            <main className="flex-1 p-6">{children}</main>
          </div>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}