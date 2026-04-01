"use client";

import { motion } from "framer-motion";
import { Cloud, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { usePathname } from "next/navigation";

const Hero = () => {
  const pathname = usePathname();

  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-linear-to-br from-primary/5 via-transparent to-primary/10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32 relative">
        <motion.div
          key={pathname} // ✅ force remount on route change
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center max-w-3xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Cloud className="h-4 w-4" /> Now with 15GB free storage
          </div>

          <h1 className="text-4xl md:text-6xl font-extrabold mb-6">
            Smart File Sharing <br /> & Backup Platform
          </h1>

          <p className="text-lg text-muted-foreground mb-8">
            Store, share, and access your files anywhere.
          </p>

          <div className="flex gap-4 justify-center">
            <Button asChild>
              <Link href="/signup">
                Get Started <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>

            <Button variant="outline" asChild>
              <Link href="/login">Sign In</Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;
