import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { createClient } from "@supabase/supabase-js";

function loadDotEnvLocal() {
  if (!fs.existsSync(".env.local")) return;

  const raw = fs.readFileSync(".env.local", "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^(?:export\s+)?([^=\s]+)\s*=\s*(.*)$/);
    if (!match) continue;

    const key = match[1];
    let value = match[2].trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) process.env[key] = value;
  }
}

loadDotEnvLocal();

const importDir = process.argv[2] || process.env.LEGACY_IMPORT_DIR || "legacy-export";

const requiredFiles = {
  clinics: "Clinics_Deals.csv",
  users: "Clinic_Users.csv",
  modules: "Modules_Status.csv",
};

const clinicStatusMap = new Map([
  ["Сбор данных", "data_collection"],
  ["В работе (SLA)", "in_progress_sla"],
  ["Частично выданы", "partially_delivered"],
  ["Выполнено", "completed"],
]);

const moduleStatusMap = new Map([
  ["Сбор", "collection"],
  ["На проверке", "review"],
  ["Требуются правки", "needs_revision"],
  ["Принято", "accepted"],
]);

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function readCsv(fileName) {
  const filePath = path.join(importDir, fileName);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing CSV file: ${filePath}`);
  }

  return parse(fs.readFileSync(filePath, "utf8"), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  });
}

function normalizePhone(value) {
  const cleaned = String(value || "").replace(/[^\d+]/g, "");
  if (!cleaned) return null;
  if (cleaned.startsWith("+")) return `+${cleaned.slice(1).replace(/\D/g, "")}`;
  return `+${cleaned.replace(/\D/g, "")}`;
}

function normalizeRole(value) {
  const role = String(value || "").toLowerCase();
  if (role.includes("admin") || role.includes("админ")) return "admin";
  if (role.includes("manager") || role.includes("менедж")) return "manager";
  return "client";
}

function parseAmoId(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapClinicStatus(value) {
  return clinicStatusMap.get(String(value || "").trim()) || "data_collection";
}

function mapModuleStatus(value) {
  return moduleStatusMap.get(String(value || "").trim()) || "collection";
}

async function upsertClinic(supabase, row, legacyClinicMap) {
  const legacyId = row.id || row.ID || row.Record_ID || row.record_id;
  const amoDealId = parseAmoId(row.Amo_ID);
  const payload = {
    name: row.Name || "Unnamed clinic",
    amo_deal_id: amoDealId,
    status: mapClinicStatus(row.Status),
    drive_folder_url: row.Drive_Folder_URL || null,
    sla_started_at: row.SLA_Start_Date || null,
  };

  let result;

  if (amoDealId) {
    result = await supabase.from("clinics").upsert(payload, { onConflict: "amo_deal_id" }).select("id,name").single();
  } else {
    const existing = await supabase.from("clinics").select("id,name").eq("name", payload.name).maybeSingle();
    if (existing.error) throw new Error(`Clinic lookup failed for ${payload.name}: ${existing.error.message}`);

    result = existing.data
      ? await supabase.from("clinics").update(payload).eq("id", existing.data.id).select("id,name").single()
      : await supabase.from("clinics").insert(payload).select("id,name").single();
  }

  const { data, error } = result;
  if (error) throw new Error(`Clinic import failed for ${payload.name}: ${error.message}`);

  if (legacyId) legacyClinicMap.set(String(legacyId), data);
  legacyClinicMap.set(payload.name, data);

  return data;
}

async function upsertUser(supabase, row, legacyClinicMap, legacyUserMap) {
  const phone = normalizePhone(row.Phone);
  if (!phone) return null;

  const legacyId = row.id || row.ID || row.Record_ID || row.record_id;
  const clinicRef = row.Clinic ? String(row.Clinic) : "";
  const clinic = legacyClinicMap.get(clinicRef);

  const payload = {
    phone,
    name: row.Name || phone,
    role: normalizeRole(row.Role),
    telegram_chat_id: row.Telegram_ID || null,
    is_active: true,
  };

  const { data, error } = await supabase
    .from("users")
    .upsert(payload, { onConflict: "phone" })
    .select("id,phone,role")
    .single();

  if (error) throw new Error(`User import failed for ${phone}: ${error.message}`);

  if (legacyId) legacyUserMap.set(String(legacyId), data);
  legacyUserMap.set(phone, data);

  if (clinic?.id) {
    const { error: linkError } = await supabase.from("clinic_users").upsert(
      {
        clinic_id: clinic.id,
        user_id: data.id,
        clinic_role: payload.role === "client" ? "member" : payload.role,
      },
      { onConflict: "clinic_id,user_id" },
    );

    if (linkError) throw new Error(`Clinic user link failed for ${phone}: ${linkError.message}`);
  }

  return data;
}

async function ensureTemplate(supabase, name) {
  const { data, error } = await supabase
    .from("module_templates")
    .upsert({ name, is_active: true }, { onConflict: "name" })
    .select("id,name")
    .single();

  if (error) throw new Error(`Module template import failed for ${name}: ${error.message}`);
  return data;
}

async function upsertModule(supabase, row, legacyClinicMap) {
  const moduleName = row.Module_Name || row.Name;
  if (!moduleName) return null;

  const clinicRef = row.Clinic ? String(row.Clinic) : "";
  const clinic = legacyClinicMap.get(clinicRef);
  if (!clinic?.id) {
    console.warn(`Skipping module without clinic match: ${moduleName} / ${clinicRef}`);
    return null;
  }

  const template = await ensureTemplate(supabase, moduleName);
  const payload = {
    clinic_id: clinic.id,
    template_id: template.id,
    name: moduleName,
    status: mapModuleStatus(row.Status),
    manager_comment: row.CSM_Comment || null,
  };

  const { data, error } = await supabase
    .from("clinic_modules")
    .upsert(payload, { onConflict: "clinic_id,name" })
    .select("id,clinic_id,name")
    .single();

  if (error) throw new Error(`Module import failed for ${moduleName}: ${error.message}`);

  if (row.Last_File_URL) {
    const { error: fileError } = await supabase.from("uploaded_files").upsert(
      {
        clinic_id: clinic.id,
        module_id: data.id,
        file_name: row.Last_File_Name || `${moduleName} legacy file`,
        mime_type: null,
        file_size_bytes: null,
        storage_provider: "google_drive",
        storage_file_id: null,
        file_url: row.Last_File_URL,
        is_current: true,
      },
      { onConflict: "module_id,file_url" },
    );

    if (fileError) {
      console.warn(`File metadata import failed for ${moduleName}: ${fileError.message}`);
    }
  }

  return data;
}

async function main() {
  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  const clinics = readCsv(requiredFiles.clinics);
  const users = readCsv(requiredFiles.users);
  const modules = readCsv(requiredFiles.modules);

  const legacyClinicMap = new Map();
  const legacyUserMap = new Map();

  console.log(`Importing ${clinics.length} clinics...`);
  for (const row of clinics) await upsertClinic(supabase, row, legacyClinicMap);

  console.log(`Importing ${users.length} users...`);
  for (const row of users) await upsertUser(supabase, row, legacyClinicMap, legacyUserMap);

  console.log(`Importing ${modules.length} modules...`);
  for (const row of modules) await upsertModule(supabase, row, legacyClinicMap);

  console.log("Legacy CSV import finished.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
