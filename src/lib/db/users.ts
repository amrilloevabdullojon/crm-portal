import type { UserRole } from "@/lib/domain";
import { normalizePhone } from "@/lib/auth/phone";
import { getSupabaseAdminClient, hasSupabaseAdminConfig } from "@/lib/db/supabase";

export type AdminUser = {
  id: number;
  name: string;
  phone: string;
  email?: string;
  role: UserRole;
  telegramLinked: boolean;
  isActive: boolean;
  createdAt: string;
  clinicLinks: Array<{
    clinicId: number;
    clinicName: string;
    clinicRole: string;
  }>;
};

type RawUser = {
  id: number;
  name: string | null;
  phone: string;
  email: string | null;
  role: UserRole;
  telegram_chat_id: string | null;
  is_active: boolean;
  created_at: string;
  clinic_users?: Array<{
    clinic_id: number;
    clinic_role: string;
    clinics: { id: number; name: string } | { id: number; name: string }[] | null;
  }> | null;
};

function first<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function mapUser(row: RawUser): AdminUser {
  return {
    id: row.id,
    name: row.name ?? row.phone,
    phone: row.phone,
    email: row.email ?? undefined,
    role: row.role,
    telegramLinked: Boolean(row.telegram_chat_id),
    isActive: row.is_active,
    createdAt: row.created_at,
    clinicLinks: (row.clinic_users ?? [])
      .map((link) => {
        const clinic = first(link.clinics);
        if (!clinic) return null;

        return {
          clinicId: clinic.id,
          clinicName: clinic.name,
          clinicRole: link.clinic_role,
        };
      })
      .filter((link): link is AdminUser["clinicLinks"][number] => Boolean(link)),
  };
}

export async function getUserDisplayName(userId: number) {
  if (!hasSupabaseAdminConfig()) return `User #${userId}`;

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("users")
    .select("name,phone")
    .eq("id", userId)
    .maybeSingle<{ name: string | null; phone: string | null }>();

  if (error) {
    throw new Error(`User query failed: ${error.message}`);
  }

  return data?.name || data?.phone || `User #${userId}`;
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  if (!hasSupabaseAdminConfig()) return [];

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("users")
    .select(`
      id,
      name,
      phone,
      email,
      role,
      telegram_chat_id,
      is_active,
      created_at,
      clinic_users (
        clinic_id,
        clinic_role,
        clinics (
          id,
          name
        )
      )
    `)
    .order("created_at", { ascending: false })
    .returns<RawUser[]>();

  if (error || !data) {
    throw new Error(`Admin users query failed: ${error?.message}`);
  }

  return data.map(mapUser);
}

export async function upsertAdminUser(input: {
  name: string;
  phone: string;
  email?: string | null;
  role: UserRole;
}) {
  if (!hasSupabaseAdminConfig()) return { id: null, demo: true };

  const phone = normalizePhone(input.phone);
  if (!phone) throw new Error("Phone is required.");

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("users")
    .upsert(
      {
        name: input.name.trim() || phone,
        phone,
        email: input.email?.trim() || null,
        role: input.role,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "phone" },
    )
    .select("id")
    .single<{ id: number }>();

  if (error || !data) {
    throw new Error(`User upsert failed: ${error?.message}`);
  }

  return { id: data.id, demo: false };
}

export async function updateAdminUser(input: {
  userId: number;
  name?: string | null;
  role?: UserRole | null;
  isActive?: boolean | null;
}) {
  if (!hasSupabaseAdminConfig()) return { ok: true, demo: true };

  const patch: Record<string, string | boolean> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof input.name === "string") patch.name = input.name.trim();
  if (input.role) patch.role = input.role;
  if (typeof input.isActive === "boolean") patch.is_active = input.isActive;

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("users").update(patch).eq("id", input.userId);

  if (error) {
    throw new Error(`User update failed: ${error.message}`);
  }

  return { ok: true, demo: false };
}

export async function unlinkTelegramChat(userId: number) {
  if (!hasSupabaseAdminConfig()) return { ok: true, demo: true };

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("users")
    .update({ telegram_chat_id: null, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) {
    throw new Error(`Telegram unlink failed: ${error.message}`);
  }

  return { ok: true, demo: false };
}

export async function linkUserToClinic(input: { userId: number; clinicId: number; clinicRole: string }) {
  if (!hasSupabaseAdminConfig()) return { ok: true, demo: true };

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("clinic_users").upsert(
    {
      user_id: input.userId,
      clinic_id: input.clinicId,
      clinic_role: input.clinicRole || "member",
    },
    { onConflict: "clinic_id,user_id" },
  );

  if (error) {
    throw new Error(`Clinic user link failed: ${error.message}`);
  }

  return { ok: true, demo: false };
}
