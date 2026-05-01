export async function createAmoLeadNote(leadId: number | string | null | undefined, text: string) {
  const domain = process.env.AMOCRM_DOMAIN;
  const token = process.env.AMOCRM_ACCESS_TOKEN;

  if (!leadId || !domain || !token) return { ok: false, skipped: true };

  const response = await fetch(`https://${domain}/api/v4/leads/${leadId}/notes`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify([
      {
        note_type: "common",
        params: {
          text,
        },
      },
    ]),
  });

  if (!response.ok) {
    throw new Error(`amoCRM note create failed: ${response.status}`);
  }

  return { ok: true, skipped: false };
}
