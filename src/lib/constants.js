export const COURSES = [
  "BS Information Technology",
  "BS Computer Science",
];

export const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

// Keep this list deliberately small: every block selector and storage path
// uses the same three values.
export const BLOCKS = ["A", "B", "C"];

export const FILE_BUCKET = "nextgen-files";
export const FILE_MAX_SIZE = 10 * 1024 * 1024;

export const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/rtf",
  "application/zip",
  "application/x-zip-compressed",
];

// Every uploaded file lives inside one of these two top level folders so that
// administrators and students never share a namespace.
export const FILE_FOLDERS = {
  admin: "admin",
  user: "user",
};

export const FILE_FOLDER_LABELS = {
  admin: "Admin files",
  user: "User files",
};

export const FILE_FOLDER_DESCRIPTIONS = {
  admin: "Documents uploaded by administrators.",
  user: "Files uploaded by student accounts.",
};

// Browser accepted attribute for the file picker.
export const FILE_ACCEPT =
  ".pdf,.jpg,.jpeg,.png,.webp,.txt,.csv,.doc,.docx,.xls,.xlsx,.rtf,.zip";

// Some browsers report an empty or generic MIME type, so the extension is used
// to resolve the correct content type before uploading.
export const FILE_EXTENSION_TYPES = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  txt: "text/plain",
  csv: "text/csv",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  rtf: "application/rtf",
  zip: "application/zip",
};

export const FILE_TYPE_LABELS = {
  "application/pdf": "PDF",
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/webp": "WEBP",
  "text/plain": "TXT",
  "text/csv": "CSV",
  "application/msword": "DOC",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "application/vnd.ms-excel": "XLS",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
  "application/rtf": "RTF",
  "application/zip": "ZIP",
  "application/x-zip-compressed": "ZIP",
};