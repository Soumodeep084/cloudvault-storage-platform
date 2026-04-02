"use client";

import { supabase } from "@/lib/supabase";
import { recordFileUpload } from "@/app/actions/fileActions"; // The action we made earlier
import { toast } from "sonner";

export const useFileUpload = (userId: string) => {
  const uploadFile = async (file: File) => {
    try {
      // 1. Create the path: userId folder + unique filename
      // We add a timestamp to prevent overwriting if they upload two "image.png"s
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${file.name}`;
      const filePath = `${userId}/${fileName}`;

      // 2. Upload to Supabase
      const { data, error } = await supabase.storage
        .from("files")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) throw error;

      // 3. Get the Signed URL (since the bucket is private)
      // Or get public URL if you decided to make the bucket public
      const {
        data: { publicUrl },
      } = supabase.storage.from("files").getPublicUrl(filePath);

      // 4. Record to PostgreSQL via Server Action
      const dbResult = await recordFileUpload({
        fileName: file.name,
        fileUrl: publicUrl,
        fileSize: file.size,
        fileType: file.type || fileExt || "unknown",
      });

      if (!dbResult.success) throw new Error("DB Sync Failed");

      toast.success("File stored in your vault!");
      return data;
    } catch (error: any) {
      toast.error(error.message || "Upload failed");
      return null;
    }
  };

  return { uploadFile };
};
