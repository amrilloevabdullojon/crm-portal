"use server";

import { revalidatePath } from "next/cache";
import { acceptModule, requestModuleRevision } from "@/lib/db/modules";
import { requireRole } from "@/lib/auth/guards";

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
