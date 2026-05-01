export const maxUploadBytes = 50 * 1024 * 1024;
export const maxUploadSizeLabel = "50 MB";
export const allowedUploadExtensionsLabel = "xlsx, xls, csv, pdf, docx, doc, png, jpg, txt";

const allowedExtensions = new Set([
  "csv",
  "doc",
  "docx",
  "jpeg",
  "jpg",
  "pdf",
  "png",
  "txt",
  "xls",
  "xlsx",
]);

const allowedMimeTypes = new Set([
  "application/csv",
  "application/msword",
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "text/csv",
  "text/plain",
]);

export const uploadAcceptAttribute = [
  ".csv",
  ".doc",
  ".docx",
  ".jpeg",
  ".jpg",
  ".pdf",
  ".png",
  ".txt",
  ".xls",
  ".xlsx",
].join(",");

function getExtension(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  return extension === fileName.toLowerCase() ? "" : extension;
}

export function validateUploadFile(file: File) {
  if (file.size > maxUploadBytes) {
    return {
      ok: false as const,
      error: `Файл слишком большой. Максимальный размер: ${maxUploadSizeLabel}.`,
    };
  }

  const extension = getExtension(file.name);
  const mimeType = file.type || "application/octet-stream";
  const extensionAllowed = allowedExtensions.has(extension);
  const mimeAllowed = mimeType === "application/octet-stream" || allowedMimeTypes.has(mimeType);

  if (!extensionAllowed || !mimeAllowed) {
    return {
      ok: false as const,
      error: `Этот тип файла не разрешен. Используйте ${allowedUploadExtensionsLabel}.`,
    };
  }

  return { ok: true as const };
}
