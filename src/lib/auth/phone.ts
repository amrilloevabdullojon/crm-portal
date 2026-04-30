export function normalizePhone(value: string) {
  const cleaned = value.replace(/[^\d+]/g, "");

  if (!cleaned) return "";
  if (cleaned.startsWith("+")) return `+${cleaned.slice(1).replace(/\D/g, "")}`;
  return `+${cleaned.replace(/\D/g, "")}`;
}
