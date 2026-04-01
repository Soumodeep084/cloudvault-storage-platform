import { Cloud } from "lucide-react";

const Footer = () => {
  return (
    <footer className="border-t border-border bg-card py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <Cloud className="h-5 w-5 text-primary" />
            <span className="font-semibold">CloudVault</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © 2026 CloudVault. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
