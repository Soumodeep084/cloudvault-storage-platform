"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Cloud, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { resetPasswordAction } from "@/app/actions/userActions";

export default function ResetPasswordClient() {
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token")?.trim() ?? "", [searchParams]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      toast.error("Reset token is missing.");
      return;
    }

    setLoading(true);

    try {
      const result = await resetPasswordAction({ token, password, confirmPassword });
      if (result.success) {
        toast.success("Password updated. You can sign in now.");
        if (typeof window !== "undefined") {
          window.location.replace("/login");
        }
      } else if (result.errors) {
        const firstError = Object.values(result.errors)[0]?.[0];
        toast.error(firstError || result.message || "Failed to reset password.");
      } else {
        toast.error(result.message || "Failed to reset password.");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md shadow-xl border-border/50">
        <CardHeader className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Cloud className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold">CloudVault</span>
          </div>
          <CardTitle className="text-xl">Reset your password</CardTitle>
          <CardDescription>Enter a new password for your account.</CardDescription>
        </CardHeader>
        <CardContent>
          {token ? (
            <form onSubmit={handleSubmit} className="space-y-4 p-4">
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Update password"}
              </Button>
            </form>
          ) : (
            <div className="space-y-3 p-4 text-sm text-muted-foreground">
              <p>The reset link is missing or invalid.</p>
              <Link href="/forgot-password" className="text-primary hover:underline font-medium">
                Request a new reset link
              </Link>
            </div>
          )}
          <p className="text-center text-sm text-muted-foreground mt-4">
            Back to{" "}
            <Link href="/login" className="text-primary hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}