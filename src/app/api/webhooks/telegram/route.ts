import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { normalizePhone } from "@/lib/auth/phone";
import { getSupabaseAdminClient, hasSupabaseAdminConfig } from "@/lib/db/supabase";
import { createIntegrationEvent, updateIntegrationEvent } from "@/lib/db/integration-events";
import { sendTelegramMessage } from "@/lib/telegram/client";

export const runtime = "nodejs";

type TelegramMessage = {
  message_id?: number;
  text?: string;
  contact?: {
    phone_number?: string;
    user_id?: number | string;
  };
  chat?: {
    id?: number | string;
  };
  from?: {
    id?: number | string;
    first_name?: string;
    last_name?: string;
    username?: string;
  };
};

type TelegramUpdate = {
  update_id?: number;
  message?: TelegramMessage;
};

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) return false;

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function isAuthorizedTelegramWebhook(request: Request) {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!expectedSecret) return process.env.NODE_ENV !== "production";

  const receivedSecret = request.headers.get("x-telegram-bot-api-secret-token");
  return Boolean(receivedSecret && safeEqual(receivedSecret, expectedSecret));
}

function getMessage(update: TelegramUpdate | null): TelegramMessage | null {
  return update?.message ?? null;
}

function getChatId(message: TelegramMessage | null) {
  const chatId = message?.chat?.id;
  return typeof chatId === "string" || typeof chatId === "number" ? String(chatId) : null;
}

function getPhoneFromMessage(message: TelegramMessage | null) {
  const contactPhone = message?.contact?.phone_number;
  if (contactPhone) return normalizePhone(contactPhone);

  return "";
}

function isOwnTelegramContact(message: TelegramMessage) {
  const contactUserId = message.contact?.user_id;
  const senderUserId = message.from?.id;

  if (!contactUserId || !senderUserId) return true;

  return String(contactUserId) === String(senderUserId);
}

