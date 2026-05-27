"use client";

import { useState } from "react";
import { Copy, Check, Link2, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  shareLink?: string;
  expiresAt?: string | Date | null;
  itemLabel?: "file" | "folder";
  onCreateSecureLink: (options: {
    password: string;
    expiresInMinutes: number | null;
  }) => Promise<void>;
  isCreating?: boolean;
}

export function ShareModal({
  open,
  onOpenChange,
  fileName,
  shareLink,
  expiresAt,
  itemLabel = "file",
  onCreateSecureLink,
  isCreating = false,
}: ShareModalProps) {
  const safeName = fileName.trim() ? fileName : `Untitled ${itemLabel}`;
  const [copied, setCopied] = useState(false);
  const [password, setPassword] = useState("");
  const [expiryPreset, setExpiryPreset] = useState("10");
  const [customValue, setCustomValue] = useState("10");
  const [customUnit, setCustomUnit] = useState<"sec" | "min" | "hr">("min");
  const [expiryError, setExpiryError] = useState<string | null>(null);
  const [previewLabel, setPreviewLabel] = useState<string | null>(null);

  const link = shareLink || "";

  const handleCopy = async () => {
    if (!link) return;

    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy!", err);
    }
  };

  const getExpiresInMinutes = (overrides?: {
    preset?: string;
    customValue?: string;
    customUnit?: "sec" | "min" | "hr";
  }) => {
    const preset = overrides?.preset ?? expiryPreset;
    const value = overrides?.customValue ?? customValue;
    const unit = overrides?.customUnit ?? customUnit;

    if (preset === "lifetime") return { minutes: null, error: null };

    if (preset !== "custom") {
      const presetMinutes = Number(preset);
      if (!Number.isFinite(presetMinutes) || presetMinutes <= 0) {
        return { minutes: null, error: "Choose a valid expiry" };
      }
      return { minutes: presetMinutes, error: null };
    }

    const rawValue = Number(value);
    if (!Number.isFinite(rawValue) || rawValue <= 0) {
      return { minutes: null, error: "Enter a positive number" };
    }

    const minutes = unit === "sec" ? rawValue / 60 : unit === "hr" ? rawValue * 60 : rawValue;
    if (minutes > 10080) {
      return { minutes: null, error: "Maximum expiry is 7 days" };
    }

    return { minutes, error: null };
  };

  const updateExpiryPreview = (overrides?: {
    preset?: string;
    customValue?: string;
    customUnit?: "sec" | "min" | "hr";
  }) => {
    const { minutes } = getExpiresInMinutes(overrides);
    if (minutes === null) {
      setPreviewLabel("Expiry: Lifetime");
      return;
    }
    if (minutes <= 0) {
      setPreviewLabel(null);
      return;
    }

    const expiresAt = new Date(Date.now() + minutes * 60 * 1000);
    setPreviewLabel(
      `Expiry: ${expiresAt.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })}`,
    );
  };

  const getExpiryPreview = () => previewLabel;

  const getExistingExpiryLabel = () => {
    if (expiresAt === undefined) return null;
    if (expiresAt === null) return "Expiry: Lifetime";

    const date = new Date(expiresAt);
    return `Expiry: ${date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })}`;
  };

  const handleCreate = async () => {
    const { minutes, error } = getExpiresInMinutes();
    if (error) {
      setExpiryError(error);
      return;
    }

    setExpiryError(null);
    await onCreateSecureLink({
      password,
      expiresInMinutes: minutes,
    });
  };

  const isValidPassword = password.trim().length >= 6;

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      updateExpiryPreview();
    } else {
      setCopied(false);
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <DialogHeader>
          <div className="border-b bg-linear-to-b from-slate-50 to-white px-5 py-4">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Link2 className="h-5 w-5 text-primary" /> Secure Share
            </DialogTitle>
            <DialogDescription className="pt-2 text-sm">
              Share this {itemLabel} <span className="font-semibold text-foreground">&quot;{safeName}&quot;</span> with password and expiry control.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="px-5 py-5 space-y-4">
          {!shareLink ? (
            <>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Password (required)
                </label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="h-10"
                  disabled={isCreating}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Link expiry
                </label>
                <div className="space-y-2">
                  <select
                    value={expiryPreset}
                    onChange={(e) => {
                      const nextPreset = e.target.value;
                      setExpiryPreset(nextPreset);
                      setExpiryError(null);
                      updateExpiryPreview({ preset: nextPreset });
                    }}
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
                    disabled={isCreating}
                  >
                    <option value="5">5 minutes</option>
                    <option value="10">10 minutes</option>
                    <option value="20">20 minutes</option>
                    <option value="1440">24 hours</option>
                    <option value="10080">7 days</option>
                    <option value="lifetime">Lifetime</option>
                    <option value="custom">Custom Duration</option>
                  </select>

                  {expiryPreset === "custom" && (
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min={1}
                        value={customValue}
                        onChange={(e) => {
                          const nextValue = e.target.value;
                          setCustomValue(nextValue);
                          setExpiryError(null);
                          updateExpiryPreview({ customValue: nextValue });
                        }}
                        className="h-10"
                        disabled={isCreating}
                      />
                      <select
                        value={customUnit}
                        onChange={(e) => {
                          const nextUnit = e.target.value as "sec" | "min" | "hr";
                          setCustomUnit(nextUnit);
                          setExpiryError(null);
                          updateExpiryPreview({ customUnit: nextUnit });
                        }}
                        className="h-10 w-28 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
                        disabled={isCreating}
                      >
                        <option value="sec">sec</option>
                        <option value="min">min</option>
                        <option value="hr">hr</option>
                      </select>
                    </div>
                  )}

                  {expiryError && (
                    <p className="text-xs text-rose-600">{expiryError}</p>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="flex items-start gap-2 text-xs text-amber-800">
                  <LockKeyhole className="h-4 w-4 shrink-0 mt-0.5" />
                  Receiver must enter this password before preview or download.
                </p>
              </div>

              <Button
                onClick={handleCreate}
                disabled={isCreating || !isValidPassword}
                className="w-full h-10"
              >
                {isCreating ? "Creating secure link..." : "Create secure link"}
              </Button>
            </>
          ) : (
            <>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                Secure share link is ready. Receiver must use your password to access the {itemLabel}.
              </div>

              <div className="flex items-center gap-2">
                <div className="grid flex-1 gap-2">
                  <Input
                    value={link}
                    readOnly
                    className="font-mono text-xs bg-muted/50 border-0 h-9"
                  />
                  {(getExistingExpiryLabel() || getExpiryPreview()) && (
                    <p className="text-[11px] text-muted-foreground">
                      {getExistingExpiryLabel() || getExpiryPreview()}
                    </p>
                  )}
                </div>
                <Button onClick={handleCopy} size="sm" className="px-3">
                  <span className="sr-only">Copy</span>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </>
          )}
        </div>

        <div className="border-t bg-slate-50 px-5 py-3">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Share password separately using a trusted channel.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
