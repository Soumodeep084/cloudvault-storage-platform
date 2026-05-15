import Link from "next/link";
import { AlertTriangle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cookies } from "next/headers";

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@cloudvault.app";

export default async function AccountDeletedPage() {
  const cookieStore = await cookies();
  const scheduledAtValue = cookieStore.get("account_deletion_scheduled_at")?.value;
  const scheduledAt = scheduledAtValue ? new Date(scheduledAtValue) : null;
  const isValidDate = scheduledAt && !Number.isNaN(scheduledAt.getTime());

  const formattedDate = isValidDate
    ? new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(scheduledAt)
    : "Unavailable";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-lg border-rose-200 shadow-xl">
        <CardHeader className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <AlertTriangle className="h-8 w-8 text-rose-500" />
            <span className="text-2xl font-bold text-rose-600">
              Account Scheduled for Deletion
            </span>
          </div>
          <CardTitle className="text-xl text-slate-900">
            Your CloudVault access is disabled
          </CardTitle>
          <CardDescription>
            This account has been scheduled for deletion. You can still recover it
            before the scheduled date.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-rose-100 bg-rose-50/60 p-4 text-sm text-slate-700">
            <p className="font-semibold text-rose-600">Scheduled deletion</p>
            <p>{formattedDate}</p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-800">Need help?</p>
            <p className="mt-1">
              Contact our support team to recover your account before the
              scheduled date.
            </p>
            <div className="mt-3 flex items-center gap-2 text-slate-600">
              <Mail className="h-4 w-4" />
              <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:underline">
                {SUPPORT_EMAIL}
              </a>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button asChild variant="outline">
              <Link href="/login">Back to sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/">Go to homepage</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
