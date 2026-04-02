import { FileText, Image, Video, FileSpreadsheet, Archive, File } from 'lucide-react';
import { FileItem } from '@/types/index';

const iconMap = {
  pdf: FileText,
  document: FileText,
  image: Image,
  video: Video,
  spreadsheet: FileSpreadsheet,
  archive: Archive,
  other: File,
};

const colorMap = {
  pdf: 'text-destructive',
  document: 'text-primary',
  image: 'text-success',
  video: 'text-warning',
  spreadsheet: 'text-success',
  archive: 'text-muted-foreground',
  other: 'text-muted-foreground',
};

export function FileIcon({ type, className = 'h-5 w-5' }: { type: FileItem['type']; className?: string }) {
  const Icon = iconMap[type] || File;
  const color = colorMap[type] || '';
  return <Icon className={`${className} ${color}`} />;
}
