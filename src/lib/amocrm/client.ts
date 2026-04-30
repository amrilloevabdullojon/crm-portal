export async function fetchAmoDeal(dealId: string) {
  const domain = process.env.AMOCRM_DOMAIN;
  const token = process.env.AMOCRM_ACCESS_TOKEN;

  if (!domain || !token) {
    throw new Error("AMOCRM_DOMAIN and AMOCRM_ACCESS_TOKEN are required.");
  }

  const response = await fetch(`https://${domain}/api/v4/leads/${dealId}?with=contacts`, {
    headers: { authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`amoCRM deal fetch failed: ${response.status}`);
  }

  return response.json();
}

export async function fetchAmoContact(contactId: string | number) {
  const domain = process.env.AMOCRM_DOMAIN;
  const token = process.env.AMOCRM_ACCESS_TOKEN;

  if (!domain || !token) {
    throw new Error("AMOCRM_DOMAIN and AMOCRM_ACCESS_TOKEN are required.");
  }

  const response = await fetch(`https://${domain}/api/v4/contacts/${contactId}`, {
    headers: { authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`amoCRM contact fetch failed: ${response.status}`);
  }

  return response.json();
}
