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

export async function syncClinicFromAmo(input: CreateClinicFromAmoInput) {
  const supabase = getSupabaseAdminClient();
  const existingClinic = await getClinicByAmoDealId(input.amoDealId);
  let clinic: { id: number; name: string };

  if (existingClinic) {
    const patch: Record<string, string | null> = {
      name: input.name,
      updated_at: new Date().toISOString(),
    };

    if (input.driveFolderUrl) patch.drive_folder_url = input.driveFolderUrl;

    const { data: updatedClinic, error: updateError } = await supabase
      .from("clinics")
      .update(patch)
      .eq("id", existingClinic.id)
      .select("id,name")
      .single<{ id: number; name: string }>();

    if (updateError || !updatedClinic) {
      throw new Error(`Clinic update failed: ${updateError?.message}`);
    }

    clinic = updatedClinic;
  } else {
    const { data: createdClinic, error: clinicError } = await supabase
      .from("clinics")
      .insert({
        name: input.name,
        amo_deal_id: input.amoDealId,
        status: "data_collection",
        drive_folder_url: input.driveFolderUrl ?? null,
      })
      .select("id,name")
      .single<{ id: number; name: string }>();

    if (clinicError || !createdClinic) {
      throw new Error(`Clinic create failed: ${clinicError?.message}`);
    }

    clinic = createdClinic;
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

    const { data: existingUser, error: existingUserError } = await supabase
      .from("users")
      .select("id,role")
      .eq("phone", contact.phone)
      .maybeSingle<{ id: number; role: string }>();

    if (existingUserError) {
      throw new Error(`Existing user lookup failed for ${contact.phone}: ${existingUserError.message}`);
    }

    const nextRole =
      existingUser?.role === "admin" || existingUser?.role === "manager"
        ? existingUser.role
        : normalizeUserRole(contact.role);
    const { data: user, error: userError } = await supabase
      .from("users")
      .upsert(
        {
          phone: contact.phone,
          name: contact.name || contact.phone,
          role: nextRole,
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
    action: existingClinic ? "clinic.synced_from_amo" : "clinic.created_from_amo",
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

  return {
    ...clinic,
    created: !existingClinic,
    contactsSynced: input.contacts.filter((contact) => contact.phone).length,
    modulesSynced: input.modules.length,
  };
}

export async function createClinicFromAmo(input: CreateClinicFromAmoInput) {
  return syncClinicFromAmo(input);
}
