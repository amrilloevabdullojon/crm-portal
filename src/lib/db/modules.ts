import type { ModuleStatus } from "@/lib/domain";
import { createAmoLeadNote } from "@/lib/amocrm/notes";
import { createIntegrationEvent, updateIntegrationEvent } from "@/lib/db/integration-events";
import { getSupabaseAdminClient, hasSupabaseAdminConfig } from "@/lib/db/supabase";
import { copyModuleFileToActualFolder, hasGoogleDriveConfig } from "@/lib/google-drive/client";
import { sendTrackedTelegramMessage } from "@/lib/telegram/client";

export type UpdateModuleStatusInput = {
  moduleId: number;
  status: ModuleStatus;
  managerComment?: string | null;
  acceptedByUserId?: number | null;
};

type ModuleReviewContext = {
  id: number;
  name: string;
  clinic_id: number;
  clinics: { id: number; name: string; amo_deal_id: number | null } | { id: number; name: string; amo_deal_id: number | null }[] | null;
  uploaded_files?: Array<{
    id: number;
    file_name: string;
    file_url: string;
    storage_file_id: string | null;
    uploaded_by_user_id: number | null;
  }> | null;
};

type UploadAuthor = {
  id: number;
  name: string | null;
  telegram_chat_id: string | null;
};

function first<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isGeneralInfoModule(moduleName: string) {
  const normalized = moduleName.toLowerCase();
  return normalized.includes("общ") || normalized.includes("general");
}

async function getModuleReviewContext(moduleId: number) {
  if (!hasSupabaseAdminConfig()) return null;

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("clinic_modules")
    .select(`
      id,
      name,
      clinic_id,
      clinics(id,name,amo_deal_id),
      uploaded_files(
        id,
        file_name,
        file_url,
        storage_file_id,
        uploaded_by_user_id
      )
    `)
    .eq("id", moduleId)
    .eq("uploaded_files.is_current", true)
    .maybeSingle<ModuleReviewContext>();

  if (error) {
    throw new Error(`Module review context query failed: ${error.message}`);
  }

  return data;
}

async function getUploadAuthor(userId?: number | null) {
  if (!hasSupabaseAdminConfig() || !userId) return null;

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("users")
    .select("id,name,telegram_chat_id")
    .eq("id", userId)
    .maybeSingle<UploadAuthor>();

  if (error) {
    throw new Error(`Upload author query failed: ${error.message}`);
  }

  return data;
}

async function notifyUploadAuthor(userId: number | null | undefined, text: string) {
  if (!process.env.TELEGRAM_BOT_TOKEN) return;

  const author = await getUploadAuthor(userId);
  if (!author?.telegram_chat_id) return;

  try {
    await sendTrackedTelegramMessage({
      chatId: author.telegram_chat_id,
      text,
      eventType: "client_notification",
      details: { recipientUserId: author.id },
    });
  } catch (error) {
    console.warn("Telegram module notification failed:", error);
  }
}

