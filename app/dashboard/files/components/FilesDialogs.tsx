"use client";

import type { KeyboardEvent } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { ShareModal } from "@/components/DashboardComponents/ShareModal";
import type { FileItem, FolderItem } from "@/types";

export type FilesDialogsProps = {
  shareFile: FileItem | null;
  isCreatingShare: boolean;
  onShareOpenChange: (open: boolean) => void;
  onCreateSecureShare: (options: { password: string; expiresInMinutes: number | null }) => Promise<void>;

  renameFile: FileItem | null;
  renameValue: string;
  onRenameValueChange: (value: string) => void;
  onRenameFileClose: () => void;
  onRenameFileSubmit: () => void;
  isRenamingFile: boolean;

  createFolderOpen: boolean;
  createFolderName: string;
  onCreateFolderNameChange: (value: string) => void;
  onCreateFolderOpenChange: (open: boolean) => void;
  onCreateFolderSubmit: () => void;
  isCreatingFolder: boolean;

  renameFolder: FolderItem | null;
  renameFolderValue: string;
  onRenameFolderValueChange: (value: string) => void;
  onRenameFolderClose: () => void;
  onRenameFolderSubmit: () => void;
  isRenamingFolder: boolean;

  moveItemLabel: string | null;
  moveTargetId: string;
  onMoveTargetChange: (value: string) => void;
  onMoveClose: () => void;
  onMoveSubmit: () => void;
  isMoving: boolean;
  moveOptions: Array<{ id: string; label: string }>;

  deleteFolder: FolderItem | null;
  onDeleteFolderClose: () => void;
  onDeleteFolderSubmit: () => void;
  isDeletingFolder: boolean;

  deleteFile: FileItem | null;
  onDeleteFileClose: () => void;
  onDeleteFileSubmit: () => void;
  isDeletingFile: boolean;

  renameAlertOpen: boolean;
  renameAlertMessage: string;
  onRenameAlertClose: () => void;
};

export function FilesDialogs({
  shareFile,
  isCreatingShare,
  onShareOpenChange,
  onCreateSecureShare,
  renameFile,
  renameValue,
  onRenameValueChange,
  onRenameFileClose,
  onRenameFileSubmit,
  isRenamingFile,
  createFolderOpen,
  createFolderName,
  onCreateFolderNameChange,
  onCreateFolderOpenChange,
  onCreateFolderSubmit,
  isCreatingFolder,
  renameFolder,
  renameFolderValue,
  onRenameFolderValueChange,
  onRenameFolderClose,
  onRenameFolderSubmit,
  isRenamingFolder,
  moveItemLabel,
  moveTargetId,
  onMoveTargetChange,
  onMoveClose,
  onMoveSubmit,
  isMoving,
  moveOptions,
  deleteFolder,
  onDeleteFolderClose,
  onDeleteFolderSubmit,
  isDeletingFolder,
  deleteFile,
  onDeleteFileClose,
  onDeleteFileSubmit,
  isDeletingFile,
  renameAlertOpen,
  renameAlertMessage,
  onRenameAlertClose,
}: FilesDialogsProps) {
  const handleEnter = (
    event: KeyboardEvent<HTMLInputElement>,
    handler: () => void,
    disabled?: boolean
  ) => {
    if (event.key === "Enter" && !event.shiftKey && !disabled) {
      event.preventDefault();
      handler();
    }
  };

  return (
    <>
      <ShareModal
        open={!!shareFile}
        onOpenChange={onShareOpenChange}
        fileName={shareFile ? shareFile.name || shareFile.fileName || "" : ""}
        shareLink={shareFile?.shareLink}
        expiresAt={shareFile?.shareExpiresAt}
        onCreateSecureLink={onCreateSecureShare}
        isCreating={isCreatingShare}
      />

      <Dialog open={!!renameFile} onOpenChange={(open) => (!open ? onRenameFileClose() : undefined)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename file</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Enter a new name for this file.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Input
              value={renameValue}
              onChange={(event) => onRenameValueChange(event.target.value)}
              onKeyDown={(event) => handleEnter(event, onRenameFileSubmit, isRenamingFile)}
              placeholder="File name"
              className="h-10"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onRenameFileClose}>
              Cancel
            </Button>
            <Button onClick={onRenameFileSubmit} disabled={isRenamingFile}>
              {isRenamingFile ? "Renaming..." : "Rename"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={createFolderOpen} onOpenChange={onCreateFolderOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create folder</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Give your folder a name.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Input
              value={createFolderName}
              onChange={(event) => onCreateFolderNameChange(event.target.value)}
              onKeyDown={(event) => handleEnter(event, onCreateFolderSubmit, isCreatingFolder)}
              placeholder="Folder name"
              className="h-10"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onCreateFolderOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={onCreateFolderSubmit} disabled={isCreatingFolder}>
              {isCreatingFolder ? "Creating..." : "Create folder"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!renameFolder} onOpenChange={(open) => (!open ? onRenameFolderClose() : undefined)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename folder</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Enter a new name for this folder.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Input
              value={renameFolderValue}
              onChange={(event) => onRenameFolderValueChange(event.target.value)}
              onKeyDown={(event) => handleEnter(event, onRenameFolderSubmit, isRenamingFolder)}
              placeholder="Folder name"
              className="h-10"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onRenameFolderClose}>
              Cancel
            </Button>
            <Button onClick={onRenameFolderSubmit} disabled={isRenamingFolder}>
              {isRenamingFolder ? "Renaming..." : "Rename"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(moveItemLabel)} onOpenChange={(open) => (!open ? onMoveClose() : undefined)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Move {moveItemLabel ?? "item"}</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Select a destination folder.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Destination
            </label>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={moveTargetId}
              onChange={(event) => onMoveTargetChange(event.target.value)}
            >
              <option value="">Root</option>
              {moveOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onMoveClose}>
              Cancel
            </Button>
            <Button onClick={onMoveSubmit} disabled={isMoving}>
              {isMoving ? "Moving..." : "Move"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteFolder} onOpenChange={(open) => !open && onDeleteFolderClose()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move folder to trash</AlertDialogTitle>
            <AlertDialogDescription>
              This will move the folder and its files to trash.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={onDeleteFolderClose}>
              Cancel
            </Button>
            <AlertDialogAction
              onClick={onDeleteFolderSubmit}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeletingFolder}
            >
              {isDeletingFolder ? "Deleting..." : "Move to Trash"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteFile} onOpenChange={(open) => !open && onDeleteFileClose()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" /> Move file to trash
            </AlertDialogTitle>
            <AlertDialogDescription>
              This moves the file to trash.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={onDeleteFileClose}>
              Cancel
            </Button>
            <AlertDialogAction
              onClick={onDeleteFileSubmit}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeletingFile}
            >
              {isDeletingFile ? "Deleting..." : "Move to Trash"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={renameAlertOpen} onOpenChange={onRenameAlertClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rename failed</AlertDialogTitle>
            <AlertDialogDescription>{renameAlertMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={onRenameAlertClose}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
