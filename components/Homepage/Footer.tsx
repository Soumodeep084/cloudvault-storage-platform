import Link from "next/link";
import Image from "next/image";

const Footer = () => {
  return (
    <footer className="border-t border-border bg-card/50 py-10">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 text-center sm:px-6 md:flex-row md:text-left lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/icon-cloudvault.png"
            alt="CloudVault Logo"
            width={48}
            height={48}
            className="h-10 w-10 sm:h-12 sm:w-12"
          />

          <span className="text-lg font-bold sm:text-xl">CloudVault</span>
        </Link>

        {/* Links */}
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <Link
            href="/login"
            className="transition-colors hover:text-foreground"
          >
            Login
          </Link>

          <Link
            href="/signup"
            className="transition-colors hover:text-foreground"
          >
            Sign Up
          </Link>
        </div>

        {/* Copyright */}
        <p className="text-sm text-muted-foreground">
          © 2026 CloudVault. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
