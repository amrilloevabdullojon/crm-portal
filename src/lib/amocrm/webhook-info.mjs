const webhookTargets = [
  { action: "status", prefix: "leads[status][0]" },
  { action: "add", prefix: "leads[add][0]" },
  { action: "update", prefix: "leads[update][0]" },
];

export function extractAmoWebhookInfoFromPayload(payload) {
  const get = (key) => {
    const value = payload[key];
    return typeof value === "string" || typeof value === "number" ? String(value) : null;
  };

  for (const { action, prefix } of webhookTargets) {
    const dealId = get(`${prefix}[id]`);
    if (dealId) {
      return {
        action,
        dealId,
        statusId: get(`${prefix}[status_id]`),
        dealName: get(`${prefix}[name]`),
      };
    }
  }

  return {
    action: "unknown",
    dealId: null,
    statusId: null,
    dealName: null,
  };
}
