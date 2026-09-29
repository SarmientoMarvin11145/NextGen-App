"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Icon } from "@/components/ui/icon";
import {
  FILE_ACCEPT,
  FILE_BUCKET,
  FILE_FOLDERS,
  FILE_FOLDER_LABELS,
  FILE_MAX_SIZE,
} from "@/lib/constants";
import {
  buildStoragePath,
  getFileKind,
  getFileTypeLabel,
  getFilesSummary,
  resolveMimeType,
  validateUpload,
} from "@/lib/files";
import { formatDate, formatFileSize } from "@/lib/format";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { BTN, BTN_MD, BTN_PRIMARY, FIELD_ICON, MICRO, PANEL_LG } from "@/lib/ui";

const KIND_ICONS = {
  image: "image",
  pdf: "file",
  doc: "text",
  sheet: "sheet",
  archive: "archive",
  text: "text",
  file: "file",
};

const KIND_TONES = {
  image: "bg-violet-50 text-violet-700",
  pdf: "bg-rose-50 text-rose-600",
  doc: "bg-sky-50 text-sky-700",
  sheet: "bg-emerald-50 text-emerald-700",
  archive: "bg-amber-50 text-amber-700",
  text: "bg-slate-100 text-slate-600",
  file: "bg-slate-100 text-slate-600",
};

