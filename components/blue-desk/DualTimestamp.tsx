import { dateOnlyLabel, formatDualDeskTime } from "@/lib/blue-desk-time";

/**
 * One timestamp component for market content and calendars.
 * ET determines the primary label; SGT is always smaller secondary context.
 */
export default function DualTimestamp({
  value, sourceDate, className,
}: {
  value?: string | null;
  sourceDate?: string | null;
  className?: string;
}) {
  const pair = formatDualDeskTime(value);
  if (!pair) {
    return (
      <span className={className}>
        <span style={{ display: "block" }}>{dateOnlyLabel(sourceDate || "")}</span>
        <small style={{ display: "block", opacity: 0.7 }}>Exact ET / SGT time unavailable</small>
      </span>
    );
  }
  return (
    <time dateTime={pair.iso} className={className}>
      <span style={{ display: "block", fontWeight: 750 }}>{pair.et}</span>
      <small style={{ display: "block", fontSize: "0.76em", opacity: 0.74 }}>{pair.sgt}</small>
    </time>
  );
}
