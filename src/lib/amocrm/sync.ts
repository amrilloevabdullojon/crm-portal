import { fetchAmoContact, fetchAmoDeal } from "@/lib/amocrm/client";
import { createAmoLeadNote } from "@/lib/amocrm/notes";
import {
  getEmbeddedContactIds,
  parseContactFromAmoApi,
  parseModulesFromAmoDeal,
} from "@/lib/amocrm/parser";
import { syncClinicFromAmo } from "@/lib/db/onboarding";
import { hasGoogleDriveConfig, ensureClinicDriveFolders } from "@/lib/google-drive/client";

async function getDealContacts(dealData: unknown) {
  const contacts = [];

  for (const contactId of getEmbeddedContactIds(dealData)) {
    try {
      const contactData = await fetchAmoContact(contactId);
      const contact = parseContactFromAmoApi(contactData);
      if (contact) contacts.push(contact);
    } catch (error) {
      console.warn(`amoCRM contact fetch failed for ${contactId}:`, error);
    }
  }

  return contacts;
}

export async function syncAmoDealToPortal(input: {
  dealId: number | string;
  writeAmoNote?: boolean;
  notePrefix?: string;
}) {
  const dealId = Number(input.dealId);

  if (!Number.isFinite(dealId)) {
    throw new Error("Invalid amoCRM deal id.");
  }

  const dealData = await fetchAmoDeal(String(dealId));
  const deal = dealData as { name?: string; id?: number | string } | null;
  const clinicName = deal?.name || `Сделка ${dealId}`;
  const modules = parseModulesFromAmoDeal(dealData);
  const contacts = await getDealContacts(dealData);
  let driveFolderUrl: string | null = null;

  if (hasGoogleDriveConfig()) {
    try {
      const driveFolders = await ensureClinicDriveFolders(clinicName);
      driveFolderUrl = driveFolders.clinicFolderUrl;
    } catch (error) {
      console.warn("Clinic Drive folder creation failed:", error);
    }
  }

  const clinic = await syncClinicFromAmo({
    amoDealId: dealId,
    name: clinicName,
    modules,
    contacts,
    driveFolderUrl,
  });

  if (input.writeAmoNote ?? true) {
    try {
      await createAmoLeadNote(
        dealId,
        [
          input.notePrefix || "DMED Portal: сделка синхронизирована.",
          `Клиника: ${clinic.name}`,
          `Контактов: ${clinic.contactsSynced}`,
          `Модулей: ${clinic.modulesSynced}`,
        ].join("\n"),
      );
    } catch (error) {
      console.warn("amoCRM sync note failed:", error);
    }
  }

  return {
    clinic,
    modules,
    contacts,
    driveFolderUrl,
  };
}
