"use client";

import { useState, useTransition } from "react";
import { ShieldCheck, ShieldAlert, Crown, Mail, User } from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatFileSize } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
// import { Switch } from "@/components/ui/switch";
// import { Separator } from "@/components/ui/separator";
import { updateProfileAction } from "@/app/actions/userActions";

const STORAGE_LIMIT = 50 * 1024 * 1024;

type SettingsUser = {
  id: string;
  name: string | null;
  email: string;
  role: "ADMIN" | "USER" | string;
  isVerified: boolean;
  storageUsed: bigint | number;
  createdAt: Date;
};

export default function SettingsClient({ user }: { user: SettingsUser }) {
  const [name, setName] = useState(user.name ?? "");
  // const [emailNotifications, setEmailNotifications] = useState(user.emailNotifications);
  // const [twoFactorEnabled, setTwoFactorEnabled] = useState(user.twoFactorEnabled);
  const [isSavingProfile, startProfileTransition] = useTransition();
  // const [isSavingPrefs, startPrefsTransition] = useTransition();

  const storageUsed = Number(user.storageUsed || 0);
  const storagePercent = STORAGE_LIMIT ? (storageUsed / STORAGE_LIMIT) * 100 : 0;
  const isProfessional = user.role === "ADMIN";

  const handleProfileSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData();
    formData.append("name", name);

    startProfileTransition(async () => {
      const result = await updateProfileAction(formData);
      if (!result.success) {
        toast.error(result.message || "Failed to update profile");
        return;
      }
      toast.success("Profile updated");
    });
  };

  // const handlePreferencesSubmit = (event: React.FormEvent<HTMLFormElement>) => {
  //   event.preventDefault();
  //   const formData = new FormData();
  //   if (emailNotifications) formData.append("emailNotifications", "on");
  //   if (twoFactorEnabled) formData.append("twoFactorEnabled", "on");
  //
  //   startPrefsTransition(async () => {
  //     const result = await updatePreferencesAction(formData);
  //     if (!result.success) {
  //       toast.error(result.message || "Failed to update preferences");
  //       return;
  //     }
  //     toast.success("Preferences updated");
  //   });
  // };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="px-2">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-slate-500">
          Manage your vault and security preferences
        </p>
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg">Account Overview</CardTitle>
          <CardDescription>Quick snapshot of your CloudVault profile</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
              <User className="h-4 w-4" /> Member
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-900">{user.name || "Unnamed user"}</p>
            <p className="text-xs text-slate-500">Joined {formatDate(user.createdAt)}</p>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
              <Mail className="h-4 w-4" /> Email
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-900 break-all">{user.email}</p>
            <span
              className={`mt-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                user.isVerified
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-rose-200 bg-rose-50 text-rose-700"
              }`}
            >
              {user.isVerified ? <ShieldCheck className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
              {user.isVerified ? "Email verified" : "Email unverified"}
            </span>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
              <Crown className="h-4 w-4" /> Plan
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {isProfessional ? "Professional" : "Free"}
            </p>
            <p className="text-xs text-slate-500">Role: {user.role.toLowerCase()}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg">Profile</CardTitle>
          <CardDescription>Your identity within CloudVault</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleProfileSubmit}>
            <div className="space-y-2">
              <Label className="text-slate-600">Full Name</Label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="focus-visible:ring-primary"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-600">Email Address</Label>
              <Input
                value={user.email}
                disabled
                className="bg-slate-50 text-slate-500 cursor-not-allowed"
              />
            </div>
            <Button type="submit" className="font-semibold" disabled={isSavingProfile}>
              {isSavingProfile ? "Saving..." : "Save changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg">Storage Usage</CardTitle>
          <CardDescription>
            Plan: {isProfessional ? "Professional" : "Free Tier"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between text-xs font-semibold uppercase tracking-wider text-slate-400">
            <span>{formatFileSize(storageUsed)} consumed</span>
            <span>{formatFileSize(STORAGE_LIMIT)} limit</span>
          </div>
          <Progress value={storagePercent} className="h-2 bg-slate-100" />
          <Button variant="outline" className="w-full sm:w-auto font-semibold">
            Upgrade Storage
          </Button>
        </CardContent>
      </Card>

      {/*
      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg">Preferences</CardTitle>
          <CardDescription>Control your notifications and login security</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handlePreferencesSubmit}>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="font-semibold text-sm text-slate-800">
                  Email Notifications
                </p>
                <p className="text-xs text-slate-500">
                  Get alerts for file shares and logins
                </p>
              </div>
              <Switch
                checked={emailNotifications}
                onCheckedChange={setEmailNotifications}
              />
            </div>
            <Separator className="bg-slate-100" />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="font-semibold text-sm text-slate-800">
                  Two-Factor Auth
                </p>
                <p className="text-xs text-slate-500">
                  Add extra security to your account
                </p>
              </div>
              <Switch
                checked={twoFactorEnabled}
                onCheckedChange={setTwoFactorEnabled}
              />
            </div>
            <Button type="submit" variant="outline" className="w-full sm:w-auto" disabled={isSavingPrefs}>
              {isSavingPrefs ? "Saving..." : "Save preferences"}
            </Button>
          </form>
        </CardContent>
      </Card>
      */}
    </div>
  );
}