async function replyWithContactButton(chatId: string, text: string) {
  try {
    await sendTelegramMessage(chatId, text, {
      replyMarkup: {
        keyboard: [[{ text: "Поделиться номером", request_contact: true }]],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    });
  } catch (error) {
    console.warn("Telegram contact prompt failed:", error);
  }
}

async function replyAndRemoveKeyboard(chatId: string, text: string) {
  try {
    await sendTelegramMessage(chatId, text, {
      replyMarkup: {
        remove_keyboard: true,
      },
    });
  } catch (error) {
    console.warn("Telegram reply failed:", error);
  }
}

async function linkTelegramChat(input: { phone: string; chatId: string }) {
  if (!hasSupabaseAdminConfig()) {
    throw new Error("Supabase is required to link Telegram chats.");
  }

  const supabase = getSupabaseAdminClient();
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id,name,phone,role")
    .eq("phone", input.phone)
    .eq("is_active", true)
    .maybeSingle<{ id: number; name: string | null; phone: string; role: string }>();

  if (userError) {
    throw new Error(`Telegram user lookup failed: ${userError.message}`);
  }

  if (!user) return null;

  const { data: linkedUser, error: linkedUserError } = await supabase
    .from("users")
    .select("id")
    .eq("telegram_chat_id", input.chatId)
    .maybeSingle<{ id: number }>();

  if (linkedUserError) {
    throw new Error(`Telegram chat lookup failed: ${linkedUserError.message}`);
  }

  if (linkedUser && linkedUser.id !== user.id) {
    if (user.role === "admin") {
      const { error: unlinkError } = await supabase
        .from("users")
        .update({ telegram_chat_id: null })
        .eq("telegram_chat_id", input.chatId);

      if (unlinkError) {
        throw new Error(`Telegram chat unlink failed: ${unlinkError.message}`);
      }
    } else {
      return { user, conflict: true };
    }
  }

  const { error: updateError } = await supabase
    .from("users")
    .update({ telegram_chat_id: input.chatId })
    .eq("id", user.id);

  if (updateError) {
    throw new Error(`Telegram chat link failed: ${updateError.message}`);
  }

  return { user, conflict: false };
}

export async function POST(request: Request) {
  if (!isAuthorizedTelegramWebhook(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized Telegram webhook." }, { status: 401 });
  }

  const update = (await request.json().catch(() => null)) as TelegramUpdate | null;
  const message = getMessage(update);
  const chatId = getChatId(message);
  const event = await createIntegrationEvent({
    provider: "telegram",
    externalId: update?.update_id ? `update:${update.update_id}` : null,
    eventType: "message",
    payload: update ?? {},
  });

  try {
    if (!chatId || !message) {
      await updateIntegrationEvent({ id: event.id, status: "ignored", errorMessage: "Missing Telegram message." });
      return NextResponse.json({ ok: true, ignored: true, reason: "missing_message" });
    }

    const text = message.text?.trim() ?? "";
    if (text.startsWith("/start")) {
      await replyWithContactButton(
        chatId,
        "Нажмите кнопку ниже, чтобы поделиться номером телефона из Telegram.",
      );
      await updateIntegrationEvent({ id: event.id, status: "processed" });
      return NextResponse.json({ ok: true, action: "prompted_for_phone" });
    }

    if (!message.contact) {
      await replyWithContactButton(chatId, "Номер принимается только через кнопку ниже.");
      await updateIntegrationEvent({ id: event.id, status: "ignored", errorMessage: "Contact button required." });
      return NextResponse.json({ ok: true, ignored: true, reason: "contact_required" });
    }

    if (!isOwnTelegramContact(message)) {
      await replyWithContactButton(chatId, "Отправьте свой номер через кнопку ниже, не чужой контакт.");
      await updateIntegrationEvent({
        id: event.id,
        status: "ignored",
        errorMessage: "Contact does not belong to sender.",
      });
      return NextResponse.json({ ok: true, ignored: true, reason: "foreign_contact" });
    }

    const phone = getPhoneFromMessage(message);
    if (!phone) {
      await replyWithContactButton(chatId, "Не удалось прочитать номер. Нажмите кнопку ниже еще раз.");
      await updateIntegrationEvent({ id: event.id, status: "ignored", errorMessage: "Missing phone." });
      return NextResponse.json({ ok: true, ignored: true, reason: "missing_phone" });
    }

    const linkResult = await linkTelegramChat({ phone, chatId });

    if (!linkResult) {
      await replyWithContactButton(
        chatId,
        "Этот номер пока не найден в DMED Portal. Проверьте номер или обратитесь к менеджеру.",
      );
      await updateIntegrationEvent({ id: event.id, status: "ignored", errorMessage: "User phone not found." });
      return NextResponse.json({ ok: true, ignored: true, reason: "user_not_found" });
    }

    if (linkResult.conflict) {
      await replyAndRemoveKeyboard(
        chatId,
        "Этот Telegram уже привязан к другому пользователю DMED Portal. Обратитесь к менеджеру, чтобы сменить привязку.",
      );
      await updateIntegrationEvent({ id: event.id, status: "ignored", errorMessage: "Telegram chat already linked." });
      return NextResponse.json({ ok: true, ignored: true, reason: "telegram_already_linked" });
    }

    await replyAndRemoveKeyboard(
      chatId,
      `Telegram привязан к DMED Portal для номера ${linkResult.user.phone}. Теперь коды входа будут приходить сюда.`,
    );
    await updateIntegrationEvent({ id: event.id, status: "processed" });

    return NextResponse.json({
      ok: true,
      action: "telegram_linked",
      userId: linkResult.user.id,
    });
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "Unknown Telegram webhook error.";
    await updateIntegrationEvent({ id: event.id, status: "failed", errorMessage: messageText });
    return NextResponse.json({ ok: false, error: messageText }, { status: 500 });
  }
}
