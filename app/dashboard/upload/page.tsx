"use client";

import { useState, useCallback } from "react";
import { Upload, X, FileText, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatFileSize } from "@/lib/utils";

// Local UI state interface
interface UploadingFile {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: "uploading" | "complete" | "error";
}

export default function UploadPage() {
  const [files, setFiles] = useState<UploadingFile[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const simulateUpload = useCallback((file: File) => {
    const id = Math.random().toString(36).slice(2);
    const uploadFile: UploadingFile = {
      id,
      name: file.name,
      size: file.size,
      progress: 0,
      status: "uploading",
    };
    setFiles((prev) => [...prev, uploadFile]);

    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 25;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setFiles((prev) =>
          prev.map((f) =>
            f.id === id ? { ...f, progress: 100, status: "complete" } : f,
          ),
        );
      } else {
        setFiles((prev) =>
          prev.map((f) => (f.id === id ? { ...f, progress } : f)),
        );
      }
    }, 300);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      Array.from(e.dataTransfer.files).forEach(simulateUpload);
    },
    [simulateUpload],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) Array.from(e.target.files).forEach(simulateUpload);
    },
    [simulateUpload],
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="px-2">
        <h1 className="text-2xl font-bold tracking-tight">Upload Files</h1>
        <p className="text-sm text-slate-500">
          Drag and drop files to your secure vault
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById("file-input")?.click()}
        className={`border-2 border-dashed rounded-2xl p-16 text-center transition-all cursor-pointer ${
          dragOver
            ? "border-primary bg-primary/5 scale-[0.99]"
            : "border-slate-200 hover:border-primary/50"
        }`}
      >
        <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          <Upload className="h-8 w-8 text-primary" />
        </div>
        <p className="text-lg font-semibold mb-1 text-slate-900">
          Drop files here
        </p>
        <p className="text-sm text-slate-500">
          or click to browse from your computer
        </p>
        <input
          id="file-input"
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      <div className="space-y-3">
        <AnimatePresence>
          {files.map((file) => (
            <motion.div
              key={file.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-100 shadow-sm"
            >
              <div className="p-2 bg-slate-50 rounded-lg">
                <FileText className="h-6 w-6 text-primary shrink-0" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-700 truncate">
                  {file.name}
                </p>
                <p className="text-[11px] text-slate-400 font-medium">
                  {formatFileSize(file.size)}
                </p>
                {file.status === "uploading" && (
                  <Progress
                    value={file.progress}
                    className="h-1 mt-2 bg-slate-100"
                  />
                )}
              </div>
              {file.status === "complete" ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setFiles((p) => p.filter((f) => f.id !== file.id))
                  }
                >
                  <X className="h-4 w-4 text-slate-400" />
                </Button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
