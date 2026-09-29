import { redirect } from "next/navigation";
import FileManager from "@/components/files/file-manager";
import { PageHeader } from "@/components/dashboard/page-header";
import { getFileFolderForRole } from "@/lib/files";
import { getAuthContext } from "@/lib/supabase/auth";

export const metadata = {
  title: "My files | NextGen",
  description: "Upload and manage your private NextGen documents.",
};

const FILE_COLUMNS =
  "id, owner_id, owner_email, owner_name, folder, storage_path, file_name, mime_type, size_bytes, created_at";

export default async function DashboardFilesPage() {
  const { user, profile, supabase } = await getAuthContext();

  if (!user) {
    redirect("/login");
  }

  if (!profile || !supabase) {
    return null;
  }

  // Students always work inside the user folder.
  const folder = getFileFolderForRole(profile.role);

  const { data: files, error } = await supabase
    .from("files")
    .select(FILE_COLUMNS)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Documents"
        icon="folder"
        title="My files"
        description="Your private upload area. Only you can open these files."
      />
      <FileManager
        files={files || []}
        scope="user"
        folder={folder}
        userId={user.id}
        userName={profile.full_name || ""}
        userEmail={profile.email || user.email || ""}
        storageReady={!error}
      />
    </div>
  );
}
