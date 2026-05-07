"use client";

import { useState } from "react";
import Link from "next/link";
import { MailCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { resendVerificationEmailAction } from "@/app/actions/userActions";
import { toast } from "sonner";

const statusCopy: Record<string, { title: string; description: string }> = {
  success: {
    title: "Email verified",
    description: "Your email address is verified. You can continue to your dashboard.",
  },
  expired: {
    title: "Verification link expired",
    description: "The link expired. Request a new verification email below.",
  },
  invalid: {
    title: "Invalid verification link",
    description: "This link is invalid. Request a new verification email below.",
  },
  missing: {
    title: "Missing verification token",
    description: "We could not find a verification token. Request a new email below.",
  },
};

export default function VerifyEmailClient({
  email,
  status,
  canResend,
}: {
  email: string | null;
  status: "success" | "expired" | "invalid" | "missing" | null;
  canResend: boolean;
}) {
  const [loading, setLoading] = useState(false);

  const handleResend = async () => {
    setLoading(true);
    try {
      const result = await resendVerificationEmailAction();
      if (result.success) {
        toast.success("Verification email sent");
      } else if (result.status === 429) {
        toast.message("Please wait before requesting another email.");
      } else {
        toast.error(result.message || "Failed to send verification email");
      }
    } catch (error) {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const copy = status ? statusCopy[status] : null;
  const hasEmail = Boolean(email);
  const description = copy?.description ||
    (hasEmail
      ? `We sent a verification link to ${email}. Open it to activate your account.`
      : "Use the verification link in your email to activate your account.");

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md shadow-xl border-border/50">
        <CardHeader className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-2">
            <MailCheck className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold">Verify Email</span>
          </div>
          <CardTitle className="text-xl">
            {copy?.title || "Check your inbox"}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "success" ? (
            <Button asChild className="w-full">
              <Link href={canResend ? "/dashboard" : "/login"}>
                {canResend ? "Continue to dashboard" : "Continue to sign in"}
              </Link>
            </Button>
          ) : canResend ? (
            <Button onClick={handleResend} className="w-full" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Resend verification email"}
            </Button>
          ) : (
            <Button asChild className="w-full">
              <Link href="/login">Sign in to resend</Link>
            </Button>
          )}

          <p className="text-center text-sm text-muted-foreground">
            Need to use a different email?{" "}
            <Link href="/login" className="text-primary hover:underline font-medium">
              Sign in again
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
