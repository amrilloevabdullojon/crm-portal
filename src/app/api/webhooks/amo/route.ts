import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { fetchAmoContact, fetchAmoDeal } from "@/lib/amocrm/client";
import {
  extractAmoWebhookInfo,
  getAmoTargetStatusIds,
  getEmbeddedContactIds,
  parseContactFromAmoApi,
  parseModulesFromAmoDeal,
  parseWebhookContacts,
} from "@/lib/amocrm/parser";
import { createClinicFromAmo, getClinicByAmoDealId } from "@/lib/db/onboarding";
import { createIntegrationEvent, updateIntegrationEvent } from "@/lib/db/integration-events";
import { ensureClinicDriveFolders, hasGoogleDriveConfig } from "@/lib/google-drive/client";

export const runtime = "nodejs";

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) return false;

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function isAuthorizedWebhook(request: Request) {
  const expectedSecret = process.env.AMOCRM_WEBHOOK_SECRET;

  if (!expectedSecret) return true;

  const url = new URL(request.url);
  const receivedSecret = request.headers.get("x-amo-webhook-secret") || url.searchParams.get("secret");

  return Boolean(receivedSecret && safeEqual(receivedSecret, expectedSecret));
}

async function parseWebhookPayload(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const json = await request.json().catch(() => null);
    return json && typeof json === "object" ? (json as Record<string, unknown>) : {};
  }

  const formData = await request.formData();
  return Object.fromEntries(formData.entries()) as Record<string, unknown>;
}

async function getContacts(payload: Record<string, unknown>, dealData: unknown) {
  const webhookContacts = parseWebhookContacts(payload).filter((contact) => contact.phone);

  if (webhookContacts.length > 0) return webhookContacts;

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

export async function GET(request: Request) {
  if (!isAuthorizedWebhook(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized webhook." }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    endpoint: "amoCRM webhook",
    expectedMethod: "POST",
  });
}

export async function POST(request: Request) {
  if (!isAuthorizedWebhook(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized webhook." }, { status: 401 });
  }

  const payload = await parseWebhookPayload(request);
  const webhookInfo = extractAmoWebhookInfo(payload);
  const event = await createIntegrationEvent({
    provider: "amo",
    externalId: webhookInfo.dealId ? `deal:${webhookInfo.dealId}:${Date.now()}` : null,
    eventType: "lead_status",
    payload,
  });

  try {
    if (!webhookInfo.dealId) {
      await updateIntegrationEvent({ id: event.id, status: "ignored", errorMessage: "Missing deal id." });
      return NextResponse.json({ ok: true, ignored: true, reason: "missing_deal_id" });
    }

    const targetStatusIds = getAmoTargetStatusIds();
    const isTargetStatus = targetStatusIds.some((statusId) => String(webhookInfo.statusId) === String(statusId));
    if (targetStatusIds.length > 0 && webhookInfo.statusId && !isTargetStatus) {
      await updateIntegrationEvent({
        id: event.id,
        status: "ignored",
        errorMessage: `Status ${webhookInfo.statusId} does not match targets ${targetStatusIds.join(", ")}.`,
      });
      return NextResponse.json({
        ok: true,
        ignored: true,
        reason: "non_target_status",
        statusId: webhookInfo.statusId,
        targetStatusIds,
      });
    }

    const amoDealId = Number(webhookInfo.dealId);
    if (!Number.isFinite(amoDealId)) {
      await updateIntegrationEvent({ id: event.id, status: "ignored", errorMessage: "Invalid deal id." });
      return NextResponse.json({ ok: true, ignored: true, reason: "invalid_deal_id" });
    }

    const existingClinic = await getClinicByAmoDealId(amoDealId);
    if (existingClinic) {
      await updateIntegrationEvent({ id: event.id, status: "ignored", errorMessage: "Clinic already exists." });
      return NextResponse.json({
        ok: true,
        ignored: true,
        reason: "clinic_exists",
        clinicId: existingClinic.id,
      });
    }

    const dealData = await fetchAmoDeal(webhookInfo.dealId);
    const deal = dealData as { name?: string } | null;
    const clinicName = deal?.name || webhookInfo.dealName || `Сделка ${webhookInfo.dealId}`;
    const modules = parseModulesFromAmoDeal(dealData);
    const contacts = await getContacts(payload, dealData);
    let driveFolderUrl: string | null = null;

    if (hasGoogleDriveConfig()) {
      try {
        const driveFolders = await ensureClinicDriveFolders(clinicName);
        driveFolderUrl = driveFolders.clinicFolderUrl;
      } catch (error) {
        console.warn("Clinic Drive folder creation failed:", error);
      }
    }

    const clinic = await createClinicFromAmo({
      amoDealId,
      name: clinicName,
      modules,
      contacts,
      driveFolderUrl,
    });

    await updateIntegrationEvent({ id: event.id, status: "processed" });

    return NextResponse.json({
      ok: true,
      clinic,
      modules,
      contactsCreatedOrLinked: contacts.filter((contact) => contact.phone).length,
      driveFolderUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown amoCRM webhook error.";
    await updateIntegrationEvent({ id: event.id, status: "failed", errorMessage: message });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
