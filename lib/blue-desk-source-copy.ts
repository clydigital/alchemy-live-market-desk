/**
 * Deterministic, display-only copy editing for admitted original-source facts.
 *
 * The immutable evidence claim, measured values, reporting vintage, and source
 * URL are never rewritten. Only explicitly recognisable fiscal/unit notations
 * are converted into British-English reader notation. No inference is made.
 */
export function formatBlueDeskSourceObservation(value: string): string {
  return value.trim()
    .replace(/\b(20\d{2})Q([1-4])\b/g, (_match, year: string, quarter: string) =>
      "Q" + quarter + " " + year)
    .replace(/\b(\d+(?:\.\d+)?)\s+USD_billion\b/g,
      (_match, amount: string) => "US$" + amount + " billion")
    .replace(/\b(\d+(?:\.\d+)?)\s+USD_million\b/g,
      (_match, amount: string) => "US$" + amount + " million")
    .replace(/\b(\d+(?:\.\d+)?)\s+USD_thousand\b/g,
      (_match, amount: string) => "US$" + amount + " thousand")
    .replace(/\b(\d+(?:\.\d+)?)\s+percent\b/gi, "$1%")
    .replace(/\bdated\s+(20\d{2})-(\d{2})-(\d{2})\b/g,
      (matched, year: string, month: string, day: string) => {
        const numMonth = Number(month);
        const numDay = Number(day);
        const date = new Date(Date.UTC(Number(year), numMonth - 1, numDay));
        if (date.getUTCFullYear() !== Number(year)
          || date.getUTCMonth() !== numMonth - 1
          || date.getUTCDate() !== numDay) return matched;
        const formatted = new Intl.DateTimeFormat("en-GB", {
          day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
        }).format(date);
        return "dated " + formatted;
      });
}
