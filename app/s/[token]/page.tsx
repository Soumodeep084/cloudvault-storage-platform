import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { Download, Eye, ShieldCheck, LockKeyhole } from "lucide-react";
import { db } from "@/lib/prisma";
import bcrypt from "bcryptjs";

function getClientIpFromHeaders(requestHeaders: Headers): string | null {
  const forwarded = requestHeaders.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || null;
  }

  const realIp = requestHeaders.get("x-real-ip");
  return realIp?.trim() || null;
}

function getShareAccessCookieName(shareId: string) {
  return `share_access_${shareId}`;
}

export default async function PublicSharePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }> | { token: string };
  searchParams?: Promise<{ error?: string }> | { error?: string };
}) {
  const { token } = await Promise.resolve(params);
  const resolvedSearchParams = await Promise.resolve(searchParams ?? {});

  const share = await db.share.findFirst({
    where: {
      shareLink: { endsWith: `/s/${token}` },
      isPublic: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    include: {
      file: {
        select: {
          id: true,
          userId: true,
          fileName: true,
          fileUrl: true,
          fileType: true,
          fileSize: true,
          isDeleted: true,
        },
      },
    },
  });

  if (!share || !share.file || share.file.isDeleted) {
    notFound();
  }

  const cookieStore = await cookies();
  const accessCookie = cookieStore.get(getShareAccessCookieName(share.id))?.value;
  const hasAccess = !share.password || accessCookie === token;

  async function unlockSharedFile(formData: FormData) {
    "use server";

    const passwordInput = String(formData.get("password") ?? "").trim();

    const latestShare = await db.share.findFirst({
      where: {
        shareLink: { endsWith: `/s/${token}` },
        isPublic: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: {
        id: true,
        password: true,
      },
    });

    if (!latestShare) {
      redirect(`/s/${token}?error=invalid-link`);
    }

    if (!latestShare.password) {
      redirect(`/s/${token}`);
    }

    const valid = await bcrypt.compare(passwordInput, latestShare.password);
    if (!valid) {
      redirect(`/s/${token}?error=invalid-password`);
    }

    const actionCookieStore = await cookies();
    actionCookieStore.set(getShareAccessCookieName(latestShare.id), token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
      path: "/",
    });

    redirect(`/s/${token}`);
  }

  if (!hasAccess) {
    const errorMessage = resolvedSearchParams.error === "invalid-password"
      ? "Incorrect password. Please try again."
      : null;

    return (
      <main className="min-h-screen bg-linear-to-b from-slate-50 via-white to-slate-100 px-4 py-8 sm:px-6 sm:py-14">
        <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <div className="mb-5 flex items-start gap-3">
            <div className="rounded-full bg-amber-100 p-2 text-amber-700">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Protected Shared File</h1>
              <p className="mt-1 text-sm text-slate-600">
                Enter the password shared by the sender to preview or download this file.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">File</p>
            <p className="mt-1 break-all text-base font-semibold text-slate-900">{share.file.fileName}</p>
          </div>

          <form action={unlockSharedFile} className="mt-4 space-y-3">
            <label className="block text-sm font-medium text-slate-700">Access password</label>
            <input
              type="password"
              name="password"
              required
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
              placeholder="Enter password"
            />

            {errorMessage && (
              <p className="text-sm text-rose-600">{errorMessage}</p>
            )}

            <button
              type="submit"
              className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-800"
            >
              Unlock file
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-linear-to-b from-slate-50 via-white to-slate-100 px-4 py-8 sm:px-6 sm:py-14">
      <div className="mx-auto w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <div className="mb-5 flex items-start gap-3 sm:mb-6">
          <div className="rounded-full bg-emerald-100 p-2 text-emerald-700">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Shared File Access</h1>
            <p className="mt-1 text-sm text-slate-600">
              This file was securely shared with you. You can preview it or download it directly.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">File</p>
          <p className="mt-1 break-all text-base font-semibold text-slate-900 sm:text-lg">{share.file.fileName}</p>
          <p className="mt-1 text-sm text-slate-600">
            {share.file.fileType || "Unknown type"}
            {typeof share.file.fileSize === "number" ? ` • ${share.file.fileSize} bytes` : ""}
          </p>
        </div>

        <div className="mt-5 grid gap-2 sm:mt-6 sm:grid-cols-2">
          <Link
            href={`/api/public-share/${encodeURIComponent(token)}/preview`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            <Eye className="h-4 w-4" />
            Preview File
          </Link>

          <Link
            href={`/api/public-share/${encodeURIComponent(token)}/download`}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-800"
          >
            <Download className="h-4 w-4" />
            Download File
          </Link>
        </div>
      </div>
    </main>
  );
}
