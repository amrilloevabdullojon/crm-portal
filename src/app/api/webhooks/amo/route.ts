import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  extractAmoWebhookInfo,
} from "@/lib/amocrm/parser";
import { syncAmoDealToPortal } from "@/lib/amocrm/sync";
import { createIntegrationEvent, updateIntegrationEvent } from "@/lib/db/integration-events";
import { getAmoStatusSettings } from "@/lib/db/settings";

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

    const { targetStatusIds } = await getAmoStatusSettings();
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

    const syncResult = await syncAmoDealToPortal({
      dealId: amoDealId,
      writeAmoNote: true,
      notePrefix: "DMED Portal: сделка обработана webhook-ом.",
    });

    await updateIntegrationEvent({ id: event.id, status: "processed" });

    return NextResponse.json({
      ok: true,
      clinic: syncResult.clinic,
      modules: syncResult.modules,
      contactsCreatedOrLinked: syncResult.contacts.filter((contact) => contact.phone).length,
      driveFolderUrl: syncResult.driveFolderUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown amoCRM webhook error.";
    await updateIntegrationEvent({ id: event.id, status: "failed", errorMessage: message });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
