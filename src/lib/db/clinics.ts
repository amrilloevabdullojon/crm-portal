import type { ClinicStatus, ModuleStatus, PortalClinic, PortalModule, PortalModuleFile } from "@/lib/domain";
import { getSupabaseAdminClient, hasSupabaseAdminConfig } from "@/lib/db/supabase";
import { sampleClinic } from "@/lib/sample-data";

type ClinicRow = {
  id: number;
  name: string;
  status: ClinicStatus;
  drive_folder_url: string | null;
  sla_started_at: string | null;
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
  id: number;
  file_name: string;
  file_size_bytes: number | null;
  file_url: string;
  is_current: boolean;
  created_at: string;
};

function mapFile(row: FileRow): PortalModuleFile {
  return {
    id: row.id,
    fileName: row.file_name,
    fileUrl: row.file_url,
    fileSizeBytes: row.file_size_bytes,
    isCurrent: row.is_current,
    createdAt: row.created_at,
  };
}

function mapModule(row: ModuleRow): PortalModule {
  const files = (row.uploaded_files ?? [])
    .map(mapFile)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  const currentFile = files.find((file) => file.isCurrent) ?? files[0];

  return {
    id: row.id,
    name: row.name,
    status: row.status,
    managerComment: row.manager_comment ?? undefined,
    currentFileUrl: currentFile?.fileUrl,
    currentFile,
    files,
  };
}

function mapClinic(row: ClinicRow): PortalClinic {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    slaStartedAt: row.sla_started_at ?? undefined,
    modules: row.clinic_modules.map(mapModule).sort((left, right) => left.id - right.id),
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
      sla_started_at,
      clinic_modules (
        id,
        name,
        status,
        manager_comment,
        uploaded_files (
          id,
          file_name,
          file_size_bytes,
          file_url,
          is_current,
          created_at
        )
      )
    `)
    .eq("id", clinicId)
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
      sla_started_at,
      clinic_modules (
        id,
        name,
        status,
        manager_comment,
        uploaded_files (
          id,
          file_name,
          file_size_bytes,
          file_url,
          is_current,
          created_at
        )
      )
    `)
    .order("created_at", { ascending: false })
    .returns<ClinicRow[]>();

  if (error || !data) {
    console.warn("Falling back to sample clinics:", error?.message);
    return [sampleClinic];
  }

  return data.map(mapClinic);
}
