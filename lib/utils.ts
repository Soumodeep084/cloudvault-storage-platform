import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatFileSize(bytes: number | bigint): string {
  const normalizedBytes = typeof bytes === "bigint" ? bytes : BigInt(Math.max(0, Math.floor(bytes)));
  if (normalizedBytes <= BigInt(0)) return "0 B";

  const sizes = ["B", "KB", "MB", "GB", "TB", "PB", "EB"];
  let unitIndex = 0;
  let unitFactor = BigInt(1);

  while (unitIndex < sizes.length - 1 && normalizedBytes >= unitFactor * BigInt(1024)) {
    unitFactor *= BigInt(1024);
    unitIndex += 1;
  }

  if (unitIndex === 0) {
    return `${normalizedBytes} B`;
  }

  const scaledTenths = (normalizedBytes * BigInt(10) + unitFactor / BigInt(2)) / unitFactor;
  const whole = scaledTenths / BigInt(10);
  const fraction = scaledTenths % BigInt(10);

  return `${whole}.${fraction} ${sizes[unitIndex]}`;
}

export function formatDate(date: string | Date) {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateTime(date: string | Date) {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}