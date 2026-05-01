function getEnv(name: string) {
  const value = process.env[name]?.trim();
  return value || undefined;
}

export function hasSlackConfig() {
  return Boolean(getEnv("SLACK_WEBHOOK_URL") || (getEnv("SLACK_BOT_TOKEN") && getEnv("SLACK_ADMIN_CHANNEL_ID")));
}

async function sendViaWebhook(text: string) {
  const webhookUrl = getEnv("SLACK_WEBHOOK_URL");

  if (!webhookUrl) return false;

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error(`Slack webhook failed: ${response.status}`);
  }

  return true;
}

async function sendViaBot(text: string) {
  const token = getEnv("SLACK_BOT_TOKEN");
  const channel = getEnv("SLACK_ADMIN_CHANNEL_ID");

  if (!token || !channel) return false;

  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      channel,
      text,
      mrkdwn: true,
    }),
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok || !result.ok) {
    throw new Error(`Slack chat.postMessage failed: ${result.error ?? response.status}`);
  }

  return true;
}

export async function sendSlackMessage(text: string) {
  if (!hasSlackConfig()) {
    throw new Error("Slack is not configured. Set SLACK_WEBHOOK_URL or SLACK_BOT_TOKEN + SLACK_ADMIN_CHANNEL_ID.");
  }

  if (await sendViaWebhook(text)) return;
  if (await sendViaBot(text)) return;

  throw new Error("Slack is not configured.");
}
