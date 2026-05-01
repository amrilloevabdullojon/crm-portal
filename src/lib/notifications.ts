import { getSupabaseAdminClient, hasSupabaseAdminConfig } from "@/lib/db/supabase";
import { sendTrackedTelegramMessage } from "@/lib/telegram/client";

type TelegramRecipient = {
  id: number;
  telegram_chat_id: string | null;
};

async function getManagerRecipients(clinicId: number) {
  if (!hasSupabaseAdminConfig() || !process.env.TELEGRAM_BOT_TOKEN) return [];

  const supabase = getSupabaseAdminClient();
  const { data: clinic } = await supabase
    .from("clinics")
    .select("manager_user_id")
    .eq("id", clinicId)
    .maybeSingle<{ manager_user_id: number | null }>();
  const managerIds = new Set<number>();

  if (clinic?.manager_user_id) managerIds.add(clinic.manager_user_id);

  const { data: clinicUsers } = await supabase
    .from("clinic_users")
    .select("users(id,role,telegram_chat_id)")
    .eq("clinic_id", clinicId)
    .returns<
      Array<{
        users:
          | { id: number; role: string; telegram_chat_id: string | null }
          | Array<{ id: number; role: string; telegram_chat_id: string | null }>
          | null;
      }>
    >();

  const linkedClinicManagers =
    clinicUsers
      ?.map((row) => (Array.isArray(row.users) ? row.users[0] : row.users))
      .filter((user): user is { id: number; role: string; telegram_chat_id: string | null } =>
        Boolean(user && (user.role === "manager" || user.role === "admin")),
      ) ?? [];

  for (const user of linkedClinicManagers) managerIds.add(user.id);

  if (managerIds.size === 0) {
    const { data: admins } = await supabase
      .from("users")
      .select("id,telegram_chat_id")
      .in("role", ["manager", "admin"])
      .eq("is_active", true)
      .not("telegram_chat_id", "is", null)
      .returns<TelegramRecipient[]>();

    return admins ?? [];
  }

  const { data: recipients } = await supabase
    .from("users")
    .select("id,telegram_chat_id")
    .in("id", [...managerIds])
    .eq("is_active", true)
    .not("telegram_chat_id", "is", null)
    .returns<TelegramRecipient[]>();

  return recipients ?? [];
}

export async function notifyManagers(input: { clinicId: number; text: string }) {
  const recipients = await getManagerRecipients(input.clinicId);

  await Promise.allSettled(
    recipients
      .filter((recipient) => recipient.telegram_chat_id)
      .map((recipient) =>
        sendTrackedTelegramMessage({
          chatId: recipient.telegram_chat_id as string,
          text: input.text,
          eventType: "manager_notification",
          details: { clinicId: input.clinicId, recipientUserId: recipient.id },
        }),
      ),
  );
}
