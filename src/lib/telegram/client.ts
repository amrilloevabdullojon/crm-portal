import { createIntegrationEvent, updateIntegrationEvent } from "@/lib/db/integration-events";

type TelegramReplyMarkup = {
  keyboard?: Array<Array<{ text: string; request_contact?: boolean }>>;
  resize_keyboard?: boolean;
  one_time_keyboard?: boolean;
  remove_keyboard?: boolean;
};

export function hasTelegramSendConfig() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

export async function sendTelegramMessage(
  chatId: string,
  text: string,
  options: { replyMarkup?: TelegramReplyMarkup } = {},
) {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured.");
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      ...(options.replyMarkup ? { reply_markup: options.replyMarkup } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(`Telegram sendMessage failed: ${response.status}`);
  }
}

export async function sendTrackedTelegramMessage(input: {
  chatId: string;
  text: string;
  eventType?: string;
  details?: Record<string, unknown>;
}) {
  const event = await createIntegrationEvent({
    provider: "telegram",
    eventType: input.eventType ?? "message",
    payload: {
      chatId: input.chatId,
      text: input.text,
      ...(input.details ?? {}),
    },
  });

  try {
    await sendTelegramMessage(input.chatId, input.text);
    await updateIntegrationEvent({ id: event.id, status: "processed" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Telegram delivery error.";
    await updateIntegrationEvent({ id: event.id, status: "failed", errorMessage: message });
    throw error;
  }
}
