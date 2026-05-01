export function parseStatusIds(value) {
  return String(value)
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeStatusIds(statusIds) {
  return [...new Set(statusIds.map((statusId) => String(statusId).trim()).filter(Boolean))];
}
