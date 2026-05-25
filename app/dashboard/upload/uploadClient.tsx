"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Upload,
  X,
  FileText,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getPresignedUrl } from "@/app/actions/uploadActions";
import { Progress } from "@/components/ui/progress";
import { formatFileSize } from "@/lib/utils";
import {
  recordFileUpload,
  recordFolderUploadActivity,
} from "@/app/actions/fileActions";
import { createFolderAction, deleteFolderAction } from "@/app/actions/folderActions";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface UploadingFile {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: "uploading" | "complete" | "error";
}

type RecordFileUploadResult = Awaited<ReturnType<typeof recordFileUpload>>;
type RecordFolderUploadActivityResult = Awaited<
  ReturnType<typeof recordFolderUploadActivity>
>;

type UploadOptions = {
  folderId?: string | null;
  logActivity?: boolean;
  showToast?: boolean;
};

type UploadSource = {
  file: File;
  relativePath?: string;
};

type FolderUploadGroup = {
  folderName: string;
  files: UploadSource[];
};

type BrowserFileSystemEntry = {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  fullPath: string;
};

type BrowserFileSystemFileEntry = BrowserFileSystemEntry & {
  isFile: true;
  file: (
    successCallback: (file: File) => void,
    errorCallback?: (error: DOMException) => void,
  ) => void;
};

type BrowserFileSystemDirectoryReader = {
  readEntries: (
    successCallback: (entries: BrowserFileSystemEntry[]) => void,
    errorCallback?: (error: DOMException) => void,
  ) => void;
};

type BrowserFileSystemDirectoryEntry = BrowserFileSystemEntry & {
  isDirectory: true;
  createReader: () => BrowserFileSystemDirectoryReader;
};

type DataTransferItemWithEntry = DataTransferItem & {
  webkitGetAsEntry?: () => BrowserFileSystemEntry | null;
};

function toUploadSource(file: File): UploadSource {
  return {
    file,
    relativePath: file.webkitRelativePath?.trim() || undefined,
  };
}

function buildSelectedFolderGroups(files: File[]) {
  const groups = new Map<string, File[]>();
  const standaloneFiles: UploadSource[] = [];

  for (const file of files) {
    const relativePath = file.webkitRelativePath?.trim();
    if (!relativePath) {
      standaloneFiles.push(toUploadSource(file));
      continue;
    }

    const parts = relativePath.split("/").filter(Boolean);
    if (parts.length < 2 || !parts[0]) {
      standaloneFiles.push(toUploadSource(file));
      continue;
    }

    const rootFolderName = parts[0];
    const entry = groups.get(rootFolderName) ?? [];
    entry.push(file);
    groups.set(rootFolderName, entry);
  }

  return {
    folderGroups: Array.from(groups.entries()).map<FolderUploadGroup>(
      ([folderName, groupFiles]) => ({
        folderName,
        files: groupFiles.map(toUploadSource),
      }),
    ),
    standaloneFiles,
  };
}

function getStorageName(source: UploadSource) {
  const relativePath = source.relativePath?.trim();
  const baseName = relativePath || source.file.name;
  return baseName.replace(/[\\/]/g, "__");
}

function getDisplayName(source: UploadSource) {
  return source.relativePath?.trim() || source.file.name;
}

function readDirectoryEntries(
  reader: BrowserFileSystemDirectoryReader,
): Promise<BrowserFileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    const entries: BrowserFileSystemEntry[] = [];

    const readNextBatch = () => {
      reader.readEntries(
        (batch) => {
          if (!batch.length) {
            resolve(entries);
            return;
          }

          entries.push(...batch);
          readNextBatch();
        },
        (error) => reject(error),
      );
    };

    readNextBatch();
  });
}

async function traverseEntry(
  entry: BrowserFileSystemEntry,
  relativePrefix = "",
): Promise<UploadSource[]> {
  if (entry.isFile) {
    const fileEntry = entry as BrowserFileSystemFileEntry;
    const file = await new Promise<File>((resolve, reject) => {
      fileEntry.file(resolve, reject);
    });

    return [
      {
        file,
        relativePath: relativePrefix ? `${relativePrefix}/${file.name}` : file.name,
      },
    ];
  }

  if (entry.isDirectory) {
    const directoryEntry = entry as BrowserFileSystemDirectoryEntry;
    const nextPrefix = relativePrefix ? `${relativePrefix}/${entry.name}` : entry.name;
    const children = await readDirectoryEntries(directoryEntry.createReader());
    const nestedSources = await Promise.all(
      children.map((child) => traverseEntry(child, nextPrefix)),
    );
    return nestedSources.flat();
  }

  return [];
}

