"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [cooldownSeconds, setCooldownSeconds] = useState<number | null>(null);
  const cooldownStorageKey = "verifyEmailCooldownExpiresAt";

  const startCooldown = (seconds: number) => {
    const safeSeconds = Math.max(0, Math.floor(seconds));
    setCooldownSeconds(safeSeconds);
    if (typeof window !== "undefined" && safeSeconds > 0) {
      const expiresAt = Date.now() + safeSeconds * 1000;
      window.sessionStorage.setItem(cooldownStorageKey, String(expiresAt));
    }
  };

  useEffect(() => {
    if (!canResend || status === "success") return;
    if (typeof window === "undefined") return;

    const storedSeconds = window.sessionStorage.getItem("verifyEmailCooldownSeconds");
    const storedExpiresAt = window.sessionStorage.getItem(cooldownStorageKey);

    if (storedExpiresAt) {
      const expiresAt = Number(storedExpiresAt);
      if (Number.isFinite(expiresAt)) {
        const remaining = Math.ceil((expiresAt - Date.now()) / 1000);
        if (remaining > 0) {
          setCooldownSeconds(remaining);
          return;
        }
      }
      window.sessionStorage.removeItem(cooldownStorageKey);
    }

    if (storedSeconds) {
      window.sessionStorage.removeItem("verifyEmailCooldownSeconds");
      const initialCooldown = Number(storedSeconds);
      if (Number.isFinite(initialCooldown) && initialCooldown > 0) {
        startCooldown(initialCooldown);
      }
    }
  }, [canResend, status]);

  useEffect(() => {
    if (!cooldownSeconds || cooldownSeconds <= 0) return;

    const intervalId = window.setInterval(() => {
      const storedExpiresAt = window.sessionStorage.getItem(cooldownStorageKey);
      if (storedExpiresAt) {
        const expiresAt = Number(storedExpiresAt);
        if (Number.isFinite(expiresAt)) {
          const remaining = Math.ceil((expiresAt - Date.now()) / 1000);
          if (remaining > 0) {
            setCooldownSeconds(remaining);
            return;
          }
        }
        window.sessionStorage.removeItem(cooldownStorageKey);
      }

      setCooldownSeconds(0);
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [cooldownSeconds]);

  const formattedCooldown = useMemo(() => {
    if (!cooldownSeconds || cooldownSeconds <= 0) return null;
    const minutes = Math.floor(cooldownSeconds / 60);
    const seconds = cooldownSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }, [cooldownSeconds]);

  const handleResend = async () => {
    setLoading(true);
    try {
      const result = await resendVerificationEmailAction();
      if (result.success) {
        toast.success("Verification email sent");
        const nextCooldown = result.data?.retryAfterSeconds ?? null;
        if (nextCooldown && nextCooldown > 0) {
          startCooldown(nextCooldown);
        }
      } else if (result.status === 429) {
        toast.message("Please wait before requesting another email.");
        const retryAfter = result.data?.retryAfterSeconds ?? null;
        if (retryAfter && retryAfter > 0) {
          startCooldown(retryAfter);
        }
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
            <Button
              onClick={handleResend}
              className="w-full"
              disabled={loading || Boolean(cooldownSeconds && cooldownSeconds > 0)}
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Resend verification email"}
            </Button>
          ) : (
            <Button asChild className="w-full">
              <Link href="/login">Sign in to resend</Link>
            </Button>
          )}

          {canResend && formattedCooldown ? (
            <p className="text-center text-sm text-muted-foreground">
              You can request another email in {formattedCooldown}.
            </p>
          ) : null}

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
