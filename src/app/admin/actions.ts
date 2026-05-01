"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAmoLeadNote } from "@/lib/amocrm/notes";
import { extractAmoWebhookInfo } from "@/lib/amocrm/parser";
import { syncAmoDealToPortal } from "@/lib/amocrm/sync";
import { getAdminClinic } from "@/lib/db/admin";
import { getIntegrationEventForRetry, updateIntegrationEvent } from "@/lib/db/integration-events";
import { acceptModule, logModuleActivity, requestModuleRevision } from "@/lib/db/modules";
import { getUserDisplayName } from "@/lib/db/users";
import { requireRole } from "@/lib/auth/guards";
import { deliverSlackMessage } from "@/lib/slack/client";
import { sendAccessRequestToSlack, sendSetupRequestToSlack } from "@/lib/slack/requests";

type AdminClinic = NonNullable<Awaited<ReturnType<typeof getAdminClinic>>>;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Неизвестная ошибка.";
}

function adminErrorRedirect(path: string, error: unknown): never {
  redirect(`${path}?error=${encodeURIComponent(errorMessage(error))}`);
}

function adminNoticeRedirect(path: string, notice: string): never {
  redirect(`${path}?notice=${encodeURIComponent(notice)}`);
}

export async function acceptModuleAction(formData: FormData) {
  const session = await requireRole(["admin", "manager"]);
  const moduleId = Number(formData.get("moduleId"));
  const clinicId = Number(formData.get("clinicId"));

  if (!Number.isFinite(moduleId)) {
    throw new Error("Invalid module id.");
  }

  await acceptModule({ moduleId, actorUserId: session.userId });
  revalidatePath("/admin");
  if (Number.isFinite(clinicId)) revalidatePath(`/admin/clinics/${clinicId}`);
  revalidatePath("/portal");
}

export async function requestRevisionAction(formData: FormData) {
  const session = await requireRole(["admin", "manager"]);
  const moduleId = Number(formData.get("moduleId"));
  const clinicId = Number(formData.get("clinicId"));
  const comment = String(formData.get("comment") ?? "").trim();

  if (!Number.isFinite(moduleId)) {
    throw new Error("Invalid module id.");
  }

  await requestModuleRevision({
    moduleId,
    actorUserId: session.userId,
    comment: comment || "Нужны правки по файлу.",
  });
  revalidatePath("/admin");
  if (Number.isFinite(clinicId)) revalidatePath(`/admin/clinics/${clinicId}`);
  revalidatePath("/portal");
}

function isGeneralInfoName(name: string) {
  const normalized = name.toLowerCase();
  return normalized.includes("общ") || normalized.includes("general");
}

function isGeneralInfoAccepted(clinic: AdminClinic) {
  return clinic.modules.some((module) => isGeneralInfoName(module.name) && module.status === "accepted");
}

function areAllModulesAccepted(clinic: AdminClinic) {
  return clinic.modules.length > 0 && clinic.modules.every((module) => module.status === "accepted");
}

export async function sendAccessRequestAction(formData: FormData) {
  const session = await requireRole(["admin", "manager"]);
  const clinicId = Number(formData.get("clinicId"));

  if (!Number.isFinite(clinicId)) {
    throw new Error("Invalid clinic id.");
  }

  const clinic = await getAdminClinic(clinicId);
  if (!clinic) {
    throw new Error("Clinic not found.");
  }

  if (!isGeneralInfoAccepted(clinic)) {
    throw new Error("General info must be accepted before requesting accesses.");
  }

  const managerName = await getUserDisplayName(session.userId);
  await sendAccessRequestToSlack({ clinic, managerName });
  await logModuleActivity({
    actorUserId: session.userId,
    clinicId: clinic.id,
    action: "slack.access_requested",
    details: { clinicName: clinic.name, amoDealId: clinic.amoDealId ?? null },
  });

  try {
    await createAmoLeadNote(
      clinic.amoDealId,
      `DMED Portal: отправлена срочная заявка на доступы в Slack.\nКлиника: ${clinic.name}\nМенеджер: ${managerName}`,
    );
  } catch (error) {
    console.warn("amoCRM access request note failed:", error);
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/clinics/${clinicId}`);
}

export async function sendSetupRequestAction(formData: FormData) {
  const session = await requireRole(["admin", "manager"]);
  const clinicId = Number(formData.get("clinicId"));
  const additionalInfo = String(formData.get("additionalInfo") ?? "").trim();

  if (!Number.isFinite(clinicId)) {
    throw new Error("Invalid clinic id.");
  }

  const clinic = await getAdminClinic(clinicId);
  if (!clinic) {
    throw new Error("Clinic not found.");
  }

  if (!areAllModulesAccepted(clinic)) {
    throw new Error("All modules must be accepted before setup request.");
  }

  const managerName = await getUserDisplayName(session.userId);
  await sendSetupRequestToSlack({ clinic, managerName, additionalInfo });
  await logModuleActivity({
    actorUserId: session.userId,
    clinicId: clinic.id,
    action: "slack.setup_requested",
    details: {
      clinicName: clinic.name,
      amoDealId: clinic.amoDealId ?? null,
      additionalInfo,
    },
  });

  try {
    await createAmoLeadNote(
      clinic.amoDealId,
      `DMED Portal: отправлена финальная заявка на настройку в Slack.\nКлиника: ${clinic.name}\nМенеджер: ${managerName}\nДоп. информация: ${additionalInfo || "не указана"}`,
    );
  } catch (error) {
    console.warn("amoCRM setup request note failed:", error);
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/clinics/${clinicId}`);
}

