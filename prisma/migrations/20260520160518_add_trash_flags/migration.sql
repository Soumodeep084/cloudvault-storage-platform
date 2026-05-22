-- AlterTable
ALTER TABLE "File" ADD COLUMN     "isTrashed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Folder" ADD COLUMN     "isTrashed" BOOLEAN NOT NULL DEFAULT false;
