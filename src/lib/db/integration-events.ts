import { getSupabaseAdminClient, hasSupabaseAdminConfig } from "@/lib/db/supabase";

export type IntegrationEventStatus = "received" | "processed" | "failed" | "ignored";

export type IntegrationEventForRetry = {
  id: number;
  provider: "amo" | "telegram" | "slack" | "google_drive";
  externalId?: string | null;
  eventType?: string | null;
  payload: Record<string, unknown>;
  status: IntegrationEventStatus;
};

export async function createIntegrationEvent(input: {
  provider: "amo" | "telegram" | "slack" | "google_drive";
  externalId?: string | null;
  eventType?: string | null;
  payload: unknown;
}) {
  if (!hasSupabaseAdminConfig()) return { id: null, demo: true };

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("integration_events")
    .insert({
      provider: input.provider,
      external_id: input.externalId ?? null,
      event_type: input.eventType ?? null,
      payload: input.payload,
      status: "received",
    })
    .select("id")
    .single<{ id: number }>();

  if (error) {
    console.warn(`Integration event insert failed: ${error.message}`);
    return { id: null, demo: false };
  }

  return { id: data.id, demo: false };
}

export async function updateIntegrationEvent(input: {
  id: number | null;
  status: IntegrationEventStatus;
  errorMessage?: string | null;
}) {
  if (!input.id || !hasSupabaseAdminConfig()) return;

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("integration_events")
    .update({
      status: input.status,
      error_message: input.errorMessage ?? null,
      processed_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) {
    console.warn(`Integration event update failed: ${error.message}`);
  }
}

export async function getIntegrationEventForRetry(eventId: number): Promise<IntegrationEventForRetry | null> {
  if (!hasSupabaseAdminConfig()) return null;

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("integration_events")
    .select("id,provider,external_id,event_type,payload,status")
    .eq("id", eventId)
    .maybeSingle<{
      id: number;
      provider: IntegrationEventForRetry["provider"];
      external_id: string | null;
      event_type: string | null;
      payload: Record<string, unknown> | null;
      status: IntegrationEventStatus;
    }>();

  if (error) {
    throw new Error(`Integration event retry lookup failed: ${error.message}`);
  }

  if (!data) return null;

  return {
    id: data.id,
    provider: data.provider,
    externalId: data.external_id,
    eventType: data.event_type,
    payload: data.payload ?? {},
    status: data.status,
  };
}
