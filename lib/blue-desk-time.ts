/**
 * Blue Desk display-only clock. UTC/offset-bearing instants are the authority.
 * Never turn a source date-only value into an invented release time or ET day.
 */
const ET = "America/New_York";
const MYT = "Asia/Kuala_Lumpur";

export type DualDeskTime = {
  iso: string;
  et: string;
  myt: string;
  etDay: string;
  mytDay: string;
};

function parts(date: Date, zone: string) {
  const data = new Intl.DateTimeFormat("en-US", {
    timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(date);
  return Object.fromEntries(data.map(part => [part.type, part.value]));
}

function display(date: Date, zone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: zone, weekday: "short", day: "2-digit", month: "short",
    year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(date);
}

export function formatDualDeskTime(value: string | Date | null | undefined): DualDeskTime | null {
  if (!value) return null;
  if (typeof value === "string" && !/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const east = parts(date, ET);
  const malaysia = parts(date, MYT);
  const zone = new Intl.DateTimeFormat("en-US", { timeZone: ET, timeZoneName: "short" })
    .formatToParts(date).find(part => part.type === "timeZoneName")?.value || "ET";
  return {
    iso: date.toISOString(),
    et: display(date, ET) + " " + (zone === "EDT" || zone === "EST" ? zone : "ET"),
    myt: display(date, MYT) + " MYT",
    etDay: [east.year, east.month, east.day].join("-"),
    mytDay: [malaysia.year, malaysia.month, malaysia.day].join("-"),
  };
}

/** Source calendar dates without verified instants stay date-only; no timezone reassignment. */
export function dateOnlyLabel(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value + " · source date only" : "Time unconfirmed";
}
