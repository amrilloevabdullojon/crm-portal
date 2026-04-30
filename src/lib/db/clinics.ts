import type { ClinicStatus, ModuleStatus, PortalClinic, PortalModule } from "@/lib/domain";
import { getSupabaseAdminClient, hasSupabaseAdminConfig } from "@/lib/db/supabase";
import { sampleClinic } from "@/lib/sample-data";

type ClinicRow = {
  id: number;
  name: string;
  status: ClinicStatus;
  drive_folder_url: string | null;
  clinic_modules: ModuleRow[];
};

type ModuleRow = {
  id: number;
  name: string;
  status: ModuleStatus;
  manager_comment: string | null;
  uploaded_files?: FileRow[];
};

type FileRow = {
  file_url: string;
};

function mapModule(row: ModuleRow): PortalModule {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    managerComment: row.manager_comment ?? undefined,
    currentFileUrl: row.uploaded_files?.[0]?.file_url,
  };
}

function mapClinic(row: ClinicRow): PortalClinic {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    modules: row.clinic_modules.map(mapModule),
  };
}

export async function getPortalClinic(clinicId = 1): Promise<PortalClinic> {
  if (!hasSupabaseAdminConfig()) return sampleClinic;

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("clinics")
    .select(`
      id,
      name,
      status,
      drive_folder_url,
      clinic_modules (
        id,
        name,
        status,
        manager_comment,
        uploaded_files (
          file_url
        )
      )
    `)
    .eq("id", clinicId)
    .eq("clinic_modules.uploaded_files.is_current", true)
    .single<ClinicRow>();

  if (error || !data) {
    console.warn("Falling back to sample clinic:", error?.message);
    return sampleClinic;
  }

  return mapClinic(data);
}

export async function listClinicsForAdmin(): Promise<PortalClinic[]> {
  if (!hasSupabaseAdminConfig()) return [sampleClinic];

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("clinics")
    .select(`
      id,
      name,
      status,
      drive_folder_url,
      clinic_modules (
        id,
        name,
        status,
        manager_comment,
        uploaded_files (
          file_url
        )
      )
    `)
    .eq("clinic_modules.uploaded_files.is_current", true)
    .order("created_at", { ascending: false })
    .returns<ClinicRow[]>();

  if (error || !data) {
    console.warn("Falling back to sample clinics:", error?.message);
    return [sampleClinic];
  }

  return data.map(mapClinic);
}
