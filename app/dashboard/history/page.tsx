import { getSessionUser } from "@/lib/auth-help";
import { db } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import { redirect } from "next/navigation";
import { Upload, Trash2, Share2, RefreshCcw, Activity } from "lucide-react";

type ActivityMeta = {
  fileName?: string;
};

function getActivityView(action: string) {
  switch (action) {
    case "FILE_ADDED":
      return {
        label: "Added a new file",
        icon: Upload,
        badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
      };
    case "FILE_UPDATED":
      return {
        label: "Updated an existing file",
        icon: RefreshCcw,
        badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
      };
    case "FILE_DELETED":
      return {
        label: "Deleted a file",
        icon: Trash2,
        badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
      };
    case "FILE_SHARED":
      return {
        label: "Shared a file",
        icon: Share2,
        badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
      };
    default:
      return {
        label: action.replaceAll("_", " ").toLowerCase(),
        icon: Activity,
        badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
      };
  }
}

export default async function HistoryPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const activities = await db.activityLog.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div className="px-2">
        <h1 className="text-2xl font-bold tracking-tight text-[#0f172a]">Activity Feed</h1>
        <p className="text-sm text-slate-500 mt-1">
          All your work: uploads, deletes, and share actions
        </p>
      </div>

      {activities.length === 0 ? (
        <div className="text-center py-24 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
          <p className="text-slate-900 font-semibold">No activity yet</p>
          <p className="text-sm text-slate-500">Start uploading, deleting, or sharing files to see logs here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((entry) => {
            const view = getActivityView(entry.action);
            const meta = (entry.metadata || {}) as ActivityMeta;
            const Icon = view.icon;

            return (
              <div
                key={entry.id}
                className="flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-100 shadow-sm"
              >
                <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700">
                  <Icon className="h-4 w-4" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{view.label}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {meta.fileName || "Unknown file"} • {formatDateTime(entry.createdAt)}
                  </p>
                </div>

                <span
                  className={`text-[11px] font-semibold border px-2.5 py-1 rounded-full ${view.badgeClass}`}
                >
                  {entry.action}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
