import { Readable } from "node:stream";
import { google, type drive_v3 } from "googleapis";

export type DriveUploadInput = {
  clinicName: string;
  moduleName: string;
  fileName: string;
  mimeType: string;
  data: ArrayBuffer;
};

export type DriveUploadResult = {
  fileId: string;
  fileName: string;
  fileUrl: string;
  moduleFolderId: string;
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

function makeUploadFileName(fileName: string) {
  const safeName = safeDriveName(fileName);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${stamp}_${safeName}`;
}

export async function uploadModuleFileToDrive(input: DriveUploadInput): Promise<DriveUploadResult> {
  if (!hasGoogleDriveConfig()) {
    throw new Error("Google Drive env vars are not configured.");
  }

  const drive = getDriveClient();
  const moduleFolderId = await ensureModuleUploadFolder(input);
  const uploadFileName = makeUploadFileName(input.fileName);

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
