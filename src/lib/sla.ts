const businessSlaDays = 5;

function isBusinessDay(date: Date) {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

export function addBusinessDays(start: Date, days: number) {
  const result = new Date(start);
  let remaining = days;

  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    if (isBusinessDay(result)) remaining -= 1;
  }

  return result;
}

export function countBusinessDaysSince(start: Date, end = new Date()) {
  const cursor = new Date(start);
  let count = 0;

  while (cursor < end) {
    cursor.setDate(cursor.getDate() + 1);
    if (cursor <= end && isBusinessDay(cursor)) count += 1;
  }

  return count;
}

export function getSlaSummary(startedAt?: string | null) {
  if (!startedAt) {
    return {
      active: false,
      dueAt: null,
      elapsedBusinessDays: 0,
      remainingBusinessDays: businessSlaDays,
      overdue: false,
    };
  }

  const start = new Date(startedAt);
  const dueAt = addBusinessDays(start, businessSlaDays);
  const elapsedBusinessDays = countBusinessDaysSince(start);
  const remainingBusinessDays = Math.max(0, businessSlaDays - elapsedBusinessDays);

  return {
    active: true,
    dueAt: dueAt.toISOString(),
    elapsedBusinessDays,
    remainingBusinessDays,
    overdue: new Date() > dueAt,
  };
}
