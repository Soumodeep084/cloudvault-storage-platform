import { getSessionUser } from "@/lib/auth-help";
import { formatFileSize } from "@/lib/utils";
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
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { User } from "@/types";

export default async function SettingsPage() {
  const user = (await getSessionUser()) as unknown as User;
  const storagePercent = user
    ? (user.storageUsed / user.storageLimit) * 100
    : 0;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="px-2">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-slate-500">
          Manage your vault and security preferences
        </p>
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg">Profile</CardTitle>
          <CardDescription>Your identity within CloudVault</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-slate-600">Full Name</Label>
            <Input
              defaultValue={user?.name}
              className="focus-visible:ring-primary"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-600">Email Address</Label>
            <Input
              defaultValue={user?.email}
              disabled
              className="bg-slate-50 text-slate-500 cursor-not-allowed"
            />
          </div>
          <Button className="font-semibold">Save changes</Button>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg">Storage Usage</CardTitle>
          <CardDescription>
            Plan: {user?.role === "admin" ? "Pro Administrator" : "Free Tier"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between text-xs font-semibold uppercase tracking-wider text-slate-400">
            <span>{formatFileSize(user?.storageUsed || 0)} consumed</span>
            <span>{formatFileSize(user?.storageLimit || 0)} limit</span>
          </div>
          <Progress value={storagePercent} className="h-2 bg-slate-100" />
          <Button variant="outline" className="w-full sm:w-auto font-semibold">
            Upgrade Storage
          </Button>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg">Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="font-semibold text-sm text-slate-800">
                Email Notifications
              </p>
              <p className="text-xs text-slate-500">
                Get alerts for file shares and logins
              </p>
            </div>
            <Switch defaultChecked />
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
            <Switch />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
