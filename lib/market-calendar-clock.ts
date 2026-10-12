// Calendar clock is presentation-only. It never changes the source event's published timestamp.
const MYT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kuala_Lumpur", hour: "2-digit", minute: "2-digit", hour12: false,
});

export function macroEtUtcTimestamp(date: string, timeLabel: string): number | null {
  const match = /(\d{1,2}):(\d{2})\s*ET\b/i.exec(timeLabel);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !match) return null;
  const midday = new Date(date + "T12:00:00Z");
  if (!Number.isFinite(midday.getTime())) return null;
  const zone = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", timeZoneName: "shortOffset",
  }).formatToParts(midday).find(part => part.type === "timeZoneName")?.value || "";
  const offsetHours = Number(/GMT-(\d{1,2})/.exec(zone)?.[1]);
  if (![4, 5].includes(offsetHours)) return null;
  const [year, month, day] = date.split("-").map(Number);
  const hour = Number(match[1]), minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return Date.UTC(year, month - 1, day, hour + offsetHours, minute);
}

export function calendarTimePresentation(startAt: string | null, label: string | null, dateOnly: string): { timeText: string; sortAt: number } {
  const displayed = label || "Time unconfirmed";
  const exact = startAt?.includes("T") ? Date.parse(startAt) : Number.NaN;
  const et = macroEtUtcTimestamp(dateOnly, displayed);
  const timestamp = Number.isFinite(exact) ? exact : et;
  const known = timestamp !== null && Number.isFinite(timestamp);
  const alreadyMyt = /\bMYT\b|Taiwan time/i.test(displayed);
  const timeText = known && !alreadyMyt ? displayed + " · " + MYT.format(new Date(timestamp)) + " MYT" : displayed;
  // Unknown intraday times sort behind confirmed times on the same local calendar day.
  return { timeText, sortAt: known ? timestamp : Date.parse(dateOnly + "T23:59:59Z") };
}
