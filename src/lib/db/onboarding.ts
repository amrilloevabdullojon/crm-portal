import type { AmoContact } from "@/lib/amocrm/parser";
import { getSupabaseAdminClient } from "@/lib/db/supabase";

export type CreateClinicFromAmoInput = {
  amoDealId: number;
  name: string;
  modules: string[];
  contacts: AmoContact[];
  driveFolderUrl?: string | null;
};

function normalizeUserRole(role: string | null | undefined) {
  if (role === "admin" || role === "manager") return role;
  return "client";
}

export async function getClinicByAmoDealId(amoDealId: number) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("clinics")
    .select("id,name,amo_deal_id")
    .eq("amo_deal_id", amoDealId)
    .maybeSingle<{ id: number; name: string; amo_deal_id: number }>();

  if (error) {
    throw new Error(`Clinic lookup by amo deal id failed: ${error.message}`);
  }

  return data;
}

export async function createClinicFromAmo(input: CreateClinicFromAmoInput) {
  const supabase = getSupabaseAdminClient();

  const { data: clinic, error: clinicError } = await supabase
    .from("clinics")
    .insert({
      name: input.name,
      amo_deal_id: input.amoDealId,
      status: "data_collection",
      drive_folder_url: input.driveFolderUrl ?? null,
    })
    .select("id,name")
    .single<{ id: number; name: string }>();

  if (clinicError) {
    throw new Error(`Clinic create failed: ${clinicError.message}`);
  }

  for (const moduleName of input.modules) {
    const { data: template, error: templateError } = await supabase
      .from("module_templates")
      .upsert({ name: moduleName, is_active: true }, { onConflict: "name" })
      .select("id,name")
      .single<{ id: number; name: string }>();

    if (templateError) {
      throw new Error(`Module template upsert failed: ${templateError.message}`);
    }

    const { error: moduleError } = await supabase.from("clinic_modules").upsert(
      {
        clinic_id: clinic.id,
        template_id: template.id,
        name: moduleName,
        status: "collection",
      },
      { onConflict: "clinic_id,name" },
    );

    if (moduleError) {
      throw new Error(`Clinic module upsert failed: ${moduleError.message}`);
    }
  }

  for (const contact of input.contacts) {
    if (!contact.phone) continue;

    const { data: user, error: userError } = await supabase
      .from("users")
      .upsert(
        {
          phone: contact.phone,
          name: contact.name || contact.phone,
          role: normalizeUserRole(contact.role),
          is_active: true,
        },
        { onConflict: "phone" },
      )
      .select("id,phone,role")
      .single<{ id: number; phone: string; role: string }>();

    if (userError) {
      throw new Error(`User upsert failed for ${contact.phone}: ${userError.message}`);
    }

    const { error: linkError } = await supabase.from("clinic_users").upsert(
      {
        clinic_id: clinic.id,
        user_id: user.id,
        clinic_role: user.role === "client" ? "member" : user.role,
      },
      { onConflict: "clinic_id,user_id" },
    );

    if (linkError) {
      throw new Error(`Clinic user link failed for ${contact.phone}: ${linkError.message}`);
    }
  }

  await supabase.from("activity_log").insert({
    clinic_id: clinic.id,
    action: "clinic.created_from_amo",
    details: {
      amoDealId: input.amoDealId,
      modules: input.modules,
      contacts: input.contacts.map((contact) => ({
        id: contact.id,
        name: contact.name,
        phone: contact.phone,
        role: contact.role,
      })),
    },
  });

  return clinic;
}
