import { db } from "@/lib/prisma";
import { toast } from "sonner";
import { getSessionUser } from "@/lib/auth-help";
import { formatFileSize, formatDate } from "@/lib/utils";
import { FileIcon } from "@/components/DashboardComponents/FileIcon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Copy } from "lucide-react";
import { mockFiles } from "@/lib/mock-data";
import { CopyButton } from "@/components/DashboardComponents/CopyButton";

export default async function SharedPage() {
  const user = await getSessionUser();

  //   const dbFiles = await db.file.findMany({
  //     where: {
  //       userId: user?.id,
  //       shares: { some: {} },
  //       isDeleted: false,
  //     },
  //     include: {
  //       shares: true,
  //     },
  //     orderBy: {
  //       createdAt: "desc",
  //     },
  //   });

  const sharedFiles = mockFiles.filter((file) => file.shared);

  //   return (
  //     <div className="space-y-6">
  //       <div className="px-2">
  //         <h1 className="text-2xl font-bold tracking-tight">Shared Files</h1>
  //         <p className="text-sm text-slate-500">{sharedFiles.length} links active</p>
  //       </div>

  //       {sharedFiles.length === 0 ? (
  //         <div className="text-center py-24 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
  //           <p className="text-slate-900 font-semibold">No shared files</p>
  //           <p className="text-sm text-slate-500">
  //             Links you generate will appear here.
  //           </p>
  //         </div>
  //       ) : (
  //         <div className="grid gap-3">
  //           {sharedFiles.map((file) => (
  //             <div
  //               key={file.id}
  //               className="flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-100 shadow-sm transition-hover hover:border-slate-200"
  //             >
  //               {/* Correctly mapping: fileType -> type */}
  //               <FileIcon type={file.fileType as any} />

  //               <div className="flex-1 min-w-0">
  //                 <p className="text-sm font-semibold text-slate-800 truncate">
  //                   {/* Correctly mapping: fileName -> name */}
  //                   {file.fileName}
  //                 </p>
  //                 <p className="text-[11px] text-slate-400 font-medium">
  //                   {/* Correctly mapping: fileSize -> size and createdAt -> uploadedAt */}
  //                   {formatFileSize(file.fileSize || 0)} · Created{" "}
  //                   {formatDate(file.createdAt)}
  //                 </p>
  //               </div>

  //               <Badge className="hidden sm:flex bg-emerald-50 text-emerald-600 border-none shadow-none hover:bg-emerald-50">
  //                 Active
  //               </Badge>

  //               <Button variant="ghost" size="icon" className="text-slate-400">
  //                 <Copy className="h-4 w-4" />
  //               </Button>

  //               {/* Optional: Add the actual link to the button */}
  //               <a
  //                 href={file.shares[0]?.shareLink}
  //                 target="_blank"
  //                 rel="noreferrer"
  //               >
  //                 <Button variant="ghost" size="icon" className="text-slate-400">
  //                   <ExternalLink className="h-4 w-4" />
  //                 </Button>
  //               </a>
  //             </div>
  //           ))}
  //         </div>
  //       )}
  //     </div>
  //   );
  // }

  return (
    <div className="space-y-6">
      <div className="px-2">
        <h1 className="text-2xl font-bold tracking-tight text-[#0f172a]">
          Shared Files
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {sharedFiles.length} files currently shared
        </p>
      </div>

      {sharedFiles.length === 0 ? (
        <div className="text-center py-24 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
          <p className="text-slate-900 font-semibold">No shared files</p>
          <p className="text-sm text-slate-500">
            Files you've shared will appear here.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {
            sharedFiles.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-100 shadow-sm transition-all hover:border-slate-200 hover:shadow-md group"
            >
              {/* File Icon with the boxed style we built */}
              <FileIcon type={file.type} />

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">
                  {file.name}
                </p>
                <p className="text-[11px] text-slate-400 font-medium">
                  {formatFileSize(file.size)} · Shared on{" "}
                  {formatDate(file.uploadedAt)}
                </p>
              </div>

              <Badge className="hidden sm:flex bg-emerald-50 text-emerald-600 border-none shadow-none hover:bg-emerald-100 transition-colors">
                Active
              </Badge>

              <div className="flex items-center gap-1">
                <CopyButton shareLink={file.shareLink} />

                {file.shareLink && (
                  <a
                    href={file.shareLink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
