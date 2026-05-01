import { Readable } from "node:stream";
import { google, type drive_v3 } from "googleapis";

export type DriveUploadInput = {
  clinicName: string;
  moduleName: string;
  fileName: string;
  mimeType: string;
  data: ArrayBuffer;
  version: number;
};

export type DriveUploadResult = {
  fileId: string;
  fileName: string;
  fileUrl: string;
  moduleFolderId: string;
};

export type DriveActualCopyInput = {
  clinicName: string;
  moduleName: string;
  sourceFileId: string;
  fileName: string;
};

export type ClinicDriveFolders = {
  clinicFolderId: string;
  clinicFolderUrl: string;
  uploadsFolderId: string;
  actualFolderId: string;
  internalFolderId: string;
};

const folderMimeType = "application/vnd.google-apps.folder";

let driveClient: drive_v3.Drive | null = null;

export function hasGoogleDriveConfig() {
  return Boolean(
    process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID &&
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
  );
}

function getPrivateKey() {
  return process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
}

function getDriveClient() {
  if (driveClient) return driveClient;

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = getPrivateKey();

  if (!clientEmail || !privateKey) {
    throw new Error("Google Drive service account env vars are not configured.");
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  driveClient = google.drive({ version: "v3", auth });
  return driveClient;
}

function escapeDriveQueryValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function safeDriveName(value: string) {
  return value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim() || "Untitled";
}

async function findFolder(drive: drive_v3.Drive, parentId: string, name: string) {
  const escapedName = escapeDriveQueryValue(name);
  const response = await drive.files.list({
    q: `'${parentId}' in parents and mimeType = '${folderMimeType}' and name = '${escapedName}' and trashed = false`,
    fields: "files(id,name,webViewLink)",
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
    pageSize: 1,
  });

  return response.data.files?.[0] ?? null;
}

async function getOrCreateFolder(drive: drive_v3.Drive, parentId: string, name: string) {
  const safeName = safeDriveName(name);
  const existing = await findFolder(drive, parentId, safeName);

  if (existing?.id) return existing.id;

  const response = await drive.files.create({
    requestBody: {
      name: safeName,
      mimeType: folderMimeType,
      parents: [parentId],
    },
    fields: "id,name,webViewLink",
    supportsAllDrives: true,
  });

  if (!response.data.id) {
    throw new Error(`Google Drive did not return an id for folder ${safeName}.`);
  }

  return response.data.id;
}

async function listFilesByNamePrefix(drive: drive_v3.Drive, parentId: string, prefix: string) {
  const escapedPrefix = escapeDriveQueryValue(prefix);
  const response = await drive.files.list({
    q: `'${parentId}' in parents and name contains '${escapedPrefix}' and trashed = false`,
    fields: "files(id,name)",
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
    pageSize: 100,
  });

  return response.data.files ?? [];
}

async function ensureModuleUploadFolder(input: Pick<DriveUploadInput, "clinicName" | "moduleName">) {
  const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;

  if (!rootFolderId) {
    throw new Error("GOOGLE_DRIVE_ROOT_FOLDER_ID is not configured.");
  }

  const drive = getDriveClient();
  const { uploadsFolderId } = await ensureClinicDriveFolders(input.clinicName);
  return getOrCreateFolder(drive, uploadsFolderId, input.moduleName);
}

export async function ensureClinicDriveFolders(clinicName: string): Promise<ClinicDriveFolders> {
  if (!hasGoogleDriveConfig()) {
    throw new Error("Google Drive env vars are not configured.");
  }

  const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;

  if (!rootFolderId) {
    throw new Error("GOOGLE_DRIVE_ROOT_FOLDER_ID is not configured.");
  }

  const drive = getDriveClient();
  const clinicFolderId = await getOrCreateFolder(drive, rootFolderId, clinicName);
  const actualFolderId = await getOrCreateFolder(drive, clinicFolderId, "02_Actual");
  const internalFolderId = await getOrCreateFolder(drive, clinicFolderId, "03_Internal");
  const uploadsFolderId = await getOrCreateFolder(drive, clinicFolderId, "01_Source Uploads");
  const clinicFolder = await drive.files.get({
    fileId: clinicFolderId,
    fields: "id,name,webViewLink",
    supportsAllDrives: true,
  });

  return {
    clinicFolderId,
    clinicFolderUrl: clinicFolder.data.webViewLink ?? `https://drive.google.com/drive/folders/${clinicFolderId}`,
    uploadsFolderId,
    actualFolderId,
    internalFolderId,
  };
}

function getTashkentStamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Tashkent",
    year: "numeric",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "00";

  return `${part("year")}${part("month")}${part("day")}_${part("hour")}${part("minute")}`;
}

function getFileExtension(fileName: string) {
  const safeName = safeDriveName(fileName);
  const dotIndex = safeName.lastIndexOf(".");

  if (dotIndex <= 0 || dotIndex === safeName.length - 1) return "";

  return safeName.slice(dotIndex).replace(/[^.\w-]/g, "");
}

function makeUploadFileName(input: Pick<DriveUploadInput, "fileName" | "moduleName" | "version">) {
  const blockName = safeDriveName(input.moduleName).replace(/\s+/g, "_");
  const extension = getFileExtension(input.fileName);

  return `${blockName}_v${input.version}_${getTashkentStamp()}${extension}`;
}

export async function uploadModuleFileToDrive(input: DriveUploadInput): Promise<DriveUploadResult> {
  if (!hasGoogleDriveConfig()) {
    throw new Error("Google Drive env vars are not configured.");
  }

  const drive = getDriveClient();
  const moduleFolderId = await ensureModuleUploadFolder(input);
  const uploadFileName = makeUploadFileName(input);

  const response = await drive.files.create({
    requestBody: {
      name: uploadFileName,
      parents: [moduleFolderId],
    },
    media: {
      mimeType: input.mimeType,
      body: Readable.from(Buffer.from(input.data)),
    },
    fields: "id,name,webViewLink",
    supportsAllDrives: true,
  });

  if (!response.data.id) {
    throw new Error("Google Drive did not return uploaded file id.");
  }

  return {
    fileId: response.data.id,
    fileName: response.data.name ?? uploadFileName,
    fileUrl: response.data.webViewLink ?? `https://drive.google.com/file/d/${response.data.id}/view`,
    moduleFolderId,
  };
}

export async function copyModuleFileToActualFolder(input: DriveActualCopyInput) {
  if (!hasGoogleDriveConfig()) {
    throw new Error("Google Drive env vars are not configured.");
  }

  const drive = getDriveClient();
  const { actualFolderId } = await ensureClinicDriveFolders(input.clinicName);
  const blockPrefix = `${safeDriveName(input.moduleName).replace(/\s+/g, "_")}_`;
  const existingFiles = await listFilesByNamePrefix(drive, actualFolderId, blockPrefix);

  await Promise.all(
    existingFiles
      .filter((file) => file.id)
      .map((file) => drive.files.delete({ fileId: file.id as string, supportsAllDrives: true })),
  );

  const response = await drive.files.copy({
    fileId: input.sourceFileId,
    requestBody: {
      name: safeDriveName(input.fileName),
      parents: [actualFolderId],
    },
    fields: "id,name,webViewLink",
    supportsAllDrives: true,
  });

  if (!response.data.id) {
    throw new Error("Google Drive did not return copied file id.");
  }

  return {
    fileId: response.data.id,
    fileName: response.data.name ?? input.fileName,
    fileUrl: response.data.webViewLink ?? `https://drive.google.com/file/d/${response.data.id}/view`,
    actualFolderId,
  };
}
