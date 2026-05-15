"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import {
  requestAccountRestoreOtpAction,
  restoreAccountAction,
  verifyAccountRestoreOtpAction,
} from "@/app/actions/accountRestoreActions";

const COOLDOWN_STORAGE_KEY = "restoreOtpCooldownExpiresAt";

export default function RestoreAccountClient() {
  const [email, setEmail] = useState("");
  const [emailLocked, setEmailLocked] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);
  const [password, setPassword] = useState("");
  const [cooldownSeconds, setCooldownSeconds] = useState<number | null>(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restored, setRestored] = useState(false);

  const startCooldown = (seconds: number) => {
    const safeSeconds = Math.max(0, Math.floor(seconds));
    setCooldownSeconds(safeSeconds);
    if (typeof window !== "undefined" && safeSeconds > 0) {
      const expiresAt = Date.now() + safeSeconds * 1000;
      window.sessionStorage.setItem(COOLDOWN_STORAGE_KEY, String(expiresAt));
    }
  };

  useEffect(() => {
    if (!emailLocked || typeof window === "undefined") return;
    const storedExpiresAt = window.sessionStorage.getItem(COOLDOWN_STORAGE_KEY);
    if (!storedExpiresAt) return;

    const expiresAt = Number(storedExpiresAt);
    if (Number.isFinite(expiresAt)) {
      const remaining = Math.ceil((expiresAt - Date.now()) / 1000);
      if (remaining > 0) {
        setCooldownSeconds(remaining);
      } else {
        window.sessionStorage.removeItem(COOLDOWN_STORAGE_KEY);
      }
    }
  }, [emailLocked]);

  useEffect(() => {
    if (!cooldownSeconds || cooldownSeconds <= 0) return;

    const intervalId = window.setInterval(() => {
      const storedExpiresAt = window.sessionStorage.getItem(COOLDOWN_STORAGE_KEY);
      if (storedExpiresAt) {
        const expiresAt = Number(storedExpiresAt);
        if (Number.isFinite(expiresAt)) {
          const remaining = Math.ceil((expiresAt - Date.now()) / 1000);
          if (remaining > 0) {
            setCooldownSeconds(remaining);
            return;
          }
        }
        window.sessionStorage.removeItem(COOLDOWN_STORAGE_KEY);
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

  const handleSendOtp = async () => {
    if (!email.trim()) {
      toast.error("Enter your registered email");
      return;
    }

    setIsSendingOtp(true);
    try {
      const result = await requestAccountRestoreOtpAction(email);
      if (result.success) {
        setEmailLocked(true);
        toast.success("Verification code sent");
        const retryAfter = result.data?.retryAfterSeconds ?? 0;
        if (retryAfter > 0) startCooldown(retryAfter);
      } else if (result.status === 429) {
        toast.message(result.message || "Please wait before requesting another code.");
        const retryAfter = result.data?.retryAfterSeconds ?? 0;
        if (retryAfter > 0) startCooldown(retryAfter);
      } else {
        toast.error(result.message || "Failed to send code");
      }
    } catch {
      toast.error("Failed to send code. Please try again.");
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim()) {
      toast.error("Enter the 6-digit code");
      return;
    }

    setIsVerifyingOtp(true);
    try {
      const result = await verifyAccountRestoreOtpAction(email, otp);
      if (result.success) {
        setOtpVerified(true);
        setCooldownSeconds(null);
        toast.success("Code verified");
      } else {
        setOtpVerified(false);
        const attemptsLeft = result.data?.remainingAttempts;
        if (typeof attemptsLeft === "number") {
          toast.error(`Invalid code. ${attemptsLeft} attempt(s) left.`);
        } else {
          toast.error(result.message || "Verification failed");
        }
      }
    } catch {
      setOtpVerified(false);
      toast.error("Verification failed. Please try again.");
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleRestore = async () => {
    if (!password.trim()) {
      toast.error("Enter your password to continue");
      return;
    }

    setIsRestoring(true);
    try {
      const result = await restoreAccountAction({
        email,
        otp,
        password,
      });
      if (result.success) {
        setRestored(true);
        toast.success("Account restored. You can sign in again.");
      } else {
        toast.error(result.message || "Failed to restore account");
      }
    } catch {
      toast.error("Failed to restore account. Please try again.");
    } finally {
      setIsRestoring(false);
    }
  };

  const sectionClass = (active: boolean) =>
    `transition-all duration-300 ease-out ${
      active ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none"
    }`;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,oklch(0.97_0.04_215),transparent_60%),radial-gradient(circle_at_bottom,oklch(0.98_0.05_95),transparent_55%)] p-6 flex items-center justify-center">
      <Card className="w-full max-w-xl border-emerald-100/70 shadow-xl">
        <CardHeader className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <ShieldCheck className="h-8 w-8 text-emerald-600" />
            <span className="text-2xl font-semibold text-emerald-700">Restore your account</span>
          </div>
          <CardTitle className="text-xl">Verify ownership to unlock your access</CardTitle>
          <CardDescription>
            This secure restore flow protects your data. Complete each step to regain access.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {restored ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-50">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </div>
              <div>
                <p className="text-lg font-semibold text-emerald-700">Account restored</p>
                <p className="text-sm text-muted-foreground">
                  You can now sign in and resume using CloudVault.
                </p>
              </div>
              <Button asChild className="w-full">
                <Link href="/login">Go to sign in</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <section className={sectionClass(true)}>
                <div className="rounded-2xl border border-emerald-100/60 bg-white/80 p-5 shadow-sm">
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                    <Mail className="h-4 w-4" />
                    Step 1: Confirm your email
                  </div>
                  <div className="mt-4 space-y-2">
                    <Label htmlFor="restore-email">Registered email address</Label>
                    <Input
                      id="restore-email"
                      type="email"
                      placeholder="you@domain.com"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      disabled={emailLocked}
                    />
                  </div>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <Button
                      onClick={handleSendOtp}
                      className="w-full"
                      disabled={isSendingOtp || emailLocked}
                    >
                      {isSendingOtp ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Sending code...
                        </span>
                      ) : (
                        "Send verification code"
                      )}
                    </Button>
                    <Button asChild variant="outline" className="w-full">
                      <Link href="/account-deleted">Back</Link>
                    </Button>
                  </div>
                </div>
              </section>

              <section className={sectionClass(emailLocked)}>
                <div className="rounded-2xl border border-emerald-100/60 bg-white/80 p-5 shadow-sm">
                  <div className="text-sm font-semibold text-emerald-700">
                    Step 2: Verify the one-time code
                  </div>
                  <div className="mt-4 space-y-2">
                    <Label>OTP code</Label>
                    <InputOTP
                      value={otp}
                      onChange={setOtp}
                      maxLength={6}
                      disabled={otpVerified}
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                      </InputOTPGroup>
                      <InputOTPSeparator />
                      <InputOTPGroup>
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <Button
                      onClick={handleVerifyOtp}
                      className="w-full"
                      disabled={isVerifyingOtp || otpVerified}
                    >
                      {isVerifyingOtp ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Verifying...
                        </span>
                      ) : (
                        "Verify code"
                      )}
                    </Button>
                    <Button
                      onClick={handleSendOtp}
                      variant="outline"
                      className="w-full"
                      disabled={isSendingOtp || Boolean(cooldownSeconds && cooldownSeconds > 0)}
                    >
                      {isSendingOtp ? "Sending..." : "Resend code"}
                    </Button>
                  </div>
                  {formattedCooldown ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      You can request another code in {formattedCooldown}.
                    </p>
                  ) : null}
                </div>
              </section>

              <section className={sectionClass(otpVerified)}>
                <div className="rounded-2xl border border-emerald-100/60 bg-white/80 p-5 shadow-sm">
                  <div className="text-sm font-semibold text-emerald-700">
                    Step 3: Confirm your password
                  </div>
                  <div className="mt-4 space-y-2">
                    <Label htmlFor="restore-password">Password</Label>
                    <Input
                      id="restore-password"
                      type="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                  </div>
                  <div className="mt-4">
                    <Button
                      onClick={handleRestore}
                      className="w-full"
                      disabled={isRestoring}
                    >
                      {isRestoring ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Restoring account...
                        </span>
                      ) : (
                        "Restore account"
                      )}
                    </Button>
                  </div>
                </div>
              </section>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