export async function updateModuleStatus(input: UpdateModuleStatusInput) {
  if (!hasSupabaseAdminConfig()) {
    return { ok: true, demo: true };
  }

  const patch: Record<string, string | number | null> = {
    status: input.status,
    manager_comment: input.managerComment ?? null,
    updated_at: new Date().toISOString(),
  };

  if (input.status === "accepted") {
    patch.accepted_at = new Date().toISOString();
    patch.accepted_by_user_id = input.acceptedByUserId ?? null;
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("clinic_modules").update(patch).eq("id", input.moduleId);

  if (error) {
    throw new Error(`Module status update failed: ${error.message}`);
  }

  return { ok: true, demo: false };
}

export async function logModuleActivity(input: {
  actorUserId?: number | null;
  clinicId?: number | null;
  moduleId?: number | null;
  action: string;
  details?: Record<string, unknown>;
}) {
  if (!hasSupabaseAdminConfig()) {
    return { ok: true, demo: true };
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("activity_log").insert({
    actor_user_id: input.actorUserId ?? null,
    clinic_id: input.clinicId ?? null,
    module_id: input.moduleId ?? null,
    action: input.action,
    details: input.details ?? {},
  });

  if (error) {
    throw new Error(`Activity log insert failed: ${error.message}`);
  }

  return { ok: true, demo: false };
}

export async function acceptModule(input: { moduleId: number; actorUserId?: number | null }) {
  if (!hasSupabaseAdminConfig()) {
    return { ok: true, demo: true };
  }

  const context = await getModuleReviewContext(input.moduleId);
  const clinic = first(context?.clinics);
  const currentFile = context?.uploaded_files?.[0];

  await updateModuleStatus({ moduleId: input.moduleId, status: "accepted", acceptedByUserId: input.actorUserId });

  if (context && isGeneralInfoModule(context.name)) {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase
      .from("clinics")
      .update({
        sla_started_at: new Date().toISOString(),
        status: "in_progress_sla",
        updated_at: new Date().toISOString(),
      })
      .eq("id", context.clinic_id);

    if (error) {
      throw new Error(`Clinic SLA start failed: ${error.message}`);
    }

    await logModuleActivity({
      moduleId: input.moduleId,
      clinicId: context.clinic_id,
      actorUserId: input.actorUserId,
      action: "sla.started",
      details: {
        moduleName: context.name,
        reason: "general_info_accepted",
      },
    });
  }

  let actualCopy: Awaited<ReturnType<typeof copyModuleFileToActualFolder>> | null = null;
  let actualCopyError: string | null = null;

  if (context && clinic && currentFile?.storage_file_id && hasGoogleDriveConfig()) {
    const event = await createIntegrationEvent({
      provider: "google_drive",
      eventType: "actual_copy",
      payload: {
        clinicId: context.clinic_id,
        moduleId: context.id,
        clinicName: clinic.name,
        moduleName: context.name,
        sourceFileId: currentFile.storage_file_id,
        fileName: currentFile.file_name,
      },
    });

    try {
      actualCopy = await copyModuleFileToActualFolder({
        clinicName: clinic.name,
        moduleName: context.name,
        sourceFileId: currentFile.storage_file_id,
        fileName: currentFile.file_name,
      });
      await updateIntegrationEvent({ id: event.id, status: "processed" });
    } catch (error) {
      actualCopyError = error instanceof Error ? error.message : "Unknown Google Drive copy error.";
      await updateIntegrationEvent({ id: event.id, status: "failed", errorMessage: actualCopyError });
      console.warn("Google Drive actual copy failed:", error);
    }
  }

  await logModuleActivity({
    moduleId: input.moduleId,
    clinicId: context?.clinic_id,
    actorUserId: input.actorUserId,
    action: "module.accepted",
    details: {
      actualCopy,
      actualCopyError,
      fileName: currentFile?.file_name,
      fileUrl: currentFile?.file_url,
    },
  });

  await notifyUploadAuthor(
    currentFile?.uploaded_by_user_id,
    `Ваш файл "${context?.name ?? "модуль"}" принят. Спасибо, данные прошли проверку.`,
  );

  try {
    await createAmoLeadNote(
      clinic?.amo_deal_id,
      `DMED Portal: файл принят.\nКлиника: ${clinic?.name ?? "не указана"}\nБлок: ${context?.name ?? "модуль"}\nФайл: ${currentFile?.file_name ?? "не указан"}`,
    );
  } catch (error) {
    console.warn("amoCRM accept note failed:", error);
  }

  return { ok: true, demo: false, actualCopy };
}

export async function requestModuleRevision(input: {
  moduleId: number;
  actorUserId?: number | null;
  comment: string;
}) {
  if (!hasSupabaseAdminConfig()) {
    return { ok: true, demo: true };
  }

  const context = await getModuleReviewContext(input.moduleId);
  const clinic = first(context?.clinics);
  const currentFile = context?.uploaded_files?.[0];

  await updateModuleStatus({
    moduleId: input.moduleId,
    status: "needs_revision",
    managerComment: input.comment || "Нужны правки по файлу.",
  });

  if (context && isGeneralInfoModule(context.name)) {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase
      .from("clinics")
      .update({
        sla_started_at: null,
        status: "data_collection",
        updated_at: new Date().toISOString(),
      })
      .eq("id", context.clinic_id);

    if (error) {
      throw new Error(`Clinic SLA reset failed: ${error.message}`);
    }

    await logModuleActivity({
      moduleId: input.moduleId,
      clinicId: context.clinic_id,
      actorUserId: input.actorUserId,
      action: "sla.reset",
      details: {
        moduleName: context.name,
        reason: "general_info_revision_requested",
        comment: input.comment,
      },
    });
  }

  await logModuleActivity({
    moduleId: input.moduleId,
    clinicId: context?.clinic_id,
    actorUserId: input.actorUserId,
    action: "module.revision_requested",
    details: { comment: input.comment },
  });

  await notifyUploadAuthor(
    currentFile?.uploaded_by_user_id,
    `Нужны правки по файлу "${context?.name ?? "модуль"}": ${input.comment}`,
  );

  try {
    await createAmoLeadNote(
      clinic?.amo_deal_id,
      `DMED Portal: нужны правки.\nКлиника: ${clinic?.name ?? "не указана"}\nБлок: ${context?.name ?? "модуль"}\nКомментарий: ${input.comment}`,
    );
  } catch (error) {
    console.warn("amoCRM revision note failed:", error);
  }

  return { ok: true, demo: false };
}
