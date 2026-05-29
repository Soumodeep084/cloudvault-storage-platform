"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { EllipsisVertical, FileX, Trash2, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  permanentDeleteUserByAdminAction,
  restoreUserByAdminAction,
  softDeleteUserByAdminAction,
} from "@/app/actions/adminActions";

export function AdminUserActions({
  userId,
  isDeleted,
  userEmail,
}: {
  userId: string;
  isDeleted: boolean;
  userEmail: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<
    null | "restore" | "soft-delete" | "permanent-delete"
  >(null);

  const run = (type: "restore" | "soft-delete" | "permanent-delete") => {
    startTransition(async () => {
      const action =
        type === "restore"
          ? restoreUserByAdminAction
          : type === "soft-delete"
            ? softDeleteUserByAdminAction
            : permanentDeleteUserByAdminAction;

      const result = await action(userId);
      if (!result.success) {
        toast.error(result.error || "Action failed");
        return;
      }

      toast.success("Action completed");
      setConfirm(null);
      router.refresh();
    });
  };

  return (
    <div className="flex items-center justify-end gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={pending}
            aria-label="Open admin actions"
            className="h-9 w-9 border-border/70 bg-background/80 hover:bg-muted"
          >
            <EllipsisVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {isDeleted ? (
            <>
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  setConfirm("restore");
                }}
              >
                <RotateCw className="w-4 h-4" />
                Restore account
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={(event) => {
                  event.preventDefault();
                  setConfirm("permanent-delete");
                }}
              >
                <Trash2 className="w-4 h-4" />
                Permanent delete
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <DropdownMenuItem
                variant="destructive"
                onSelect={(event) => {
                  event.preventDefault();
                  setConfirm("soft-delete");
                }}
              >
                <FileX className="w-4 h-4" />
                Soft delete account
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={(event) => {
                  event.preventDefault();
                  setConfirm("permanent-delete");
                }}
              >
                <Trash2 className="w-4 h-4" />
                Permanent delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm action</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "restore" && `Restore ${userEmail} user account?`}
              {confirm === "soft-delete" &&
                `Soft delete ${userEmail} user account?`}
              {confirm === "permanent-delete" &&
                `Permanently delete ${userEmail} user account? This cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirm && run(confirm)}
              disabled={pending}
            >
              {pending ? "Processing..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
