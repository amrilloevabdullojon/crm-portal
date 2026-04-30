import { NextResponse } from "next/server";
import { getModuleUploadContext, recordModuleUpload } from "@/lib/db/files";
import { hasSupabaseAdminConfig } from "@/lib/db/supabase";
import { hasGoogleDriveConfig, uploadModuleFileToDrive } from "@/lib/google-drive/client";
import { authErrorResponse, requireSession } from "@/lib/auth/guards";

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
      return NextResponse.json({ ok: false, error: "Forbidden." }, { status: 403 });
    }

    const data = await file.arrayBuffer();
    const uploadedFile = await uploadModuleFileToDrive({
      clinicName: moduleContext.clinicName,
      moduleName: moduleContext.moduleName,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      data,
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
