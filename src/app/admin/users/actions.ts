"use server";

import { revalidatePath } from "next/cache";
import type { UserRole } from "@/lib/domain";
import { requireRole } from "@/lib/auth/guards";
import { logModuleActivity } from "@/lib/db/modules";
import {
  linkUserToClinic,
  unlinkTelegramChat,
  updateAdminUser,
  upsertAdminUser,
} from "@/lib/db/users";

function parseRole(value: FormDataEntryValue | null): UserRole {
  if (value === "admin" || value === "manager" || value === "client") return value;
  return "client";
}

function parseNumber(value: FormDataEntryValue | null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function createUserAction(formData: FormData) {
  const session = await requireRole(["admin"]);
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const role = parseRole(formData.get("role"));
  const clinicId = parseNumber(formData.get("clinicId"));

  const user = await upsertAdminUser({ name, phone, email, role });

  if (user.id && clinicId) {
    await linkUserToClinic({
      userId: user.id,
      clinicId,
      clinicRole: role === "client" ? "member" : role,
    });
  }

  await logModuleActivity({
    actorUserId: session.userId,
    action: "user.upserted",
    details: { userId: user.id, phone, role, clinicId },
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin");
}

export async function updateUserRoleAction(formData: FormData) {
  const session = await requireRole(["admin"]);
  const userId = parseNumber(formData.get("userId"));
  const role = parseRole(formData.get("role"));

  if (!userId) throw new Error("Invalid user id.");

  await updateAdminUser({ userId, role });
  await logModuleActivity({
    actorUserId: session.userId,
    action: "user.role_updated",
    details: { userId, role },
  });

  revalidatePath("/admin/users");
}

export async function setUserActiveAction(formData: FormData) {
  const session = await requireRole(["admin"]);
  const userId = parseNumber(formData.get("userId"));
  const isActive = String(formData.get("isActive")) === "true";

  if (!userId) throw new Error("Invalid user id.");

  await updateAdminUser({ userId, isActive });
  await logModuleActivity({
    actorUserId: session.userId,
    action: isActive ? "user.activated" : "user.deactivated",
    details: { userId },
  });

  revalidatePath("/admin/users");
}

export async function unlinkTelegramAction(formData: FormData) {
  const session = await requireRole(["admin"]);
  const userId = parseNumber(formData.get("userId"));

  if (!userId) throw new Error("Invalid user id.");

  await unlinkTelegramChat(userId);
  await logModuleActivity({
    actorUserId: session.userId,
    action: "user.telegram_unlinked",
    details: { userId },
  });

  revalidatePath("/admin/users");
}

export async function linkUserToClinicAction(formData: FormData) {
  const session = await requireRole(["admin"]);
  const userId = parseNumber(formData.get("userId"));
  const clinicId = parseNumber(formData.get("clinicId"));
  const clinicRole = String(formData.get("clinicRole") ?? "member").trim() || "member";

  if (!userId || !clinicId) throw new Error("Invalid user or clinic id.");

  await linkUserToClinic({ userId, clinicId, clinicRole });
  await logModuleActivity({
    actorUserId: session.userId,
    clinicId,
    action: "user.linked_to_clinic",
    details: { userId, clinicRole },
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/clinics/${clinicId}`);
}
