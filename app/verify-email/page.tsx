import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth-help";
import VerifyEmailClient from "./verify-email-client";

type VerifyStatus = "success" | "expired" | "invalid" | "missing" | null;

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }> | { status?: string };
}) {
  const params = await Promise.resolve(searchParams);
  const status = (params?.status ?? null) as VerifyStatus;

  const sessionUser = await getSessionUser();
  if (!sessionUser && !status) redirect("/login");
  if (sessionUser?.isVerified) redirect("/dashboard");

  return (
    <VerifyEmailClient
      email={sessionUser?.email ?? null}
      status={status}
      canResend={Boolean(sessionUser && !sessionUser.isVerified)}
    />
  );
}
