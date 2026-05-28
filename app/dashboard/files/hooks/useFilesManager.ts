"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { FileItem, FolderItem } from "@/types";
import {
  deleteFileAction,
  moveFileAction,
  renameFileAction,
} from "@/app/actions/fileActions";
import {
  createFolderAction,
  deleteFolderAction,
  moveFolderAction,
  renameFolderAction,
} from "@/app/actions/folderActions";
import { useShareManager } from "./useShareManager";

function splitFileName(fileName: string) {
  const lastDotIndex = fileName.lastIndexOf(".");
  if (lastDotIndex <= 0) {
    return { baseName: fileName, extension: "" };
  }

  return {
    baseName: fileName.slice(0, lastDotIndex),
    extension: fileName.slice(lastDotIndex),
  };
}

export type FolderSummary = {
  id: string;
  name: string;
  fileCount: number;
  folderCount: number;
  totalSize: number;
};

export type UseFilesManagerProps = {
  initialFiles: FileItem[];
  initialFolders: FolderItem[];
  breadcrumbs: Array<{ id: string; name: string }>;
  currentFolderId: string | null;
  folderSummary: FolderSummary | null;
};

export function useFilesManager({
  initialFiles,
  initialFolders,
  breadcrumbs,
  currentFolderId,
  folderSummary,
}: UseFilesManagerProps) {
  const router = useRouter();

  // File state
  const [files, setFiles] = useState(initialFiles);
  const [deleteFile, setDeleteFile] = useState<FileItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [renameFile, setRenameFile] = useState<FileItem | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameExtension, setRenameExtension] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameAlertOpen, setRenameAlertOpen] = useState(false);
  const [renameAlertMessage, setRenameAlertMessage] = useState("");
  const [dragOverTarget, setDragOverTarget] = useState<"root" | "parent" | null>(null);

  // Folder state
  const [allFolders, setAllFolders] = useState(initialFolders);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [createFolderName, setCreateFolderName] = useState("");
  const [createFolderParentId, setCreateFolderParentId] = useState<string | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [renameFolder, setRenameFolder] = useState<FolderItem | null>(null);
  const [renameFolderValue, setRenameFolderValue] = useState("");
  const [isRenamingFolder, setIsRenamingFolder] = useState(false);
  const [deleteFolder, setDeleteFolder] = useState<FolderItem | null>(null);
  const [isDeletingFolder, setIsDeletingFolder] = useState(false);
  const [moveItem, setMoveItem] = useState<
    | { type: "file"; id: string; name: string; currentParentId: string | null }
    | { type: "folder"; id: string; name: string; currentParentId: string | null }
    | null
  >(null);
  const [moveTargetId, setMoveTargetId] = useState("");
  const [isMoving, setIsMoving] = useState(false);

  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  // `isDragOverRoot` is derived from `dragOverTarget` below — no separate state needed

  useEffect(() => {
    setFiles(initialFiles);
  }, [initialFiles]);

  useEffect(() => {
    setAllFolders(initialFolders);
  }, [initialFolders]);

  const shareManager = useShareManager({ setFiles, setAllFolders });
  const {
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
  } = shareManager;

  const folders = useMemo(
    () =>
      allFolders.filter(
        (folder) => (folder.parentId ?? null) === currentFolderId,
      ),
    [allFolders, currentFolderId],
  );

  const folderMap = useMemo(() => {
    const map = new Map<string, FolderItem>();
    for (const folder of allFolders) {
      map.set(folder.id, folder);
    }
    return map;
  }, [allFolders]);

  const childrenMap = useMemo(() => {
    const map = new Map<string | null, string[]>();
    for (const folder of allFolders) {
      const key = folder.parentId ?? null;
      const entry = map.get(key) ?? [];
      entry.push(folder.id);
      map.set(key, entry);
    }
    return map;
  }, [allFolders]);

  const folderPathMap = useMemo(() => {
    const resolved = new Map<string, string>();
    const resolving = new Set<string>();

    const resolve = (folderId: string): string => {
      if (resolved.has(folderId)) return resolved.get(folderId) as string;
      if (resolving.has(folderId)) return "";
      const folder = folderMap.get(folderId);
      if (!folder) return "";
      resolving.add(folderId);
      const parentPath = folder.parentId ? resolve(folder.parentId) : "";
      const nextPath = parentPath
        ? `${parentPath}/${folder.name}`
        : folder.name;
      resolving.delete(folderId);
      resolved.set(folderId, nextPath);
      return nextPath;
    };

    for (const folder of allFolders) {
      resolve(folder.id);
    }

    return resolved;
  }, [allFolders, folderMap]);

  const totalSize = useMemo(
    () => files.reduce((a, f) => a + (f.size ?? f.fileSize ?? 0), 0),
    [files],
  );

  const currentFolderName = breadcrumbs.length
    ? breadcrumbs[breadcrumbs.length - 1].name
    : "My Files";

  const resolvedSummary =
    folderSummary ??
    (currentFolderId
      ? {
          id: currentFolderId,
          name: currentFolderName,
          fileCount: files.length,
          folderCount: folders.length,
          totalSize,
        }
      : null);

  const hasItems = folders.length + files.length > 0;

  const openFolder = useCallback(
    (folderId: string) => {
      router.push(`/dashboard/files?folder=${folderId}`);
    },
    [router],
  );

  const handleDownload = useCallback((file: FileItem) => {
    if (!file.id) {
      toast.error("File id not found");
      return;
    }

    const anchor = document.createElement("a");
    anchor.href = `/api/files/${file.id}/download`;
    anchor.rel = "noopener noreferrer";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    toast.success("Download started");
  }, []);

  const handleDownloadFolder = useCallback((folder: FolderItem) => {
    if (!folder.id) {
      toast.error("Folder id not found");
      return;
    }

    const anchor = document.createElement("a");
    anchor.href = `/api/folders/${folder.id}/download`;
    anchor.rel = "noopener noreferrer";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    toast.success("Folder download started");
  }, []);

  const openRenameDialog = useCallback((file: FileItem) => {
    const { baseName, extension } = splitFileName(
      file.name || file.fileName || "Untitled file",
    );
    setRenameFile(file);
    setRenameValue(baseName);
    setRenameExtension(extension);
  }, []);

  const resetRenameDialog = useCallback(() => {
    if (isRenaming) return;
    setRenameFile(null);
    setRenameValue("");
    setRenameExtension("");
  }, [isRenaming]);

  const openRenameFolderDialog = useCallback((folder: FolderItem) => {
    setRenameFolder(folder);
    setRenameFolderValue(folder.name);
  }, []);

  const resetRenameFolderDialog = useCallback(() => {
    if (isRenamingFolder) return;
    setRenameFolder(null);
    setRenameFolderValue("");
  }, [isRenamingFolder]);

  const openMoveDialog = useCallback(
    (item: { type: "file" | "folder"; id: string; name: string; currentParentId: string | null }) => {
      setMoveItem(item);
      setMoveTargetId(item.currentParentId ?? "");
    },
    [],
  );

  const resetMoveDialog = useCallback(() => {
    if (isMoving) return;
    setMoveItem(null);
    setMoveTargetId("");
  }, [isMoving]);

  const openCreateFolderDialog = useCallback((parentId: string | null) => {
    setCreateFolderParentId(parentId);
    setCreateFolderName("");
    setCreateFolderOpen(true);
  }, []);

  const handleCreateFolderOpenChange = useCallback((open: boolean) => {
    setCreateFolderOpen(open);
    if (!open) {
      setCreateFolderName("");
      setCreateFolderParentId(null);
    }
  }, []);

  const resetDeleteDialog = useCallback(() => {
    if (isDeleting) return;
    setDeleteFile(null);
  }, [isDeleting]);

  const openDeleteDialog = useCallback((file: FileItem) => {
    setDeleteFile(file);
  }, []);

  const handleDelete = useCallback(async () => {
    if (!deleteFile?.id) {
      toast.error("File id not found");
      return;
    }

    setIsDeleting(true);
    const result = await deleteFileAction(deleteFile.id);
    setIsDeleting(false);

    if (!result.success) {
      toast.error(result.error || "Failed to delete file");
      return;
    }

    setFiles((prev) => prev.filter((f) => f.id !== deleteFile.id));
    resetDeleteDialog();
    toast.success("Moved to trash");
  }, [deleteFile, resetDeleteDialog]);

  const handleRename = useCallback(async () => {
    if (!renameFile?.id) {
      toast.error("File id not found");
      return;
    }

    const nextName = renameValue.trim();
    if (!nextName) {
      toast.error("File name is required");
      return;
    }

    const composedName = `${nextName}${renameExtension}`;

    setIsRenaming(true);
    const result = await renameFileAction(renameFile.id, composedName);
    setIsRenaming(false);

    if (!result.success) {
      const errorMessage =
        "error" in result && typeof result.error === "string"
          ? result.error
          : "Unable to rename file";
      if (errorMessage === "A file with this name already exists.") {
        setRenameAlertMessage(errorMessage);
        setRenameAlertOpen(true);
      } else {
        toast.error(errorMessage);
      }
      return;
    }

    const updatedName =
      "fileName" in result && typeof result.fileName === "string"
        ? result.fileName
        : composedName;

    setFiles((prev) =>
      prev.map((file) =>
        file.id === renameFile.id
          ? { ...file, fileName: updatedName, name: updatedName }
          : file,
      ),
    );

    resetRenameDialog();
    toast.success("File renamed");
  }, [renameExtension, renameFile, renameValue, resetRenameDialog]);

  const handleCreateFolder = useCallback(async () => {
    const nextName = createFolderName.trim();
    if (!nextName) {
      toast.error("Folder name is required");
      return;
    }

    setIsCreatingFolder(true);
    const result = await createFolderAction(
      nextName,
      createFolderParentId ?? currentFolderId,
    );
    setIsCreatingFolder(false);

    if (!result.success || !result.folder) {
      toast.error(result.error || "Failed to create folder");
      return;
    }

    setAllFolders((prev) => [...prev, result.folder]);
    setCreateFolderName("");
    setCreateFolderParentId(null);
    setCreateFolderOpen(false);
    toast.success("Folder created");
  }, [createFolderName, createFolderParentId, currentFolderId]);

  const handleRenameFolder = useCallback(async () => {
    if (!renameFolder?.id) {
      toast.error("Folder id not found");
      return;
    }

    const nextName = renameFolderValue.trim();
    if (!nextName) {
      toast.error("Folder name is required");
      return;
    }

    setIsRenamingFolder(true);
    const result = await renameFolderAction(renameFolder.id, nextName);
    setIsRenamingFolder(false);

    if (!result.success) {
      const errorMessage =
        "error" in result && typeof result.error === "string"
          ? result.error
          : "Unable to rename folder";
      if (errorMessage === "A folder with this name already exists.") {
        setRenameAlertMessage(errorMessage);
        setRenameAlertOpen(true);
      } else {
        toast.error(errorMessage);
      }
      return;
    }

    const updatedName =
      "folderName" in result && typeof result.folderName === "string"
        ? result.folderName
        : nextName;

    setAllFolders((prev) =>
      prev.map((folder) =>
        folder.id === renameFolder.id ? { ...folder, name: updatedName } : folder,
      ),
    );

    resetRenameFolderDialog();
    toast.success("Folder renamed");
  }, [renameFolder, renameFolderValue, resetRenameFolderDialog]);

  const handleDeleteFolder = useCallback(async () => {
    if (!deleteFolder?.id) {
      toast.error("Folder id not found");
      return;
    }

    setIsDeletingFolder(true);
    const result = await deleteFolderAction(deleteFolder.id);
    setIsDeletingFolder(false);

    if (!result.success) {
      toast.error(result.error || "Failed to delete folder");
      return;
    }

    const stack = [deleteFolder.id];
    const removed = new Set<string>();
    while (stack.length > 0) {
      const current = stack.pop();
      if (!current || removed.has(current)) continue;
      removed.add(current);
      const children = childrenMap.get(current) ?? [];
      for (const child of children) {
        if (!removed.has(child)) stack.push(child);
      }
    }

    const fallbackParentId = deleteFolder.parentId ?? null;
    setAllFolders((prev) => prev.filter((folder) => !removed.has(folder.id)));
    setDeleteFolder(null);
    toast.success("Moved to trash");
    const parentId = ("parentId" in result ? result.parentId : null) ?? fallbackParentId;
    router.replace(parentId ? `/dashboard/files?folder=${parentId}` : "/dashboard/files");
  }, [childrenMap, deleteFolder, router]);

  const handleMove = useCallback(async () => {
    if (!moveItem) return;

    const targetId = moveTargetId || null;
    setIsMoving(true);
    const result =
      moveItem.type === "file"
        ? await moveFileAction(moveItem.id, targetId)
        : await moveFolderAction(moveItem.id, targetId);
    setIsMoving(false);

    if (!result.success) {
      toast.error(result.error || "Failed to move item");
      return;
    }

    if (moveItem.type === "file") {
      if (targetId !== (currentFolderId ?? null)) {
        setFiles((prev) => prev.filter((file) => file.id !== moveItem.id));
      }
    } else {
      setAllFolders((prev) =>
        prev.map((folder) =>
          folder.id === moveItem.id ? { ...folder, parentId: targetId } : folder,
        ),
      );
    }

    resetMoveDialog();
    toast.success("Move complete");
  }, [currentFolderId, moveItem, moveTargetId, resetMoveDialog]);

  const moveOptions = useMemo(() => {
    if (!moveItem) return [] as FolderItem[];
    if (moveItem.type === "file") return allFolders;

    const descendants = new Set<string>();
    const stack = [moveItem.id];
    while (stack.length > 0) {
      const current = stack.pop();
      if (!current || descendants.has(current)) continue;
      descendants.add(current);
      const children = childrenMap.get(current) ?? [];
      for (const child of children) {
        if (!descendants.has(child)) stack.push(child);
      }
    }

    return allFolders.filter((folder) => !descendants.has(folder.id));
  }, [allFolders, childrenMap, moveItem]);

  const handleFileDragStart = useCallback(
    (event: React.DragEvent<HTMLTableRowElement>, file: FileItem) => {
      if (!file.id) return;
      event.dataTransfer.setData("application/x-cloudvault-file", file.id);
      event.dataTransfer.setData("text/plain", file.id);
      event.dataTransfer.effectAllowed = "move";
    },
    [],
  );

  const handleFolderDragStart = useCallback(
    (event: React.DragEvent<HTMLTableRowElement>, folder: FolderItem) => {
      if (!folder.id) return;
      event.dataTransfer.setData("application/x-cloudvault-folder", folder.id);
      event.dataTransfer.effectAllowed = "move";
    },
    [],
  );

  const handleFolderDragOver = useCallback(
    (event: React.DragEvent<HTMLTableRowElement>, folderId: string) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setDragOverFolderId(folderId);
    },
    [],
  );

  const handleFolderDragLeave = useCallback((folderId: string) => {
    setDragOverFolderId((current) => (current === folderId ? null : current));
  }, []);

  const readDraggedIds = useCallback((event: React.DragEvent) => {
    const draggedFolderId = event.dataTransfer.getData("application/x-cloudvault-folder");
    const draggedFileId =
      event.dataTransfer.getData("application/x-cloudvault-file") ||
      event.dataTransfer.getData("text/plain");

    return { draggedFolderId, draggedFileId };
  }, []);

  const moveFolderWithFeedback = useCallback(
    async (folderId: string, destinationId: string | null, successMessage: string) => {
      const result = await moveFolderAction(folderId, destinationId);
      if (!result.success) {
        toast.error(result.error || "Failed to move folder");
        return false;
      }

      setAllFolders((prev) =>
        prev.map((item) => (item.id === folderId ? { ...item, parentId: destinationId } : item)),
      );
      toast.success(successMessage);
      return true;
    },
    [],
  );

  const moveFileWithFeedback = useCallback(async (fileId: string, destinationId: string | null, successMessage: string) => {
    const result = await moveFileAction(fileId, destinationId);
    if (!result.success) {
      toast.error(result.error || "Failed to move file");
      return false;
    }

    setFiles((prev) => prev.filter((file) => file.id !== fileId));
    toast.success(successMessage);
    return true;
  }, []);

  const handleFolderDrop = useCallback(
    async (event: React.DragEvent<HTMLTableRowElement>, folder: FolderItem) => {
      event.preventDefault();
      setDragOverFolderId(null);
      const { draggedFolderId, draggedFileId } = readDraggedIds(event);

      if (draggedFolderId) {
        if (draggedFolderId === folder.id) return;
        await moveFolderWithFeedback(draggedFolderId, folder.id, `Moved to ${folder.name}`);
        return;
      }

      if (!draggedFileId) return;

      await moveFileWithFeedback(draggedFileId, folder.id, `Moved to ${folder.name}`);
    },
    [moveFileWithFeedback, moveFolderWithFeedback, readDraggedIds],
  );

  const handleRootDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setDragOverTarget("root");
    },
    [],
  );

  const handleRootDragLeave = useCallback(() => {
    setDragOverTarget((current) => (current === "root" ? null : current));
  }, []);

  const handleRootDrop = useCallback(async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOverTarget((current) => (current === "root" ? null : current));
    const { draggedFolderId, draggedFileId } = readDraggedIds(event);

    if (draggedFolderId) {
      await moveFolderWithFeedback(draggedFolderId, null, "Moved to root");
      return;
    }

    if (!draggedFileId) return;

    await moveFileWithFeedback(draggedFileId, null, "Moved to root");
  }, [moveFileWithFeedback, moveFolderWithFeedback, readDraggedIds]);

  const handleParentDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setDragOverTarget("parent");
    },
    [],
  );

  const handleParentDragLeave = useCallback(() => {
    setDragOverTarget((current) => (current === "parent" ? null : current));
  }, []);

  const handleParentDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>, parentId: string | null) => {
      event.preventDefault();
      setDragOverTarget((current) => (current === "parent" ? null : current));
      const { draggedFolderId, draggedFileId } = readDraggedIds(event);

      if (draggedFolderId) {
        await moveFolderWithFeedback(draggedFolderId, parentId, "Moved to parent");
        return;
      }

      if (!draggedFileId) return;

      await moveFileWithFeedback(draggedFileId, parentId, "Moved to parent");
    },
    [moveFileWithFeedback, moveFolderWithFeedback, readDraggedIds],
  );

  return {
    files,
    folders,
    allFolders,
    folderMap,
    childrenMap,
    folderPathMap,
    deleteFile,
    isDeleting,
    renameFile,
    renameValue,
    renameExtension,
    isRenaming,
    renameAlertOpen,
    renameAlertMessage,
    createFolderOpen,
    createFolderName,
    createFolderParentId,
    isCreatingFolder,
    renameFolder,
    renameFolderValue,
    isRenamingFolder,
    deleteFolder,
    isDeletingFolder,
    moveItem,
    moveTargetId,
    isMoving,
    dragOverFolderId,
    isDragOverRoot: dragOverTarget === "root",
    isDragOverParent: dragOverTarget === "parent",
    currentFolderName,
    resolvedSummary,
    hasItems,
    totalSize,
    moveOptions,
    openFolder,
    handleDownload,
    handleDownloadFolder,
    openRenameDialog,
    resetRenameDialog,
    openRenameFolderDialog,
    resetRenameFolderDialog,
    openMoveDialog,
    resetMoveDialog,
    openCreateFolderDialog,
    handleCreateFolderOpenChange,
    resetDeleteDialog,
    openDeleteDialog,
    handleDelete,
    handleShare,
    handleShareFolder,
    handleRename,
    handleCreateSecureShare,
    handleStopSharing,
    handleStopFolderSharing,
    handleCreateFolder,
    handleRenameFolder,
    handleDeleteFolder,
    handleMove,
    setCreateFolderName,
    setCreateFolderParentId,
    setMoveTargetId,
    setDeleteFolder,
    setRenameValue,
    setRenameFolderValue,
    setRenameAlertOpen,
    setRenameAlertMessage,
    handleFileDragStart,
    handleFolderDragStart,
    handleFolderDragOver,
    handleFolderDragLeave,
    handleFolderDrop,
    handleRootDragOver,
    handleRootDragLeave,
    handleRootDrop,
    handleParentDragOver,
    handleParentDragLeave,
    handleParentDrop,
    shareTarget,
    isCreatingShare,
    isRevokingShareId,
    isRevokingFolderShareId,
    setShareTarget,
  };
}
