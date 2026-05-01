"use server";

import { revalidatePath } from "next/cache";
import { getAdminClinic } from "@/lib/db/admin";
import { acceptModule, logModuleActivity, requestModuleRevision } from "@/lib/db/modules";
import { getUserDisplayName } from "@/lib/db/users";
import { requireRole } from "@/lib/auth/guards";
import { sendAccessRequestToSlack, sendSetupRequestToSlack } from "@/lib/slack/requests";

type AdminClinic = NonNullable<Awaited<ReturnType<typeof getAdminClinic>>>;

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

  revalidatePath("/admin");
  revalidatePath(`/admin/clinics/${clinicId}`);
}
