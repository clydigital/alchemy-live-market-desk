/** Conditional reader education based on a dated calendar entry, not fresh evidence.
 * Do not infer consensus, a surprise, company numbers or observed price reaction. */
export function calendarHumanStake(title: string): string {
  const event=title.toLowerCase();
  if(/microsoft|alphabet|google|amazon|meta|nvidia|earnings|quarterly results|quarterly report/.test(event))
    return "A company report is a shareholder's receipt. Did customers spend more? How much cash was left after expenses and investment? And did management give investors a reason to believe the spending will pay off?";
  if(/fomc|federal reserve|bank of canada|european central bank|ecb|bank of england|boe|bank of japan|boj|rate decision/.test(event))
    return "A change in the rate outlook reaches people refinancing homes or business loans. Investors also compare the return on bonds with the future profits they expect from shares.";
  if(/consumer price|cpi|personal consumption expenditures|pce|inflation/.test(event))
    return "Households feel changes in food, fuel and service costs first. Bond and currency traders then ask whether these numbers will change the central bank's next decision.";
  if(/payroll|employment|labou?r|unemployment|jobs/.test(event))
    return "Workers care about hiring and pay; businesses care about wage costs and customers who can keep spending. Markets watch whether growth is slowing enough to shift interest-rate expectations.";
  if(/manufactur|retail sales|pmi|gdp|housing/.test(event))
    return "A factory, shop or builder sees demand change before a market index explains it. Investors watch whether the next report suggests customers and businesses are still spending.";
  return "This is a dated decision point for someone exposed to business costs, borrowing or future earnings. The impact depends on what is actually released and how it compares with expectations.";
}
