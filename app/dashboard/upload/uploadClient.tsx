"use client";

import { useState, useCallback, useRef } from "react";
import { Upload, X, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getPresignedUrl } from "@/app/actions/uploadActions";
import { Progress } from "@/components/ui/progress";
import { formatFileSize } from "@/lib/utils";
import { recordFileUpload } from "@/app/actions/fileActions";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface UploadingFile {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: "uploading" | "complete" | "error";
}

export default function UploadClient({ userId }: { userId: string }) {
  const [files, setFiles] = useState<UploadingFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startUpload = useCallback(
    async (file: File) => {
      const id = Math.random().toString(36).slice(2);

      setFiles((prev) => [
        ...prev,
        {
          id,
          name: file.name,
          size: file.size,
          progress: 0,
          status: "uploading",
        },
      ]);

      try {
        // 1. Get a Signed URL from the server (bypasses RLS)
        const { uploadUrl, path } = await getPresignedUrl(file.name, file.type);

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
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.send(file);

        await uploadPromise;

        // 3. Get the Public URL
        const {
          data: { publicUrl },
        } = supabase.storage.from("files").getPublicUrl(path);

        // 4. Sync to Prisma via Server Action
        const dbResult = await recordFileUpload({
          userId,
          fileName: file.name,
          fileUrl: publicUrl,
          fileSize: file.size,
          fileType: file.type || "unknown",
        });

        // Use bracket notation to bypass the "Property does not exist" error
        if (!dbResult.success) {
          // TypeScript will allow this because we aren't using dot notation
          const errorMessage =
            (dbResult as any).error || "Database synchronization failed";
          throw new Error(errorMessage);
        }

        // Success state remains the same
        setFiles((prev) =>
          prev.map((f) =>
            f.id === id ? { ...f, status: "complete", progress: 100 } : f,
          ),
        );
        toast.success(`${file.name} uploaded successfully!`);
      } catch (error: any) {
        console.error("Upload process error:", error);
        setFiles((prev) =>
          prev.map((f) => (f.id === id ? { ...f, status: "error" } : f)),
        );
        // Show the actual error message from the server if available
        toast.error(error.message || `Failed to upload ${file.name}`);
      }
    },
    [userId],
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files)
      Array.from(e.dataTransfer.files).forEach(startUpload);
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
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer ${
          dragOver
            ? "border-primary bg-primary/5 scale-[0.99]"
            : "border-slate-200 hover:border-primary/40 bg-white"
        }`}
      >
        <Upload className="h-10 w-10 text-primary mx-auto mb-4" />
        <p className="text-base font-semibold text-slate-900">
          Click or drag files to upload
        </p>
        <input
          type="file"
          ref={fileInputRef}
          multiple
          className="hidden"
          onChange={(e) =>
            e.target.files && Array.from(e.target.files).forEach(startUpload)
          }
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
