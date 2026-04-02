import { getSessionUser } from "@/lib/auth-help";
import { redirect } from "next/navigation";
import UploadClient from "./uploadClient";

export default async function UploadPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Pass the verified userId from the JWT to the Client Component */}
      <UploadClient userId={user.id} />
    </div>
  );
}
