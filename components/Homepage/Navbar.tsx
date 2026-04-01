import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Cloud } from "lucide-react";

const Navbar = () => {
  const isAuthenticated = false; // Replace with actual auth logic
  return (
    <nav className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cloud className="h-7 w-7 text-primary" />
          <span className="text-xl font-bold">CloudVault</span>
        </div>
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <Button asChild>
              <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button variant="secondary" asChild>
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild>
                <Link href="/signup">Get Started</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
