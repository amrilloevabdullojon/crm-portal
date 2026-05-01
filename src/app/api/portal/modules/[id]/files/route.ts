import { NextResponse } from "next/server";
import { createActivityLog } from "@/lib/db/activity";
import { getModuleUploadContext, recordModuleUpload } from "@/lib/db/files";
import { hasSupabaseAdminConfig } from "@/lib/db/supabase";
import { hasGoogleDriveConfig, uploadModuleFileToDrive } from "@/lib/google-drive/client";
import { authErrorResponse, requireSession } from "@/lib/auth/guards";
import { validateUploadFile } from "@/lib/file-policy";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    const moduleId = Number(id);

    if (!Number.isFinite(moduleId)) {
      return NextResponse.json({ ok: false, error: "Invalid module id." }, { status: 400 });
    }

    const formData = await request.formData().catch(() => null);
    const file = formData?.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "File is required." }, { status: 400 });
    }

    const fileValidation = validateUploadFile(file);
    if (!fileValidation.ok) {
      await createActivityLog({
        actorUserId: session.userId,
        moduleId,
        action: "module.upload_rejected",
        details: {
          reason: "invalid_file",
          fileName: file.name,
          fileSizeBytes: file.size,
          error: fileValidation.error,
        },
      });
      return NextResponse.json({ ok: false, error: fileValidation.error }, { status: 400 });
    }

    if (!hasSupabaseAdminConfig() || !hasGoogleDriveConfig()) {
      return NextResponse.json(
        {
          ok: false,
          error: "Supabase and Google Drive env vars are required for real uploads.",
          missing: {
            supabase: !hasSupabaseAdminConfig(),
            googleDrive: !hasGoogleDriveConfig(),
          },
        },
        { status: 501 },
      );
    }

    const moduleContext = await getModuleUploadContext(moduleId);

    if (!moduleContext) {
      return NextResponse.json({ ok: false, error: "Module not found." }, { status: 404 });
    }

    if (session.role === "client" && session.clinicId !== moduleContext.clinicId) {
      await createActivityLog({
        actorUserId: session.userId,
        clinicId: moduleContext.clinicId,
        moduleId,
        action: "module.upload_rejected",
        details: { reason: "forbidden" },
      });
      return NextResponse.json({ ok: false, error: "Forbidden." }, { status: 403 });
    }

    if (moduleContext.status === "accepted") {
      await createActivityLog({
        actorUserId: session.userId,
        clinicId: moduleContext.clinicId,
        moduleId,
        action: "module.upload_rejected",
        details: { reason: "accepted_module_locked" },
      });
      return NextResponse.json(
        { ok: false, error: "Этот модуль уже принят. Повторная загрузка заблокирована." },
        { status: 409 },
      );
    }

    const data = await file.arrayBuffer();
    const uploadedFile = await uploadModuleFileToDrive({
      clinicName: moduleContext.clinicName,
      moduleName: moduleContext.moduleName,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      data,
      version: moduleContext.nextVersion,
    });

    await recordModuleUpload({
      ...moduleContext,
      uploadedByUserId: session.userId,
      fileName: uploadedFile.fileName,
      mimeType: file.type || "application/octet-stream",
      fileSizeBytes: file.size,
      storageFileId: uploadedFile.fileId,
      fileUrl: uploadedFile.fileUrl,
    });

    return NextResponse.json({
      ok: true,
      moduleId,
      file: uploadedFile,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
