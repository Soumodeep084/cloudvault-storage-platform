import { mockFiles } from "@/lib/mock-data";
import { formatFileSize, formatDate } from "@/lib/utils";
import { FileIcon } from "@/components/DashboardComponents/FileIcon";
import { RestoreButton } from "@/components/DashboardComponents/RestoreButton";

export default function HistoryPage() {
  // Filter only files that actually have history
  const filesWithVersions = mockFiles.filter(
    (f) => f.versions && f.versions.length > 1,
  );

  return (
    <div className="space-y-6">
      <div className="px-2">
        <h1 className="text-2xl font-bold tracking-tight text-[#0f172a]">
          Version History
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Track and restore previous versions of your files
        </p>
      </div>

      {filesWithVersions.length === 0 ? (
        <div className="text-center py-24 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
          <p className="text-slate-900 font-semibold">No version history</p>
          <p className="text-sm text-slate-500">
            Files with multiple versions will appear here
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {filesWithVersions.map((file) => (
            <div
              key={file.id}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
            >
              {/* File Header */}
              <div className="flex items-center gap-3 p-4 bg-slate-50/50 border-b border-slate-100">
                <FileIcon type={file.type} />
                <span className="font-bold text-slate-800">{file.name}</span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 ml-auto bg-white px-2 py-1 rounded border border-slate-100">
                  {file.versions.length} versions
                </span>
              </div>

              {/* Versions List */}
              <div className="divide-y divide-slate-50">
                {file.versions.map((version, i) => (
                  <div
                    key={version.id}
                    className="flex items-center gap-4 p-5 hover:bg-slate-50/30 transition-colors"
                  >
                    {/* Timeline Visual */}
                    <div className="relative flex flex-col items-center">
                      <div
                        className={`h-3 w-3 rounded-full z-10 ring-4 ring-white ${
                          i === 0 ? "bg-primary" : "bg-slate-200"
                        }`}
                      />
                      {i < file.versions.length - 1 && (
                        <div className="absolute top-3 w-px h-12 bg-slate-100" />
                      )}
                    </div>

                    {/* Version Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-800 text-sm">
                          Version {version.version}
                          {i === 0 && (
                            <span className="ml-2 text-[10px] text-primary font-bold uppercase tracking-tighter bg-primary/10 px-1.5 py-0.5 rounded">
                              Latest
                            </span>
                          )}
                        </p>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 font-medium">
                        {version.changes} · {formatFileSize(version.size)} ·{" "}
                        {formatDate(version.createdAt)}
                      </p>
                    </div>

                    {/* Restore Action */}
                    {i > 0 && <RestoreButton version={version.version} />}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
