import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLoadingPage() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, idx) => (
          <Card key={idx}>
            <CardHeader><Skeleton className="h-4 w-24" /></CardHeader>
            <CardContent><Skeleton className="h-7 w-20" /></CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="space-y-3 p-6">
          {Array.from({ length: 8 }).map((_, idx) => (
            <Skeleton key={idx} className="h-8 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

