"use server"
import { supabaseAdmin } from "@/lib/supabase"; // Use the admin client with Service Key
import { getSessionUser } from "@/lib/auth-help";

export async function getPresignedUrl(fileName: string) {
    const user = await getSessionUser();
    if (!user) throw new Error("Unauthorized");

    const path = `${user.id}/${Date.now()}-${fileName}`;

    // Generate a signed URL for uploading (valid for 5 minutes)
    const { data, error } = await supabaseAdmin.storage
        .from("files")
        .createSignedUploadUrl(path);

    if (error) throw error;

    return {
        uploadUrl: data.signedUrl,
        path: data.path, // This is the path we need for the public URL later
        token: data.token
    };
}