import type {
  AdminSearchParams,
  AdminSearchParamsInput,
  AdminTab,
} from "./admin-types";

export const ADMIN_PAGE_SIZE = 10;

export function getParam(
  searchParams: AdminSearchParamsInput,
  key: string,
  fallback = "",
) {
  const value = searchParams[key];
  if (Array.isArray(value)) return value[0] ?? fallback;
  return value ?? fallback;
}

export function parsePositiveInt(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export function getPageOffset(page: number) {
  return Math.max(0, (page - 1) * ADMIN_PAGE_SIZE);
}

export function getPageCount(total: number) {
  return Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
}

export function isAdminTab(value: string): value is AdminTab {
  return (
    value === "users" ||
    value === "deletions" ||
    value === "deleted" ||
    value === "logs" ||
    value === "storage"
  );
}

export function normalizeAdminSearchParams(
  searchParams: AdminSearchParamsInput,
): AdminSearchParams {
  const tabValue = getParam(searchParams, "tab", "users");
  const tab = isAdminTab(tabValue) ? tabValue : "users";

  return {
    tab,
    userPage: parsePositiveInt(getParam(searchParams, "userPage", "1"), 1),
    scheduledPage: parsePositiveInt(getParam(searchParams, "scheduledPage", "1"), 1),
    archivedPage: parsePositiveInt(getParam(searchParams, "archivedPage", "1"), 1),
    permanentPage: parsePositiveInt(getParam(searchParams, "permanentPage", "1"), 1),
    logsPage: parsePositiveInt(getParam(searchParams, "logsPage", "1"), 1),
  };
}

export function buildAdminHref(
  searchParams: AdminSearchParamsInput,
  updates: Record<string, string | number>,
) {
  const params = new URLSearchParams();

  Object.entries(searchParams).forEach(([key, value]) => {
    if (typeof value === "string") params.set(key, value);
  });

  Object.entries(updates).forEach(([key, value]) => {
    params.set(key, String(value));
  });

  return `/dashboard/admin?${params.toString()}`;
}

export function formatDateSafe(value: Date | null | undefined) {
  return value ? value.toLocaleDateString() : "-";
}

export function formatFieldLabel(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatLogAction(action: string) {
  return formatFieldLabel(action.replace(/^ADMIN_/, "").replace(/_USER$/, ""));
}

export function getLogActionTone(action: string) {
  if (action.includes("DELETE")) return "destructive" as const;
  if (action.includes("RESTORE")) return "secondary" as const;
  if (action.includes("CLEANUP")) return "outline" as const;
  return "default" as const;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function formatReadableValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (value instanceof Date) return value.toLocaleString();
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => formatReadableValue(item)).join(", ");
  }

  if (isRecord(value)) {
    const entries = Object.entries(value).map(([key, nestedValue]) => {
      return `${formatFieldLabel(key)}: ${formatReadableValue(nestedValue)}`;
    });
    return entries.length > 0 ? entries.join(" · ") : "Empty object";
  }

  return String(value);
}

export function getLogMetadataValue(metadata: unknown, key: string) {
  if (!isRecord(metadata)) return "-";
  return formatReadableValue(metadata[key]);
}

export function getLogMetadataBytes(metadata: unknown, key: string) {
  if (!isRecord(metadata)) return 0;
  const value = metadata[key];
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  return 0;
}
