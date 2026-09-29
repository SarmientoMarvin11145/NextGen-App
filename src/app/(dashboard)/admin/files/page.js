import { redirect } from "next/navigation";
import FileManager from "@/components/files/file-manager";
import { PageHeader } from "@/components/dashboard/page-header";
import { FILE_FOLDERS } from "@/lib/constants";
import { getAuthContext } from "@/lib/supabase/auth";

export const metadata = {
  title: "File management | NextGen",
  description: "Manage admin documents and student uploads.",
};

const FILE_COLUMNS =
  "id, owner_id, owner_email, owner_name, folder, storage_path, file_name, mime_type, size_bytes, created_at";

export default async function AdminFilesPage() {
  const { user, profile, supabase } = await getAuthContext();

  if (!user) {
    redirect("/login");
  }

  if (!profile || !supabase) {
    return null;
  }

  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  // The admin select policy exposes both folders in a single query.
  const { data: files, error } = await supabase
    .from("files")
    .select(FILE_COLUMNS)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="File management"
        icon="folder"
        tone="indigo"
        title="Documents"
        description="Admin uploads live in the admin folder. Every student upload lives in that student's own folder."
      />
      <FileManager
        files={files || []}
        scope="admin"
        folder={FILE_FOLDERS.admin}
        userId={user.id}
        userName={profile.full_name || ""}
        userEmail={profile.email || user.email || ""}
        storageReady={!error}
      />
    </div>
  );
}