export async function syncAmoDealAction(formData: FormData) {
  const session = await requireRole(["admin", "manager"]);
  const dealId = Number(formData.get("dealId"));

  if (!Number.isFinite(dealId)) {
    adminErrorRedirect("/admin", new Error("Введите корректный amoCRM deal id."));
  }

  let clinicId: number | null = null;
  try {
    const result = await syncAmoDealToPortal({
      dealId,
      writeAmoNote: true,
      notePrefix: "DMED Portal: сделка синхронизирована вручную менеджером.",
    });

    await logModuleActivity({
      actorUserId: session.userId,
      clinicId: result.clinic.id,
      action: "amo.manual_sync",
      details: {
        amoDealId: dealId,
        modules: result.modules,
        contacts: result.contacts.map((contact) => ({ id: contact.id, phone: contact.phone, role: contact.role })),
      },
    });

    revalidatePath("/admin");
    revalidatePath(`/admin/clinics/${result.clinic.id}`);
    clinicId = result.clinic.id;
  } catch (error) {
    await logModuleActivity({
      actorUserId: session.userId,
      action: "amo.manual_sync_failed",
      details: { amoDealId: dealId, error: errorMessage(error) },
    });
    adminErrorRedirect("/admin", error);
  }

  adminNoticeRedirect(`/admin/clinics/${clinicId}`, "Сделка amoCRM синхронизирована.");
}

export async function retryIntegrationEventAction(formData: FormData) {
  const session = await requireRole(["admin", "manager"]);
  const eventId = Number(formData.get("eventId"));

  if (!Number.isFinite(eventId)) {
    adminErrorRedirect("/admin/events", new Error("Некорректный event id."));
  }

  const event = await getIntegrationEventForRetry(eventId);
  if (!event) {
    adminErrorRedirect("/admin/events", new Error("Событие не найдено."));
  }

  let successRedirectPath = "/admin/events";
  let successNotice = "Событие повторно обработано.";
  try {
    if (event.provider === "slack") {
      const text = typeof event.payload.text === "string" ? event.payload.text : "";
      if (!text) throw new Error("Slack event does not contain message text.");

      await deliverSlackMessage(text);
      await updateIntegrationEvent({ id: event.id, status: "processed" });
      await logModuleActivity({
        actorUserId: session.userId,
        action: "integration_event.retried",
        details: { eventId, provider: event.provider },
      });

      revalidatePath("/admin/events");
      successNotice = "Slack событие повторно отправлено.";
    } else if (event.provider === "amo") {
      const webhookInfo = extractAmoWebhookInfo(event.payload);
      const dealId = Number(webhookInfo.dealId);

      if (!Number.isFinite(dealId)) {
        throw new Error("amoCRM event does not contain a valid deal id.");
      }

      const result = await syncAmoDealToPortal({
        dealId,
        writeAmoNote: true,
        notePrefix: "DMED Portal: событие amoCRM повторно обработано менеджером.",
      });

      await updateIntegrationEvent({ id: event.id, status: "processed" });
      await logModuleActivity({
        actorUserId: session.userId,
        clinicId: result.clinic.id,
        action: "integration_event.retried",
        details: { eventId, provider: event.provider, amoDealId: dealId },
      });

      revalidatePath("/admin/events");
      revalidatePath("/admin");
      successRedirectPath = `/admin/clinics/${result.clinic.id}`;
      successNotice = "Событие amoCRM повторно обработано.";
    } else {
      throw new Error("Повтор пока поддерживается для amoCRM и Slack.");
    }
  } catch (error) {
    await updateIntegrationEvent({ id: event.id, status: "failed", errorMessage: errorMessage(error) });
    await logModuleActivity({
      actorUserId: session.userId,
      action: "integration_event.retry_failed",
      details: { eventId, provider: event.provider, error: errorMessage(error) },
    });
    adminErrorRedirect("/admin/events", error);
  }

  adminNoticeRedirect(successRedirectPath, successNotice);
}
