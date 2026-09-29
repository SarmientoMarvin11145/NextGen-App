import { formatFileSize } from "./format";
import {
  ALLOWED_FILE_TYPES,
  FILE_EXTENSION_TYPES,
  FILE_FOLDERS,
  FILE_MAX_SIZE,
  FILE_TYPE_LABELS,
} from "./constants";

// Administrators upload into the admin folder, everyone else into the user
// folder. The database and the storage policies enforce the same rule.
export function getFileFolderForRole(role) {
  return role === "admin" ? FILE_FOLDERS.admin : FILE_FOLDERS.user;
}

export function getFileExtension(fileName) {
  const name = String(fileName || "");
  const index = name.lastIndexOf(".");
  if (index <= 0 || index === name.length - 1) return "";
  return name.slice(index + 1).toLowerCase();
}

export function resolveMimeType(mimeType, fileName) {
  if (mimeType && ALLOWED_FILE_TYPES.includes(mimeType)) return mimeType;
  return FILE_EXTENSION_TYPES[getFileExtension(fileName)] || "application/octet-stream";
}

export function isAllowedFileType(mimeType, fileName) {
  return ALLOWED_FILE_TYPES.includes(resolveMimeType(mimeType, fileName));
}

export function sanitizeFileName(fileName) {
  const base = String(fileName || "file").split(/[\\/]/).pop() || "file";
  const cleaned = base
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  return (cleaned || "file").slice(-100);
}

// admin/<user id>/<timestamp>-<file> or user/<user id>/<timestamp>-<file>
export function buildStoragePath({ folder, userId, fileName }) {
  return `${folder}/${userId}/${Date.now()}-${sanitizeFileName(fileName)}`;
}

export function getFolderFromPath(path) {
  const [folder] = String(path || "").split("/");
  return folder === FILE_FOLDERS.admin ? FILE_FOLDERS.admin : FILE_FOLDERS.user;
}

export function getFileTypeLabel(mimeType, fileName) {
  const resolved = resolveMimeType(mimeType, fileName);
  if (FILE_TYPE_LABELS[resolved]) return FILE_TYPE_LABELS[resolved];
  const extension = getFileExtension(fileName);
  if (extension) return extension.toUpperCase().slice(0, 4);
  return "FILE";
}

// Picks the icon that best matches the uploaded file.
export function getFileKind(mimeType, fileName) {
  const resolved = resolveMimeType(mimeType, fileName);
  const extension = getFileExtension(fileName);

  if (resolved.startsWith("image/")) return "image";
  if (resolved === "application/pdf") return "pdf";
  if (resolved.startsWith("text/")) return "text";
  if (resolved.includes("zip")) return "archive";
  if (resolved.includes("word") || extension === "rtf") return "doc";
  if (resolved.includes("excel") || resolved.includes("spreadsheet") || extension === "csv") {
    return "sheet";
  }
  return "file";
}

// Returns an empty string when the file can be uploaded, otherwise a message
// that is ready to be shown to the person uploading.
export function validateUpload(file) {
  if (!file || typeof file.size !== "number") {
    return "Choose a file to upload.";
  }
  if (file.size === 0) {
    return `${file.name} is empty. Choose another file.`;
  }
  if (file.size > FILE_MAX_SIZE) {
    return `${file.name} is ${formatFileSize(file.size)}. The limit is ${formatFileSize(FILE_MAX_SIZE)}.`;
  }
  if (!isAllowedFileType(file.type, file.name)) {
    return `${file.name} is not an accepted file type.`;
  }
  return "";
}

export function getFilesSummary(files = []) {
  const totalBytes = files.reduce((total, file) => total + Number(file.size_bytes || 0), 0);
  return {
    count: files.length,
    size: formatFileSize(totalBytes),
  };
}
