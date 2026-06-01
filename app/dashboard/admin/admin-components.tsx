import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationEllipsis,
  PaginationPrevious,
} from "@/components/ui/pagination";
// import { Table } from "@/components/ui/table";
// import { cn } from "@/lib/utils";

export function DataCard({
  title,
  badge,
  children,
}: {
  title: string;
  badge: string;
  children: ReactNode;
}) {
  return (
    <Card className="overflow-hidden border-border/70 bg-card/90 shadow-sm backdrop-blur">
      <CardHeader className="border-b border-border/70">
        <div className="flex w-full flex-row items-center justify-between px-3">
          <CardTitle className="font-bold">{title}</CardTitle>
          <Badge variant="secondary" className="rounded-full px-3 py-1">
            {badge}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="">{children}</CardContent>
    </Card>
  );
}

export function StatCard({
  title,
  value,
  helper,
  icon: Icon,
  accent,
}: {
  title: string;
  value: string;
  helper: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}) {
  return (
    <Card className="overflow-hidden border-border/70 bg-card/90 shadow-sm backdrop-blur">
      <CardContent className="flex items-start gap-4 p-4">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${accent}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            {value}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// export function AdminTableWrapper({
//   children,
//   tableClassName,
//   className,
// }: {
//   children: ReactNode;
//   tableClassName?: string;
//   className?: string;
// }) {
//   return (
//     <div
//       className={cn(
//         "overflow-x-auto rounded-2xl border border-border/70 bg-background/70",
//         className,
//       )}
//     >
//       <Table className={cn("min-w-225", tableClassName)}>{children}</Table>
//     </div>
//   );
// }

// export function EmptyState({ message }: { message: string }) {
//   return (
//     <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
//       {message}
//     </div>
//   );
// }

export function Pager({
  current,
  total,
  hrefBuilder,
}: {
  current: number;
  total: number;
  hrefBuilder: (page: number) => string;
}) {
  if (total <= 1) return null;

  const canGoPrev = current > 1;
  const canGoNext = current < total;

  // Windowed pagination: show first, last, and a window around current with ellipses.
  const delta = 2;
  const left = Math.max(1, current - delta);
  const right = Math.min(total, current + delta);
  const pages: Array<number | "ellipsis"> = [];

  if (left > 1) {
    pages.push(1);
    if (left > 2) pages.push("ellipsis");
  }

  for (let p = left; p <= right; p++) pages.push(p);

  if (right < total) {
    if (right < total - 1) pages.push("ellipsis");
    pages.push(total);
  }

  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          {canGoPrev ? (
            <PaginationPrevious href={hrefBuilder(current - 1)} />
          ) : (
            <span className="inline-flex h-9 items-center rounded-md px-3 text-sm text-muted-foreground opacity-50">
              Previous
            </span>
          )}
        </PaginationItem>

        {pages.map((item, idx) => {
          if (item === "ellipsis") {
            return (
              <PaginationItem key={`ell-${idx}`}>
                <PaginationEllipsis />
              </PaginationItem>
            );
          }

          const page = item as number;
          return (
            <PaginationItem key={page}>
              <PaginationLink
                href={hrefBuilder(page)}
                isActive={page === current}
                size="default"
                aria-label={`Go to page ${page}`}
              >
                {page}
              </PaginationLink>
            </PaginationItem>
          );
        })}

        <PaginationItem>
          {canGoNext ? (
            <PaginationNext href={hrefBuilder(current + 1)} />
          ) : (
            <span className="inline-flex h-9 items-center rounded-md px-3 text-sm text-muted-foreground opacity-50">
              Next
            </span>
          )}
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
