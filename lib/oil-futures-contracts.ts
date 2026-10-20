/** Exchange contract identity is deterministic, not inferred from price levels. */
export function consecutiveOilContractMonths(
  benchmark: "WTI" | "BRENT",
  front: string,
  next: string,
): boolean {
  const pattern = benchmark === "WTI"
    ? /^CL([FGHJKMNQUVXZ])(\d{2})$/
    : /^(?:LCO|B)([FGHJKMNQUVXZ])(\d{2})$/;
  const monthOrder = "FGHJKMNQUVXZ";
  function ordinal(contract: string): number | null {
    const match = pattern.exec(contract.toUpperCase());
    if (!match) return null;
    const month = monthOrder.indexOf(match[1]);
    const year = Number(match[2]);
    return month < 0 || !Number.isInteger(year) ? null : (2000 + year) * 12 + month;
  }
  const frontMonth = ordinal(front);
  const nextMonth = ordinal(next);
  return frontMonth !== null && nextMonth !== null && nextMonth === frontMonth + 1;
}
