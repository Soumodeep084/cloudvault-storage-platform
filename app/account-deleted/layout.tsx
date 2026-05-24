import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CloudVault - Account Deleted",
  description: "Secure cloud storage platform built with Next.js",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