export default function FileManager({
  files = [],
  scope = "user",
  folder = FILE_FOLDERS.user,
  userId,
  userName = "",
  userEmail = "",
  storageReady = true,
  storageHint = "",
}) {
  const router = useRouter();
  const inputRef = useRef(null);
  const isAdminScope = scope === "admin";
  const [activeFolder, setActiveFolder] = useState(isAdminScope ? FILE_FOLDERS.admin : folder);
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dragging, setDragging] = useState(false);
  const [confirmingId, setConfirmingId] = useState("");
  const [downloadingId, setDownloadingId] = useState("");

  const targetFolder = isAdminScope ? activeFolder : folder;

  const folderCounts = useMemo(
    () => ({
      [FILE_FOLDERS.admin]: files.filter((file) => file.folder === FILE_FOLDERS.admin).length,
      [FILE_FOLDERS.user]: files.filter((file) => file.folder === FILE_FOLDERS.user).length,
    }),
    [files],
  );

  const visibleFiles = useMemo(() => {
    const term = query.trim().toLowerCase();

    return files
      .filter((file) => (isAdminScope ? file.folder === targetFolder : file.folder === folder))
      .filter((file) => {
        if (!term) return true;
        return (
          String(file.file_name).toLowerCase().includes(term) ||
          String(file.owner_name || "").toLowerCase().includes(term) ||
          String(file.owner_email || "").toLowerCase().includes(term)
        );
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [files, isAdminScope, targetFolder, folder, query]);

  const summary = getFilesSummary(visibleFiles);

  async function uploadFiles(fileList) {
    const list = Array.from(fileList || []);
    if (!list.length || pending) return;

    for (const file of list) {
      const message = validateUpload(file);
      if (message) {
        setError(message);
        setNotice("");
        return;
      }
    }

    setPending(true);
    setError("");
    setNotice("");

    const supabase = getSupabaseBrowserClient();
    const uploadedPaths = [];
    let uploadedCount = 0;

    try {
      for (const [index, file] of list.entries()) {
        setProgress(`Uploading ${index + 1} of ${list.length} · ${file.name}`);

        const path = buildStoragePath({ folder: targetFolder, userId, fileName: file.name });
        const mimeType = resolveMimeType(file.type, file.name);

        const { error: uploadError } = await supabase.storage
          .from(FILE_BUCKET)
          .upload(path, file, { contentType: mimeType, cacheControl: "3600", upsert: false });

        if (uploadError) throw uploadError;
        uploadedPaths.push(path);

        const { error: rowError } = await supabase.from("files").insert({
          owner_id: userId,
          owner_email: userEmail,
          owner_name: userName,
          folder: targetFolder,
          storage_path: path,
          file_name: String(file.name).slice(0, 180),
          mime_type: mimeType,
          size_bytes: file.size,
        });

        if (rowError) throw rowError;
        uploadedCount += 1;
      }

      setNotice(
        `${uploadedCount} ${uploadedCount === 1 ? "file" : "files"} uploaded to ${FILE_FOLDER_LABELS[targetFolder]}.`,
      );
      router.refresh();
    } catch (uploadFailure) {
      // Keep storage and the metadata table in sync if a step fails halfway.
      if (uploadedPaths.length) {
        await supabase.storage.from(FILE_BUCKET).remove(uploadedPaths);
      }
      setError(uploadFailure?.message || "The upload could not be completed.");
    } finally {
      setPending(false);
      setProgress("");
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleDownload(file) {
    if (downloadingId) return;
    setDownloadingId(file.id);
    setError("");

    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error: signError } = await supabase.storage
        .from(FILE_BUCKET)
        .createSignedUrl(file.storage_path, 120, { download: file.file_name });

      if (signError) throw signError;

      const link = document.createElement("a");
      link.href = data.signedUrl;
      link.download = file.file_name;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (downloadFailure) {
      setError(downloadFailure?.message || "The download link could not be created.");
    } finally {
      setDownloadingId("");
    }
  }

  async function handleDelete(file) {
    setPending(true);
    setError("");

    try {
      const supabase = getSupabaseBrowserClient();
      const { error: storageError } = await supabase.storage
        .from(FILE_BUCKET)
        .remove([file.storage_path]);

      if (storageError) throw storageError;

      const { error: rowError } = await supabase.from("files").delete().eq("id", file.id);

      if (rowError) throw rowError;

      setConfirmingId("");
      setNotice(`${file.file_name} was deleted.`);
      router.refresh();
    } catch (deleteFailure) {
      setError(deleteFailure?.message || "The file could not be deleted.");
    } finally {
      setPending(false);
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragging(false);
    uploadFiles(event.dataTransfer?.files);
  }

  return (
    <div className="space-y-5">
      {!storageReady ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm leading-6 text-amber-800">
          <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-bold">File storage is not ready yet</p>
            <p className="mt-1">
              {storageHint ||
                "Apply supabase/migrations/202609250003_create_file_storage.sql in the Supabase SQL editor, then refresh this page."}
            </p>
          </div>
        </div>
      ) : null}

      {isAdminScope ? (
        <div className="flex gap-1.5 rounded-2xl border border-slate-200/70 bg-slate-100/80 p-1.5">
          {[FILE_FOLDERS.admin, FILE_FOLDERS.user].map((value) => {
            const active = activeFolder === value;

            return (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setActiveFolder(value);
                  setQuery("");
                  setConfirmingId("");
                }}
                aria-pressed={active}
                className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition ${
                  active
                    ? "bg-white text-blue-700 shadow-[0_1px_2px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/5"
                    : "text-slate-600 hover:bg-white/70 hover:text-slate-900"
                }`}
              >
                <Icon name="folder" className="h-4.5 w-4.5 shrink-0" strokeWidth={1.9} />
                <span className="truncate">{FILE_FOLDER_LABELS[value]}</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${
                    active ? "bg-blue-50 text-blue-700" : "bg-white text-slate-500"
                  }`}
                >
                  {folderCounts[value]}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      <div className={`${PANEL_LG} p-4 sm:p-6`}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className={MICRO}>{FILE_FOLDER_LABELS[targetFolder]}</p>
            <h2 className="mt-1.5 text-base font-semibold tracking-[-0.02em] text-slate-900 tabular-nums">
              {summary.count} {summary.count === 1 ? "file" : "files"} · {summary.size}
            </h2>
          </div>
          <p className="text-xs font-medium tabular-nums text-slate-500">
            Maximum {formatFileSize(FILE_MAX_SIZE)} per file
          </p>
        </div>

        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`mt-4 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition sm:py-8 ${
            dragging
              ? "border-blue-500 bg-blue-50"
              : "border-slate-200 bg-slate-50/70 hover:border-blue-300"
          }`}
        >
          <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-100">
            <Icon name="upload" className="h-5 w-5" strokeWidth={1.9} />
          </span>
          <p className="mt-3 text-sm font-semibold text-slate-800">
            Upload to {FILE_FOLDER_LABELS[targetFolder]}
          </p>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-500">
            PDF, images, Word, Excel, text, and ZIP files. Tap to pick files on your phone or drop them here.
          </p>
          <label
            htmlFor="file-upload"
            className={`${BTN_PRIMARY} ${BTN_MD} mt-4 cursor-pointer ${
              pending || !storageReady ? "pointer-events-none opacity-60" : ""
            }`}
          >
            <Icon name={pending ? "loader" : "plus"} className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} />
            {pending ? "Uploading..." : "Choose files"}
          </label>
          <input
            ref={inputRef}
            id="file-upload"
            type="file"
            multiple
            accept={FILE_ACCEPT}
            className="sr-only"
            disabled={pending || !storageReady}
            onChange={(event) => uploadFiles(event.target.files)}
          />
          {progress ? (
            <p className="mt-3 truncate font-mono text-xs tabular-nums text-blue-700">{progress}</p>
          ) : null}
        </div>

        {error ? (
          <div
            role="alert"
            className="mt-4 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-5 text-rose-700"
          >
            <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="min-w-0 break-words">{error}</span>
          </div>
        ) : null}
        {notice ? (
          <div
            role="status"
            className="mt-4 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-5 text-blue-800"
          >
            <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.2} />
            <span className="min-w-0 break-words">{notice}</span>
          </div>
        ) : null}
      </div>

      <div className={`${PANEL_LG} p-4 sm:p-6`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative block w-full sm:max-w-xs">
            <span className="sr-only">Search files</span>
            <Icon
              name="search"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400"
              strokeWidth={1.9}
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by file name"
              className={FIELD_ICON}
            />
          </label>
          <button
            type="button"
            onClick={() => router.refresh()}
            className={`${BTN} ${BTN_MD} border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50/60 hover:text-blue-800`}
          >
            <Icon name="refresh" className="h-4 w-4" strokeWidth={1.9} />
            Refresh list
          </button>
        </div>

        <div className="mt-4">
          {visibleFiles.length ? (
            <ul className="divide-y divide-slate-100">
              {visibleFiles.map((file) => (
                <FileRow
                  key={file.id}
                  file={file}
                  isAdminScope={isAdminScope}
                  pending={pending}
                  downloading={downloadingId === file.id}
                  confirming={confirmingId === file.id}
                  onDownload={() => handleDownload(file)}
                  onDelete={() => handleDelete(file)}
                  onCancel={() => setConfirmingId("")}
                  onConfirm={() => setConfirmingId(file.id)}
                />
              ))}
            </ul>
          ) : (
            <EmptyState
              icon="folder"
              title={query ? "No files match your search" : "This folder is empty"}
              description={
                query
                  ? "Try a different file name or clear the search field."
                  : `Upload a document to ${FILE_FOLDER_LABELS[targetFolder]} and it will appear here.`
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}

// One file in the list. Declared as a function so it can be hoisted and used
// by the component above while staying easy to read on its own.
function FileRow({
  file,
  isAdminScope,
  pending,
  downloading,
  confirming,
  onDownload,
  onDelete,
  onCancel,
  onConfirm,
}) {
  const kind = getFileKind(file.mime_type, file.file_name);
  const typeLabel = getFileTypeLabel(file.mime_type, file.file_name);
  const showOwner = isAdminScope && file.folder === FILE_FOLDERS.user;

  return (
    <li className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
            KIND_TONES[kind] || KIND_TONES.file
          }`}
        >
          <Icon name={KIND_ICONS[kind] || "file"} className="h-5 w-5" strokeWidth={1.9} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900" title={file.file_name}>
            {file.file_name}
          </p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium tabular-nums text-slate-500">
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              {typeLabel}
            </span>
            <span>{formatFileSize(file.size_bytes)}</span>
            <span aria-hidden="true">·</span>
            <time dateTime={file.created_at}>{formatDate(file.created_at)}</time>
          </p>
          {showOwner ? (
            <p className="mt-1.5 truncate text-[11px] font-medium text-slate-500">
              Uploaded by {file.owner_name || file.owner_email}
            </p>
          ) : null}
        </div>
      </div>

      {confirming ? (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 sm:shrink-0">
          <span className="min-w-0 flex-1 text-xs font-semibold text-rose-700 sm:flex-none">
            Delete this file?
          </span>
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className="h-10 rounded-xl bg-rose-600 px-3.5 text-[13px] font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="h-10 rounded-xl px-3 text-[13px] font-semibold text-rose-700 transition hover:bg-white"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 sm:shrink-0">
          <button
            type="button"
            onClick={onDownload}
            disabled={downloading}
            aria-label={`Download ${file.file_name}`}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-[13px] font-semibold text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800 disabled:opacity-60 sm:h-10 sm:flex-none"
          >
            <Icon
              name={downloading ? "loader" : "download"}
              className={`h-4 w-4 ${downloading ? "animate-spin" : ""}`}
              strokeWidth={1.9}
            />
            <span className="sm:hidden">Download</span>
          </button>
          <button
            type="button"
            onClick={onConfirm}
            aria-label={`Delete ${file.file_name}`}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-[13px] font-semibold text-slate-600 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 sm:h-10 sm:flex-none"
          >
            <Icon name="trash" className="h-4 w-4" strokeWidth={1.9} />
            <span className="sm:hidden">Delete</span>
          </button>
        </div>
      )}
    </li>
  );
}



