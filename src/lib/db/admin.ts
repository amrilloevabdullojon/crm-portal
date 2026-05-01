import type { ClinicStatus, ModuleStatus, UserRole } from "@/lib/domain";
import { getSupabaseAdminClient, hasSupabaseAdminConfig } from "@/lib/db/supabase";

export type AdminFile = {
  id: number;
  fileName: string;
  fileUrl: string;
  isCurrent: boolean;
  createdAt: string;
};

export type AdminModule = {
  id: number;
  name: string;
  status: ModuleStatus;
  managerComment?: string;
  createdAt: string;
  acceptedAt?: string;
  files: AdminFile[];
};

export type AdminClinicUser = {
  userId: number;
  name: string;
  phone: string;
  role: UserRole;
  clinicRole: string;
  telegramLinked: boolean;
};

export type AdminClinic = {
  id: number;
  name: string;
  status: ClinicStatus;
  amoDealId?: number;
  driveFolderUrl?: string;
  slaStartedAt?: string;
  createdAt: string;
  modules: AdminModule[];
  users: AdminClinicUser[];
};

export type IntegrationEventRow = {
  id: number;
  provider: string;
  externalId?: string;
  eventType?: string;
  status: "received" | "processed" | "failed" | "ignored";
  errorMessage?: string;
  createdAt: string;
  processedAt?: string;
};

type RawFile = {
  id: number;
  file_name: string;
  file_url: string;
  is_current: boolean;
  created_at: string;
};

type RawModule = {
  id: number;
  name: string;
  status: ModuleStatus;
  manager_comment: string | null;
  created_at: string;
  accepted_at: string | null;
  uploaded_files?: RawFile[] | null;
};

type RawClinicUser = {
  clinic_role: string;
  users:
    | {
        id: number;
        name: string | null;
        phone: string;
        role: UserRole;
        telegram_chat_id: string | null;
      }
    | Array<{
        id: number;
        name: string | null;
        phone: string;
        role: UserRole;
        telegram_chat_id: string | null;
      }>
    | null;
};

type RawClinic = {
  id: number;
  name: string;
  status: ClinicStatus;
  amo_deal_id: number | null;
  drive_folder_url: string | null;
  sla_started_at: string | null;
  created_at: string;
  clinic_modules?: RawModule[] | null;
  clinic_users?: RawClinicUser[] | null;
};

type RawIntegrationEvent = {
  id: number;
  provider: string;
  external_id: string | null;
  event_type: string | null;
  status: IntegrationEventRow["status"];
  error_message: string | null;
  created_at: string;
  processed_at: string | null;
};

function first<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function mapFile(row: RawFile): AdminFile {
  return {
    id: row.id,
    fileName: row.file_name,
    fileUrl: row.file_url,
    isCurrent: row.is_current,
    createdAt: row.created_at,
  };
}

function mapModule(row: RawModule): AdminModule {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    managerComment: row.manager_comment ?? undefined,
    createdAt: row.created_at,
    acceptedAt: row.accepted_at ?? undefined,
    files: (row.uploaded_files ?? []).map(mapFile).sort((left, right) => Number(right.isCurrent) - Number(left.isCurrent)),
  };
}

function mapClinic(row: RawClinic): AdminClinic {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    amoDealId: row.amo_deal_id ?? undefined,
    driveFolderUrl: row.drive_folder_url ?? undefined,
    slaStartedAt: row.sla_started_at ?? undefined,
    createdAt: row.created_at,
    modules: (row.clinic_modules ?? []).map(mapModule).sort((left, right) => left.id - right.id),
    users: (row.clinic_users ?? [])
      .map((clinicUser) => {
        const user = first(clinicUser.users);
        if (!user) return null;

        return {
          userId: user.id,
          name: user.name ?? user.phone,
          phone: user.phone,
          role: user.role,
          clinicRole: clinicUser.clinic_role,
          telegramLinked: Boolean(user.telegram_chat_id),
        };
      })
      .filter((user): user is AdminClinicUser => Boolean(user)),
  };
}

function mapEvent(row: RawIntegrationEvent): IntegrationEventRow {
  return {
    id: row.id,
    provider: row.provider,
    externalId: row.external_id ?? undefined,
    eventType: row.event_type ?? undefined,
    status: row.status,
    errorMessage: row.error_message ?? undefined,
    createdAt: row.created_at,
    processedAt: row.processed_at ?? undefined,
  };
}

export async function listAdminClinics(): Promise<AdminClinic[]> {
  if (!hasSupabaseAdminConfig()) return [];

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("clinics")
    .select(`
      id,
      name,
      status,
      amo_deal_id,
      drive_folder_url,
      sla_started_at,
      created_at,
      clinic_users (
        clinic_role,
        users (
          id,
          name,
          phone,
          role,
          telegram_chat_id
        )
      ),
      clinic_modules (
        id,
        name,
        status,
        manager_comment,
        created_at,
        accepted_at,
        uploaded_files (
          id,
          file_name,
          file_url,
          is_current,
          created_at
        )
      )
    `)
    .order("created_at", { ascending: false })
    .returns<RawClinic[]>();

  if (error || !data) {
    throw new Error(`Admin clinics query failed: ${error?.message}`);
  }

  return data.map(mapClinic);
}

export async function getAdminClinic(clinicId: number): Promise<AdminClinic | null> {
  if (!hasSupabaseAdminConfig()) return null;

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("clinics")
    .select(`
      id,
      name,
      status,
      amo_deal_id,
      drive_folder_url,
      sla_started_at,
      created_at,
      clinic_users (
        clinic_role,
        users (
          id,
          name,
          phone,
          role,
          telegram_chat_id
        )
      ),
      clinic_modules (
        id,
        name,
        status,
        manager_comment,
        created_at,
        accepted_at,
        uploaded_files (
          id,
          file_name,
          file_url,
          is_current,
          created_at
        )
      )
    `)
    .eq("id", clinicId)
    .maybeSingle<RawClinic>();

  if (error) {
    throw new Error(`Admin clinic query failed: ${error.message}`);
  }

  return data ? mapClinic(data) : null;
}

export async function listIntegrationEvents(limit = 50): Promise<IntegrationEventRow[]> {
  if (!hasSupabaseAdminConfig()) return [];

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("integration_events")
    .select("id,provider,external_id,event_type,status,error_message,created_at,processed_at")
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<RawIntegrationEvent[]>();

  if (error || !data) {
    throw new Error(`Integration events query failed: ${error?.message}`);
  }

  return data.map(mapEvent);
}
