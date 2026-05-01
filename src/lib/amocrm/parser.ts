import { normalizePhone } from "@/lib/auth/phone";
import { extractAmoWebhookInfoFromPayload } from "@/lib/amocrm/webhook-info.mjs";

export type AmoContact = {
  id?: string | number;
  name: string;
  phone: string | null;
  role: string;
};

export type AmoWebhookAction = "status" | "add" | "update" | "unknown";

export type AmoWebhookInfo = {
  action: AmoWebhookAction;
  dealId: string | null;
  statusId: string | null;
  dealName: string | null;
};

const defaultModules = ["Общая информация", "Прайс"];
const validModules = new Set(["Общая информация", "Прайс", "ЛИС", "Врачи", "Услуги"]);

function parseStatusIds(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function getAmoTargetStatusIds() {
  const statusIds = parseStatusIds(process.env.AMOCRM_TARGET_STATUS_IDS);
  if (statusIds.length > 0) return statusIds;

  return parseStatusIds(process.env.AMOCRM_TARGET_STATUS_ID || "84088646");
}

export function extractAmoWebhookInfo(payload: Record<string, unknown>): AmoWebhookInfo {
  return extractAmoWebhookInfoFromPayload(payload) as AmoWebhookInfo;
}

function parseModulesFromText(value: unknown) {
  if (typeof value !== "string") return [];

  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => validModules.has(item));
}

export function parseModulesFromAmoDeal(dealData: unknown) {
  const modulesFieldId = process.env.AMOCRM_MODULES_FIELD_ID ? Number(process.env.AMOCRM_MODULES_FIELD_ID) : null;
  const deal = dealData as {
    custom_fields_values?: Array<{
      field_id?: number;
      field_name?: string;
      values?: Array<{ value?: unknown }>;
    }>;
  } | null;

  for (const field of deal?.custom_fields_values ?? []) {
    const fieldName = field.field_name?.toLowerCase() ?? "";
    const isModulesField = modulesFieldId ? field.field_id === modulesFieldId : fieldName.includes("модул");

    if (!isModulesField) continue;

    for (const value of field.values ?? []) {
      const modules = parseModulesFromText(value.value);
      if (modules.length > 0) return modules;
    }
  }

  return defaultModules;
}

export function parseWebhookContacts(payload: Record<string, unknown>) {
  const contacts: AmoContact[] = [];

  for (const action of ["add", "update"]) {
    for (let index = 0; index < 20; index++) {
      const prefix = `contacts[${action}][${index}]`;
      const id = payload[`${prefix}[id]`];

      if (!id) continue;

      let phone: string | null = null;

      for (let fieldIndex = 0; fieldIndex < 30; fieldIndex++) {
        const fieldPrefix = `${prefix}[custom_fields][${fieldIndex}]`;
        const code = payload[`${fieldPrefix}[code]`];
        const value = payload[`${fieldPrefix}[values][0][value]`];

        if ((code === "PHONE" || code === "TEL") && typeof value === "string") {
          phone = normalizePhone(value);
        }
      }

      contacts.push({
        id: typeof id === "string" || typeof id === "number" ? id : undefined,
        name: typeof payload[`${prefix}[name]`] === "string" ? String(payload[`${prefix}[name]`]) : "Сотрудник клиники",
        phone,
        role: "client",
      });
    }
  }

  return contacts;
}

export function parseContactFromAmoApi(contactData: unknown): AmoContact | null {
  const contact = contactData as {
    id?: string | number;
    name?: string;
    custom_fields_values?: Array<{
      field_code?: string;
      field_name?: string;
      values?: Array<{ value?: unknown }>;
    }>;
  } | null;

  if (!contact) return null;

  let phone: string | null = null;
  let role = "client";

  for (const field of contact.custom_fields_values ?? []) {
    if (field.field_code === "PHONE") {
      const value = field.values?.[0]?.value;
      if (typeof value === "string") phone = normalizePhone(value);
    }

    if (field.field_name?.toLowerCase().includes("должност")) {
      const value = String(field.values?.[0]?.value ?? "").toLowerCase();
      if (value.includes("директор") || value.includes("руководит")) role = "manager";
    }
  }

  if (!phone) return null;

  return {
    id: contact.id,
    name: contact.name || "Сотрудник клиники",
    phone,
    role,
  };
}

export function getEmbeddedContactIds(dealData: unknown) {
  const deal = dealData as {
    _embedded?: { contacts?: Array<{ id?: string | number }> };
  } | null;

  return (deal?._embedded?.contacts ?? [])
    .map((contact) => contact.id)
    .filter((id): id is string | number => Boolean(id));
}
