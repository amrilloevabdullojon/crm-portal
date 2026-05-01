import { getSupabaseAdminClient, hasSupabaseAdminConfig } from "@/lib/db/supabase";

export async function getUserDisplayName(userId: number) {
  if (!hasSupabaseAdminConfig()) return `User #${userId}`;

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("users")
    .select("name,phone")
    .eq("id", userId)
    .maybeSingle<{ name: string | null; phone: string | null }>();

  if (error) {
    throw new Error(`User query failed: ${error.message}`);
  }

  return data?.name || data?.phone || `User #${userId}`;
}
