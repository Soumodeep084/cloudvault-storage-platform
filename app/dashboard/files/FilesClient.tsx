"use client";

import { Fragment, useCallback, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatFileSize } from "@/lib/utils";
import type { FileItem, FolderItem } from "@/types";
import { FolderRow } from "./components/FolderRow";
import { FileRow } from "./components/FileRow";
import { FilesDialogs } from "./components/FilesDialogs";
import { FilePreviewDialog } from "./components/preview/FilePreviewDialog";
import { useFilesManager, type FolderSummary } from "./hooks/useFilesManager";

function getFolderStatus(folder: FolderItem) {
  if (folder.shareLink && folder.shareExpiresAt) {
    if (new Date(folder.shareExpiresAt).getTime() < Date.now()) return "expired";
  }
  if (folder.shared ?? folder.shareLink) return "shared";
  return "private";
}

export default function FilesClient({
  initialFiles,
  allFolders,
  breadcrumbs,
  currentFolderId,
  folderSummary,
  folderSizes,
}: {
  initialFiles: FileItem[];
  allFolders: FolderItem[];
  breadcrumbs: Array<{ id: string; name: string }>;
  currentFolderId: string | null;
  folderSummary?: FolderSummary | null;
  folderSizes?: Record<string, number>;
}) {
  const manager = useFilesManager({
    initialFiles,
    initialFolders: allFolders,
    breadcrumbs,
    currentFolderId,
    folderSummary: folderSummary ?? null,
  });

  const moveOptionList = manager.moveOptions.map((folder) => ({
    id: folder.id,
    label: manager.folderPathMap.get(folder.id) || folder.name,
  }));

  const parentFolderId =
    breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 2].id : null;

  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const handlePreviewOpen = useCallback((file: FileItem) => {
    setPreviewFile(file);
  }, []);
  const handlePreviewOpenChange = useCallback((open: boolean) => {
    if (!open) setPreviewFile(null);
  }, []);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/dashboard/files">My Files</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return (
                <Fragment key={crumb.id}>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    {isLast ? (
                      <BreadcrumbPage>{crumb.name}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <Link href={`/dashboard/files?folder=${crumb.id}`}>
                          {crumb.name}
                        </Link>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </Fragment>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {currentFolderId ? manager.currentFolderName : "My Files"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {manager.resolvedSummary
                ? `${manager.resolvedSummary.folderCount} folders • ${manager.resolvedSummary.fileCount} files • ${formatFileSize(manager.resolvedSummary.totalSize)} total`
                : `${manager.folders.length} folders • ${manager.files.length} files • ${formatFileSize(manager.totalSize)} total`}
            </p>
          </div>
          <Button
            type="button"
            onClick={() => manager.openCreateFolderDialog(currentFolderId)}
            className="gap-2"
          >
            <Plus className="h-4 w-4" /> Create folder
          </Button>
        </div>
      </div>

      {manager.hasItems && parentFolderId && (
        <div
          onDragOver={manager.handleParentDragOver}
          onDragLeave={manager.handleParentDragLeave}
          onDrop={(event) => manager.handleParentDrop(event, parentFolderId)}
          className={`rounded-xl user-select-none border border-dashed px-4 py-3 text-sm text-muted-foreground transition-colors ${
            manager.isDragOverParent
              ? "border-primary bg-primary/5 text-primary"
              : "border-border/60"
          }`}
        >
          Drop here to move to parent
        </div>
      )}

      {manager.hasItems && currentFolderId && (
        <div
          onDragOver={manager.handleRootDragOver}
          onDragLeave={manager.handleRootDragLeave}
          onDrop={manager.handleRootDrop}
          className={`rounded-xl user-select-none border border-dashed px-4 py-3 text-sm text-muted-foreground transition-colors ${
            manager.isDragOverRoot
              ? "border-primary bg-primary/5 text-primary"
              : "border-border/60"
          }`}
        >
          Drop here to move to root
        </div>
      )}

      {!manager.hasItems ? (
        <div className="flex flex-col items-center justify-center py-24 border-2 border-dashed rounded-xl border-muted">
          <p className="text-lg font-medium">No items found</p>
          <p className="text-sm text-muted-foreground">
            Upload files or create folders to get started.
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="bg-white">
              <TableHeader className="bg-muted/60">
                <TableRow className="hover:bg-muted/60">
                  <TableHead className="font-semibold text-foreground px-3 py-3 sm:px-4">Name</TableHead>
                  <TableHead className="hidden sm:table-cell font-semibold text-foreground">Size</TableHead>
                  <TableHead className="hidden md:table-cell font-semibold text-foreground">Modified</TableHead>
                  <TableHead className="hidden md:table-cell font-semibold text-foreground">Status</TableHead>
                  <TableHead className="w-12 font-semibold text-foreground text-right pr-2 sm:pr-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {manager.folders.map((folder) => (
                  <FolderRow
                    key={folder.id}
                    folder={folder}
                    sizeBytes={folderSizes?.[folder.id] ?? 0}
                    status={getFolderStatus(folder)}
                    isDragOver={manager.dragOverFolderId === folder.id}
                    onOpen={manager.openFolder}
                    onCreateInside={manager.openCreateFolderDialog}
                    onRename={manager.openRenameFolderDialog}
                    onMove={(item) =>
                      manager.openMoveDialog({
                        type: "folder",
                        id: item.id,
                        name: item.name,
                        currentParentId: item.parentId ?? null,
                      })
                    }
                    onShare={manager.handleShareFolder}
                    onStopSharing={manager.handleStopFolderSharing}
                    onDelete={manager.setDeleteFolder}
                    onDragStart={manager.handleFolderDragStart}
                    onDragOver={(event) => manager.handleFolderDragOver(event, folder.id)}
                    onDragLeave={() => manager.handleFolderDragLeave(folder.id)}
                    onDrop={(event) => manager.handleFolderDrop(event, folder)}
                    isRevokingShareId={manager.isRevokingFolderShareId}
                  />
                ))}

                {manager.files.map((file) => (
                  <FileRow
                    key={file.id}
                    file={file}
                    isRevokingShareId={manager.isRevokingShareId}
                    onDownload={manager.handleDownload}
                    onRename={manager.openRenameDialog}
                    onMove={(item) =>
                      manager.openMoveDialog({
                        type: "file",
                        id: item.id,
                        name: item.name || item.fileName || "Untitled file",
                        currentParentId: currentFolderId ?? null,
                      })
                    }
                    onShare={manager.handleShare}
                    onStopSharing={manager.handleStopSharing}
                    onDelete={manager.openDeleteDialog}
                    onPreview={handlePreviewOpen}
                    onDragStart={manager.handleFileDragStart}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <FilesDialogs
        shareTarget={manager.shareTarget}
        isCreatingShare={manager.isCreatingShare}
        onShareOpenChange={(open) => {
          if (!open) manager.setShareTarget(null);
        }}
        onCreateSecureShare={manager.handleCreateSecureShare}
        renameFile={manager.renameFile}
        renameValue={manager.renameValue}
        onRenameValueChange={manager.setRenameValue}
        onRenameFileClose={manager.resetRenameDialog}
        onRenameFileSubmit={manager.handleRename}
        isRenamingFile={manager.isRenaming}
        createFolderOpen={manager.createFolderOpen}
        createFolderName={manager.createFolderName}
        onCreateFolderNameChange={manager.setCreateFolderName}
        onCreateFolderOpenChange={manager.handleCreateFolderOpenChange}
        onCreateFolderSubmit={manager.handleCreateFolder}
        isCreatingFolder={manager.isCreatingFolder}
        renameFolder={manager.renameFolder}
        renameFolderValue={manager.renameFolderValue}
        onRenameFolderValueChange={manager.setRenameFolderValue}
        onRenameFolderClose={manager.resetRenameFolderDialog}
        onRenameFolderSubmit={manager.handleRenameFolder}
        isRenamingFolder={manager.isRenamingFolder}
        moveItemLabel={manager.moveItem ? manager.moveItem.type : null}
        moveTargetId={manager.moveTargetId}
        onMoveTargetChange={manager.setMoveTargetId}
        onMoveClose={manager.resetMoveDialog}
        onMoveSubmit={manager.handleMove}
        isMoving={manager.isMoving}
        moveOptions={moveOptionList}
        deleteFolder={manager.deleteFolder}
        onDeleteFolderClose={() => manager.setDeleteFolder(null)}
        onDeleteFolderSubmit={manager.handleDeleteFolder}
        isDeletingFolder={manager.isDeletingFolder}
        deleteFile={manager.deleteFile}
        onDeleteFileClose={manager.resetDeleteDialog}
        onDeleteFileSubmit={manager.handleDelete}
        isDeletingFile={manager.isDeleting}
        renameAlertOpen={manager.renameAlertOpen}
        renameAlertMessage={manager.renameAlertMessage}
        onRenameAlertClose={() => manager.setRenameAlertOpen(false)}
      />

      <FilePreviewDialog
        file={previewFile}
        open={!!previewFile}
        onOpenChange={handlePreviewOpenChange}
        onDownload={manager.handleDownload}
      />
    </div>
  );
}
