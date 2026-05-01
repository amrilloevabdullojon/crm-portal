import type { ModuleStatus } from "@/lib/domain";
import { createAmoLeadNote } from "@/lib/amocrm/notes";
import { getSupabaseAdminClient, hasSupabaseAdminConfig } from "@/lib/db/supabase";
import { updateModuleStatus, logModuleActivity } from "@/lib/db/modules";
import { notifyManagers } from "@/lib/notifications";
import { sampleClinic } from "@/lib/sample-data";

export type ModuleUploadContext = {
  clinicId: number;
  clinicName: string;
  moduleId: number;
  moduleName: string;
  nextVersion: number;
  status: ModuleStatus;
  amoDealId?: number | null;
};

export type RecordModuleUploadInput = ModuleUploadContext & {
  uploadedByUserId?: number | null;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  storageFileId: string;
  fileUrl: string;
};

type ModuleContextRow = {
  id: number;
  name: string;
  clinic_id: number;
  status: ModuleStatus;
  clinics: { id: number; name: string; amo_deal_id: number | null } | { id: number; name: string; amo_deal_id: number | null }[] | null;
};

export async function getModuleUploadContext(moduleId: number): Promise<ModuleUploadContext | null> {
  if (!hasSupabaseAdminConfig()) {
    const portalModule = sampleClinic.modules.find((item) => item.id === moduleId);

    if (!portalModule) return null;

    return {
      clinicId: sampleClinic.id,
      clinicName: sampleClinic.name,
      moduleId: portalModule.id,
      moduleName: portalModule.name,
      nextVersion: 1,
      status: portalModule.status,
      amoDealId: null,
    };
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("clinic_modules")
    .select("id,name,clinic_id,status,clinics(id,name,amo_deal_id),uploaded_files(id)")
    .eq("id", moduleId)
    .single<ModuleContextRow & { uploaded_files?: { id: number }[] | null }>();

  if (error || !data) {
    console.warn("Module upload context lookup failed:", error?.message);
    return null;
  }

  const clinic = Array.isArray(data.clinics) ? data.clinics[0] : data.clinics;

  if (!clinic) return null;

  return {
    clinicId: data.clinic_id,
    clinicName: clinic.name,
    moduleId: data.id,
    moduleName: data.name,
    nextVersion: (data.uploaded_files?.length ?? 0) + 1,
    status: data.status,
    amoDealId: clinic.amo_deal_id,
  };
}

export async function recordModuleUpload(input: RecordModuleUploadInput) {
  if (!hasSupabaseAdminConfig()) {
    return { ok: true, demo: true };
  }

  const supabase = getSupabaseAdminClient();
  const { error: currentFilesError } = await supabase
    .from("uploaded_files")
    .update({ is_current: false })
    .eq("module_id", input.moduleId)
    .eq("is_current", true);

  if (currentFilesError) {
    throw new Error(`Current file update failed: ${currentFilesError.message}`);
  }

  const { error: insertError } = await supabase.from("uploaded_files").insert({
    clinic_id: input.clinicId,
    module_id: input.moduleId,
    uploaded_by_user_id: input.uploadedByUserId ?? null,
    file_name: input.fileName,
    mime_type: input.mimeType,
    file_size_bytes: input.fileSizeBytes,
    storage_provider: "google_drive",
    storage_file_id: input.storageFileId,
    file_url: input.fileUrl,
    is_current: true,
  });

  if (insertError) {
    throw new Error(`File metadata insert failed: ${insertError.message}`);
  }

  await updateModuleStatus({ moduleId: input.moduleId, status: "review", managerComment: null });
  await logModuleActivity({
    clinicId: input.clinicId,
    moduleId: input.moduleId,
    actorUserId: input.uploadedByUserId,
    action: "module.file_uploaded",
    details: {
      fileName: input.fileName,
      fileUrl: input.fileUrl,
      storageFileId: input.storageFileId,
    },
  });

  await notifyManagers({
    clinicId: input.clinicId,
    text: `Клиент загрузил файл для проверки: ${input.clinicName} · ${input.moduleName} · ${input.fileName}`,
  });

  try {
    await createAmoLeadNote(
      input.amoDealId,
      `DMED Portal: клиент загрузил файл для проверки.\nКлиника: ${input.clinicName}\nБлок: ${input.moduleName}\nФайл: ${input.fileName}`,
    );
  } catch (error) {
    console.warn("amoCRM upload note failed:", error);
  }

  return { ok: true, demo: false };
}
