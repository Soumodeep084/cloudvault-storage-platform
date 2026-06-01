"use client";

import { useMemo, useState } from "react";
import {
  Upload,
  Trash2,
  Share2,
  Activity,
  Download,
  Search,
  Filter,
  Calendar,
  Link2,
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { Input } from "@/components/ui/input";

const PAGE_SIZE = 10;

type ActivityMeta = {
  fileName?: string;
  folderName?: string;
  fileCount?: number;
  folderCount?: number;
  message?: string;
  kind?: string;
  badge?: string;
};

type ActivityFileRef = {
  id: string;
  fileName: string;
  folderId: string | null;
};

type ActivityFolderRef = {
  id: string;
  name: string;
};

type ActivityEntry = {
  id: string;
  action: string;
  metadata: unknown;
  createdAt: string | Date;
  file?: ActivityFileRef | null;
  folder?: ActivityFolderRef | null;
};

function getActivityLabel(
  action: string,
  meta?: ActivityMeta,
  file?: ActivityFileRef | null,
  folder?: ActivityFolderRef | null,
) {
  if (meta?.message) return meta.message;

  const isFolderActivity = Boolean(folder || meta?.kind?.includes("folder") || meta?.folderName && !meta?.fileName);
  const noun = isFolderActivity ? "Folder" : "File";

  switch (action) {
    case "SHARE":
      return `Shared a ${noun}`;
    case "SHARE_DOWNLOAD":
      return `Reciever Downloaded a shared ${noun}`;
    case "DOWNLOAD":
      return `Downloaded a ${noun}`;
    default:
      return action.replaceAll("_", " ").toLowerCase();
  }
}

function getActivityName(
  meta?: ActivityMeta,
  file?: ActivityFileRef | null,
  folder?: ActivityFolderRef | null,
) {
  return folder?.name || meta?.folderName || file?.fileName || meta?.fileName || "Unknown item";
}

function getActivityView(
  action: string,
  meta?: ActivityMeta,
  file?: ActivityFileRef | null,
  folder?: ActivityFolderRef | null,
) {
  if (action === "UPLOAD" && meta?.message) {
    return {
      label: meta.message,
      icon: Upload,
      badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
      iconWrapClass: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200",
    };
  }

  switch (action) {
    case "UPLOAD":
      return {
        label: meta?.message || "Added a new file",
        icon: Upload,
        badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
        iconWrapClass:
          "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200",
      };
    case "DELETE":
      return {
        label: meta?.message || "Deleted a file",
        icon: Trash2,
        badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
        iconWrapClass: "bg-rose-100 text-rose-700 ring-1 ring-rose-200",
        badgeLabel: meta?.badge,
      };
    case "SHARE":
      return {
        label: getActivityLabel(action, meta, file, folder),
        icon: Share2,
        badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
        iconWrapClass: "bg-amber-100 text-amber-700 ring-1 ring-amber-200",
      };
    case "SHARE_DOWNLOAD":
      return {
        label: getActivityLabel(action, meta, file, folder),
        icon: Link2,
        badgeClass: "bg-violet-50 text-violet-700 border-violet-200",
        iconWrapClass: "bg-violet-100 text-violet-700 ring-1 ring-violet-200",
      };
    case "DOWNLOAD":
      return {
        label: getActivityLabel(action, meta, file, folder),
        icon: Download,
        badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200",
        iconWrapClass: "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200",
      };
    default:
      return {
        label: action.replaceAll("_", " ").toLowerCase(),
        icon: Activity,
        badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
        iconWrapClass: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
      };
  }
}

const actionFilters = [
  { value: "all", label: "All activity" },
  { value: "share", label: "Shared" },
  { value: "download", label: "Downloaded" },
  { value: "share_download", label: "Share downloads" },
  { value: "upload", label: "Uploads" },
  { value: "delete", label: "Deletes" },
];

function matchesActionFilter(action: string, filter: string) {
  switch (filter) {
    case "share":
      return action === "SHARE";
    case "download":
      return action === "DOWNLOAD";
    case "share_download":
      return action === "SHARE_DOWNLOAD";
    case "upload":
      return action === "UPLOAD";
    case "delete":
      return action === "DELETE";
    default:
      return true;
  }
}

export default function HistoryClient({
  initialActivities,
}: {
  initialActivities: ActivityEntry[];
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);

  const filteredActivities = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const fromTime = fromDate ? new Date(fromDate).getTime() : null;
    const toTime = toDate ? new Date(toDate).getTime() : null;

    return initialActivities.filter((entry) => {
      if (!matchesActionFilter(entry.action, filter)) return false;

      const meta = (entry.metadata || {}) as ActivityMeta;
      const searchText = [
        meta.fileName,
        meta.folderName,
        meta.message,
        meta.kind,
        entry.file?.fileName,
        entry.folder?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (normalizedQuery && !searchText.includes(normalizedQuery))
        return false;

      const createdAt = new Date(entry.createdAt).getTime();
      if (fromTime && createdAt < fromTime) return false;
      if (toTime && createdAt > toTime) return false;

      return true;
    });
  }, [initialActivities, query, filter, fromDate, toDate]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredActivities.length / PAGE_SIZE),
  );
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const paginatedActivities = filteredActivities.slice(
    startIndex,
    startIndex + PAGE_SIZE,
  );

  const handlePageChange = (nextPage: number) => {
    setPage(Math.min(Math.max(nextPage, 1), totalPages));
  };

  const handleFilterChange = (value: string) => {
    setFilter(value);
    setPage(1);
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setPage(1);
  };

  const handleDateChange = (value: string, setter: (val: string) => void) => {
    setter(value);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="px-2">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0f172a]">
          Activity Feed
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          All your work: uploads, deletes, and share actions
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(event) => handleQueryChange(event.target.value)}
            placeholder="Search by file name"
            className="h-10 pl-9"
          />
        </div>

        <div className="flex h-10 items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm text-slate-600">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={filter}
            onChange={(event) => handleFilterChange(event.target.value)}
            className="w-full bg-transparent outline-none"
          >
            {actionFilters.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex h-10 items-center gap-2 rounded-lg border border-input bg-background px-3">
          <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
          <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
            From
          </span>
          <Input
            type="datetime-local"
            value={fromDate}
            onChange={(event) =>
              handleDateChange(event.target.value, setFromDate)
            }
            className="h-full border-0 p-0 shadow-none focus-visible:ring-0"
          />
        </div>

        <div className="flex h-10 items-center gap-2 rounded-lg border border-input bg-background px-3">
          <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
          <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
            To
          </span>
          <Input
            type="datetime-local"
            value={toDate}
            onChange={(event) =>
              handleDateChange(event.target.value, setToDate)
            }
            className="h-full border-0 p-0 shadow-none focus-visible:ring-0"
          />
        </div>
      </div>

      {filteredActivities.length === 0 ? (
        <div className="text-center py-24 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
          <p className="text-slate-900 font-semibold">No activity found</p>
          <p className="text-sm text-slate-500">
            Try a different search or filter.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {paginatedActivities.map((entry) => {
            const meta = (entry.metadata || {}) as ActivityMeta;
            const view = getActivityView(entry.action, meta, entry.file, entry.folder);
            const Icon = view.icon;
            const itemName = getActivityName(meta, entry.file, entry.folder);

            return (
              <div
                key={entry.id}
                className="flex flex-col gap-3 p-3 sm:p-4 bg-white rounded-xl border border-slate-100 shadow-sm sm:flex-row sm:items-center"
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div
                    className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center ${view.iconWrapClass}`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 leading-5">
                      {view.label}
                    </p>
                    {meta.message ? (
                      <p className="text-xs text-slate-500 wrap-break-word">
                        {formatDateTime(entry.createdAt)}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500 wrap-break-word">
                        {itemName}{" "}
                        <span className="mx-1 text-slate-300">•</span>{" "}
                        {formatDateTime(entry.createdAt)}
                      </p>
                    )}
                  </div>
                </div>

                <span
                  className={`self-start sm:self-center text-[10px] sm:text-[11px] font-semibold border px-2.5 py-1 rounded-full ${view.badgeClass}`}
                >
                  {view.badgeLabel || entry.action}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
        <span>
          Showing {startIndex + 1}-
          {Math.min(startIndex + PAGE_SIZE, filteredActivities.length)} of{" "}
          {filteredActivities.length}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handlePageChange(safePage - 1)}
            disabled={safePage === 1}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            Prev
          </button>
          <span>
            Page {safePage} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => handlePageChange(safePage + 1)}
            disabled={safePage === totalPages}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
