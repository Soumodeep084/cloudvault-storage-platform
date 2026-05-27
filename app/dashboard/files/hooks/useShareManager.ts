"use client";

import { useCallback, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { toast } from "sonner";
import type { FileItem, FolderItem } from "@/types";
import { createShareLink, revokeShareLink } from "@/app/actions/fileActions";
import { createFolderShareLink, revokeFolderShareLink } from "@/app/actions/folderActions";

export type ShareTarget =
  | { type: "file"; item: FileItem }
  | { type: "folder"; item: FolderItem };

type ShareOptions = { password: string; expiresInMinutes: number | null };

function isExpiredShare(shareLink?: string, shareExpiresAt?: string | Date | null) {
  if (!shareLink || !shareExpiresAt) return false;
  return new Date(shareExpiresAt).getTime() < Date.now();
}

export function useShareManager({
  setFiles,
  setAllFolders,
}: {
  setFiles: Dispatch<SetStateAction<FileItem[]>>;
  setAllFolders: Dispatch<SetStateAction<FolderItem[]>>;
}) {
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null);
  const [isCreatingShare, setIsCreatingShare] = useState(false);
  const [isRevokingShareId, setIsRevokingShareId] = useState<string | null>(null);
  const [isRevokingFolderShareId, setIsRevokingFolderShareId] = useState<string | null>(null);

  const handleShare = useCallback((file: FileItem) => {
    const normalized = isExpiredShare(file.shareLink, file.shareExpiresAt)
      ? { ...file, shareLink: undefined, shared: false, shareExpiresAt: null }
      : file;
    setShareTarget({ type: "file", item: normalized });
  }, []);

  const handleShareFolder = useCallback((folder: FolderItem) => {
    const normalized = isExpiredShare(folder.shareLink, folder.shareExpiresAt)
      ? { ...folder, shareLink: undefined, shared: false, shareExpiresAt: null }
      : folder;
    setShareTarget({ type: "folder", item: normalized });
  }, []);

  const handleCreateSecureShare = useCallback(
    async (options: ShareOptions) => {
      if (!shareTarget?.item.id) {
        toast.error("Share target not found");
        return;
      }

      setIsCreatingShare(true);

      const shareExpiresAt = options.expiresInMinutes
        ? new Date(Date.now() + options.expiresInMinutes * 60 * 1000)
        : null;

      const result =
        shareTarget.type === "file"
          ? await createShareLink(shareTarget.item.id, options)
          : await createFolderShareLink(shareTarget.item.id, options);

      setIsCreatingShare(false);

      if (!result.success) {
        toast.error(result.error || "Failed to create secure share link");
        return;
      }

      if (shareTarget.type === "file") {
        const updatedItem: FileItem = {
          ...shareTarget.item,
          shareLink: result.shareLink,
          shared: true,
          shareExpiresAt,
        };
        setFiles((prev) =>
          prev.map((file) => (file.id === shareTarget.item.id ? updatedItem : file)),
        );
        setShareTarget({ type: "file", item: updatedItem });
      } else {
        const updatedItem: FolderItem = {
          ...shareTarget.item,
          shareLink: result.shareLink,
          shared: true,
          shareExpiresAt,
        };
        setAllFolders((prev) =>
          prev.map((folder) => (folder.id === shareTarget.item.id ? updatedItem : folder)),
        );
        setShareTarget({ type: "folder", item: updatedItem });
      }

      toast.success("Secure share link created");
    },
    [setAllFolders, setFiles, shareTarget],
  );

  const handleStopShare = useCallback(
    async (target: ShareTarget) => {
      if (!target.item.id) {
        toast.error(target.type === "file" ? "File id not found" : "Folder id not found");
        return;
      }

      if (target.type === "file") {
        setIsRevokingShareId(target.item.id);
        const result = await revokeShareLink(target.item.id);
        setIsRevokingShareId(null);

        if (!result.success) {
          toast.error(result.error || "Failed to stop sharing");
          return;
        }

        setFiles((prev) =>
          prev.map((file) =>
            file.id === target.item.id
              ? { ...file, shareLink: undefined, shared: false, shareExpiresAt: null }
              : file,
          ),
        );
      } else {
        setIsRevokingFolderShareId(target.item.id);
        const result = await revokeFolderShareLink(target.item.id);
        setIsRevokingFolderShareId(null);

        if (!result.success) {
          toast.error(result.error || "Failed to stop sharing");
          return;
        }

        setAllFolders((prev) =>
          prev.map((folder) =>
            folder.id === target.item.id
              ? { ...folder, shareLink: undefined, shared: false, shareExpiresAt: null }
              : folder,
          ),
        );
      }

      if (shareTarget?.type === target.type && shareTarget.item.id === target.item.id) {
        setShareTarget(null);
      }

      toast.success("Share link stopped");
    },
    [setAllFolders, setFiles, shareTarget],
  );

  const handleStopSharing = useCallback(
    (file: FileItem) => {
      void handleStopShare({ type: "file", item: file });
    },
    [handleStopShare],
  );

  const handleStopFolderSharing = useCallback(
    (folder: FolderItem) => {
      void handleStopShare({ type: "folder", item: folder });
    },
    [handleStopShare],
  );

  return {
    shareTarget,
    setShareTarget,
    isCreatingShare,
    isRevokingShareId,
    isRevokingFolderShareId,
    handleShare,
    handleShareFolder,
    handleCreateSecureShare,
    handleStopSharing,
    handleStopFolderSharing,
  };
}
