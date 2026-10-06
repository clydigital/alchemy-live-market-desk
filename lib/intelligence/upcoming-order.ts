type UpcomingTimedItem = {
  time?: string | null;
};

function upcomingTimestamp(value: string | null | undefined) {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

export function sortUpcomingByTime<T extends UpcomingTimedItem>(items: T[]) {
  return [...items].sort((left, right) => {
    const leftTime = upcomingTimestamp(left.time);
    const rightTime = upcomingTimestamp(right.time);
    if (leftTime !== rightTime) return leftTime - rightTime;
    return String(left.time || "").localeCompare(String(right.time || ""));
  });
}
