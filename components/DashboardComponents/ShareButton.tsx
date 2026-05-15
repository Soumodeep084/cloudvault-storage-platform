"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Share2, Copy, Mail, MessageCircle } from "lucide-react";

interface ShareButtonProps {
  fileName?: string;
  shareLink?: string;
}

const buildShareText = (fileName: string, shareLink: string) =>
  `Check out ${fileName} on CloudVault: ${shareLink}`;

const buildMailHref = (fileName: string, shareLink: string) => {
  const subject = encodeURIComponent(`Check out ${fileName}`);
  const body = encodeURIComponent(`I wanted to share this file with you:\n\n${fileName}\n${shareLink}`);
  return `mailto:?subject=${subject}&body=${body}`;
};

const buildWhatsAppHref = (fileName: string, shareLink: string) => {
  const text = encodeURIComponent(buildShareText(fileName, shareLink));
  return `https://wa.me/?text=${text}`;
};

const buildTelegramHref = (fileName: string, shareLink: string) => {
  const url = encodeURIComponent(shareLink);
  const text = encodeURIComponent(`Check out ${fileName}`);
  return `https://t.me/share/url?url=${url}&text=${text}`;
};

export function ShareButton({ fileName = "CloudVault file", shareLink }: ShareButtonProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const supportsNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  useEffect(() => {
    if (!menuOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [menuOpen]);

  const handleNativeShare = async () => {
    if (!shareLink) {
      toast.error("No share link available");
      return;
    }

    try {
      await navigator.share({
        title: fileName,
        text: buildShareText(fileName, shareLink),
        url: shareLink,
      });
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        toast.error("Unable to open share sheet");
      }
    }
  };

  const handleShareClick = async () => {
    if (!shareLink) {
      toast.error("No share link available");
      return;
    }

    if (supportsNativeShare) {
      await handleNativeShare();
      return;
    }

    setMenuOpen((value) => !value);
  };

  const handleCopy = async () => {
    if (!shareLink) {
      toast.error("No share link available");
      return;
    }

    await navigator.clipboard.writeText(shareLink);
    toast.success("Link copied to clipboard");
    setMenuOpen(false);
  };

  const menuItems = [
    {
      label: "Copy link",
      icon: Copy,
      action: handleCopy,
    },
    {
      label: "Email",
      icon: Mail,
      action: () => {
        window.open(buildMailHref(fileName, shareLink!), "_blank", "noopener,noreferrer");
        setMenuOpen(false);
      },
    },
    {
      label: "WhatsApp",
      icon: MessageCircle,
      action: () => {
        window.open(buildWhatsAppHref(fileName, shareLink!), "_blank", "noopener,noreferrer");
        setMenuOpen(false);
      },
    },
    {
      label: "Telegram",
      icon: MessageCircle,
      action: () => {
        window.open(buildTelegramHref(fileName, shareLink!), "_blank", "noopener,noreferrer");
        setMenuOpen(false);
      },
    },
  ];

  return (
    <div className="relative" ref={wrapperRef}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="text-slate-400 hover:text-slate-600"
        onClick={handleShareClick}
      >
        <Share2 className="h-4 w-4" />
      </Button>

      {!supportsNativeShare && menuOpen && (
        <div className="absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg ring-1 ring-slate-200">
          <div className="space-y-1 p-2">
            <p className="px-2 text-xs uppercase tracking-[0.2em] text-slate-500">
              Share link
            </p>
            {menuItems.map(({ label, icon: Icon, action }) => (
              <button
                key={label}
                type="button"
                onClick={action}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
              >
                <Icon className="h-4 w-4 text-slate-500" />
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