async function collectDroppedSources(dataTransfer: DataTransfer) {
  const folderGroups: FolderUploadGroup[] = [];
  const standaloneFiles: UploadSource[] = [];
  const emptyFolderNames: string[] = [];

  const items = Array.from(dataTransfer.items ?? []);
  if (!items.length) {
    return {
      folderGroups,
      standaloneFiles: Array.from(dataTransfer.files).map(toUploadSource),
      emptyFolderNames,
    };
  }

  for (const item of items) {
    const entry = (item as DataTransferItemWithEntry).webkitGetAsEntry?.();
    if (!entry) continue;

    if (entry.isDirectory) {
      const sources = await traverseEntry(entry, "");
      if (!sources.length) {
        emptyFolderNames.push(entry.name);
        continue;
      }

      folderGroups.push({
        folderName: entry.name,
        files: sources,
      });
      continue;
    }

    if (entry.isFile) {
      const sources = await traverseEntry(entry, "");
      standaloneFiles.push(...sources);
    }
  }

  if (!folderGroups.length && !standaloneFiles.length && dataTransfer.files.length) {
    standaloneFiles.push(...Array.from(dataTransfer.files).map(toUploadSource));
  }

  return { folderGroups, standaloneFiles, emptyFolderNames };
}

export default function UploadClient({ userId }: { userId: string }) {
  const [files, setFiles] = useState<UploadingFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!folderInputRef.current) return;
    folderInputRef.current.setAttribute("webkitdirectory", "");
    folderInputRef.current.setAttribute("directory", "");
  }, []);

  const startUpload = useCallback(
    async (
      source: UploadSource,
      options: UploadOptions = {},
    ): Promise<boolean> => {
      const { file } = source;
      const id = Math.random().toString(36).slice(2);
      const displayName = getDisplayName(source);

      setFiles((prev) => [
        ...prev,
        {
          id,
          name: displayName,
          size: file.size,
          progress: 0,
          status: "uploading",
        },
      ]);

      try {
        // 1. Get a Signed URL from the server (bypasses RLS)
        const { uploadUrl, path } = await getPresignedUrl(
          file.name,
          getStorageName(source),
        );

        // 2. Use XMLHttpRequest for progress tracking
        const xhr = new XMLHttpRequest();

        const uploadPromise = new Promise((resolve, reject) => {
          xhr.upload.addEventListener("progress", (event) => {
            if (event.lengthComputable) {
              const percent = (event.loaded / event.total) * 100;
              setFiles((prev) =>
                prev.map((f) =>
                  f.id === id ? { ...f, progress: percent } : f,
                ),
              );
            }
          });

          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.response);
            else reject(new Error(`Upload failed with status ${xhr.status}`));
          });

          xhr.addEventListener("error", () =>
            reject(new Error("Network error during upload")),
          );
        });

        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader(
          "Content-Type",
          file.type || "application/octet-stream",
        );
        xhr.send(file);

        await uploadPromise;

        // 3. Get the Public URL
        const {
          data: { publicUrl },
        } = supabase.storage.from("files").getPublicUrl(path);

        // 4. Sync to Prisma via Server Action
        const dbResult: RecordFileUploadResult = await recordFileUpload({
          userId,
          fileName: file.name,
          fileUrl: publicUrl,
          fileSize: file.size,
          fileType: file.type || "unknown",
          folderId: options.folderId ?? null,
          logActivity: options.logActivity !== false,
        });

        // Use bracket notation to bypass the "Property does not exist" error
        if (!dbResult.success) {
          const errorMessage =
            "error" in dbResult && typeof dbResult.error === "string"
              ? dbResult.error
              : "Database synchronization failed";
          throw new Error(errorMessage);
        }

        // Success state remains the same
        setFiles((prev) =>
          prev.map((f) =>
            f.id === id ? { ...f, status: "complete", progress: 100 } : f,
          ),
        );
        if (options.showToast !== false) {
          toast.success(`${displayName} uploaded successfully!`);
        }
        return true;
      } catch (error: unknown) {
        console.error("Upload process error:", error);
        setFiles((prev) =>
          prev.map((f) => (f.id === id ? { ...f, status: "error" } : f)),
        );
        // Show the actual error message from the server if available
        const message =
          error instanceof Error ? error.message : `Failed to upload ${displayName}`;
        if (options.showToast !== false) {
          toast.error(message);
        }
        return false;
      }
    },
    [userId],
  );

  const uploadFolderGroup = useCallback(
    async (group: FolderUploadGroup) => {
      if (!group.files.length) {
        throw new Error("Empty folders cannot be uploaded");
      }

      const folderResult = await createFolderAction(group.folderName, null);

      if (!folderResult.success || !folderResult.folder) {
        throw new Error(folderResult.error || "Failed to create folder");
      }

      let uploadsCompleted = false;

      try {
        const uploadResults = await Promise.all(
          group.files.map((source) =>
            startUpload(source, {
              folderId: folderResult.folder.id,
              logActivity: false,
              showToast: false,
            }),
          ),
        );

        const successfulUploads = uploadResults.filter(Boolean).length;
        if (successfulUploads !== group.files.length) {
          throw new Error(
            `Folder upload incomplete: ${successfulUploads}/${group.files.length} files uploaded`,
          );
        }

        uploadsCompleted = true;

        const activityResult: RecordFolderUploadActivityResult =
          await recordFolderUploadActivity({
            userId,
            folderId: folderResult.folder.id,
            folderName: folderResult.folder.name,
            fileCount: group.files.length,
          });

        if (!activityResult.success) {
          throw new Error(
            "error" in activityResult && typeof activityResult.error === "string"
              ? activityResult.error
              : "Failed to log folder upload",
          );
        }

        toast.success(
          `${folderResult.folder.name} uploaded successfully (${group.files.length} files)`,
        );
      } catch (error) {
        if (!uploadsCompleted) {
          await deleteFolderAction(folderResult.folder.id);
        }
        throw error;
      }
    },
    [startUpload, userId],
  );

  const handleFilesSelected = useCallback(
    (selectedFiles: FileList | null) => {
      if (!selectedFiles) return;
      Array.from(selectedFiles).forEach((file) => {
        void startUpload(toUploadSource(file));
      });
    },
    [startUpload],
  );

  const handleFolderSelected = useCallback(
    async (selectedFiles: FileList | null) => {
      if (!selectedFiles) return;

      if (selectedFiles.length === 0) {
        toast.error("Empty folders cannot be uploaded");
        return;
      }

      const { folderGroups, standaloneFiles } = buildSelectedFolderGroups(
        Array.from(selectedFiles),
      );

      standaloneFiles.forEach((file) => {
        void startUpload(file);
      });

      for (const group of folderGroups) {
        try {
          await uploadFolderGroup(group);
        } catch (error: unknown) {
          console.error("Folder upload error:", error);
          const message =
            error instanceof Error
              ? error.message
              : `Failed to upload folder ${group.folderName}`;
          toast.error(message);
        }
      }
    },
    [startUpload, uploadFolderGroup],
  );

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const openFolderPicker = useCallback(() => {
    folderInputRef.current?.click();
  }, []);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);

    const dataTransfer = e.dataTransfer;
    void (async () => {
      const { folderGroups, standaloneFiles, emptyFolderNames } =
        await collectDroppedSources(dataTransfer);

      if (emptyFolderNames.length > 0) {
        toast.error("Empty folders cannot be uploaded");
      }

      standaloneFiles.forEach((source) => {
        void startUpload(source);
      });

      for (const group of folderGroups) {
        try {
          await uploadFolderGroup(group);
        } catch (error: unknown) {
          console.error("Folder drop upload error:", error);
          const message =
            error instanceof Error
              ? error.message
              : `Failed to upload folder ${group.folderName}`;
          toast.error(message);
        }
      }
    })();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all ${
          dragOver
            ? "border-primary bg-primary/5 scale-[0.99]"
            : "border-slate-200 hover:border-primary/40 bg-white"
        }`}
      >
        <div
          role="button"
          tabIndex={0}
          onClick={openFilePicker}
          className="w-full rounded-xl px-3 py-2 transition-colors hover:bg-slate-50"
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openFilePicker();
            }
          }}
        >
          <Upload className="h-10 w-10 text-primary mx-auto mb-4" />
          <p className="text-base font-semibold text-slate-900">
            Click to upload files or drop a folder
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Folder uploads keep their files grouped under one folder in Files.
          </p>
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            type="button"
            className="gap-2"
            onClick={(event) => {
              event.stopPropagation();
              openFilePicker();
            }}
          >
            <Upload className="h-4 w-4" /> Upload files
          </Button>
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={(event) => {
              event.stopPropagation();
              openFolderPicker();
            }}
          >
            <FolderOpen className="h-4 w-4" /> Upload folder
          </Button>
        </div>
        <input
          type="file"
          ref={fileInputRef}
          multiple
          className="hidden"
          onChange={(e) => {
            handleFilesSelected(e.target.files);
            e.currentTarget.value = "";
          }}
        />
        <input
          type="file"
          ref={folderInputRef}
          multiple
          className="hidden"
          onChange={(e) => {
            void handleFolderSelected(e.target.files);
            e.currentTarget.value = "";
          }}
        />
      </div>

      <div className="space-y-3">
        <AnimatePresence>
          {files.map((file) => (
            <motion.div
              key={file.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-100 shadow-sm"
            >
              <FileText
                className={`h-5 w-5 ${file.status === "error" ? "text-rose-500" : "text-primary"}`}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-700 truncate">
                  {file.name}
                </p>
                {file.status === "uploading" && (
                  <Progress
                    value={file.progress}
                    className="h-1.5 mt-2 bg-slate-100"
                  />
                )}
                {file.status !== "uploading" && (
                  <p className="text-[11px] text-slate-400 mt-1">
                    {formatFileSize(file.size)}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {file.status === "complete" ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : file.status === "error" ? (
                  <AlertCircle className="h-5 w-5 text-rose-500" />
                ) : (
                  <X
                    className="h-4 w-4 text-slate-300 cursor-pointer hover:text-rose-500 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFiles((p) => p.filter((f) => f.id !== file.id));
                    }}
                  />
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
