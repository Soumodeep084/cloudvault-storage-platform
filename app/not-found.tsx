import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
      <div className="text-center space-y-6">
        {/* Visual Icon */}
        <div className="flex justify-center">
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
            <FileQuestion className="h-12 w-12 text-primary animate-pulse" />
          </div>
        </div>

        {/* Text Content */}
        <div className="space-y-2">
          <h1 className="text-6xl font-black text-slate-900 tracking-tighter">
            404
          </h1>
          <h2 className="text-2xl font-bold text-slate-800">File Not Found</h2>
          <p className="max-w-75 mx-auto text-slate-500 text-sm font-medium">
            The page you are looking for doesn&apos;t exist or has been moved to
            another vault.
          </p>
        </div>

        {/* Navigation */}
        <div className="pt-4">
          <Button
            asChild
            className="font-semibold px-8 shadow-md transition-all hover:scale-105"
          >
            <Link href="/dashboard">Return to Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
