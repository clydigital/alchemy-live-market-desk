import type { DailyAssetCard, DailyAssetStateV1, DailyStockRadarCard } from "@/lib/daily-asset-state";
import type {
  PolicyLiquidityInteraction,
  System1DollarLiquiditySnapshot,
} from "@/lib/dossier-v2/system1-dollar-liquidity";

import styles from "./daily-asset-state-board.module.css";

function formatLast(card: DailyAssetCard) {
  if (card.last == null || !Number.isFinite(card.last)) return "—";
  if (card.key === "US_RATES") return `${card.last.toFixed(2)}%`;
  if (card.last >= 1000) return card.last.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return card.last.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function formatChange(card: DailyAssetCard) {
  if (card.dailyChange == null || !Number.isFinite(card.dailyChange)) return "Change unavailable";
  const sign = card.dailyChange > 0 ? "+" : "";
  return card.dailyChangeUnit === "bps"
    ? `${sign}${card.dailyChange.toFixed(1)}bp latest`
    : `${sign}${card.dailyChange.toFixed(2)}% latest`;
}

function tone(bias: DailyAssetCard["bias"] | DailyStockRadarCard["bias"]) {
  if (bias === "BULLISH" || bias === "DOVISH") return "positive";
  if (bias === "BEARISH" || bias === "HAWKISH") return "negative";
  if (bias === "MIXED") return "mixed";
  return "neutral";
}

export default function DailyAssetStateBoard({
  state,
  dollarLiquidity = null,
  policyLiquidityInteraction = null,
  compact = false,
}: {
  state: DailyAssetStateV1 | null;
  dollarLiquidity?: System1DollarLiquiditySnapshot | null;
  policyLiquidityInteraction?: PolicyLiquidityInteraction | null;
  compact?: boolean;
}) {
  if (!state) return null;

  return (
    <section className={styles.section} data-compact={compact ? "true" : "false"}>
      <header className={styles.header}>
        <div>
          <span>DAILY ASSET STATE</span>
          <h2>What the desk thinks matters right now</h2>
        </div>
        <small>Live-owned · {state.contractVersion}</small>
      </header>

      <div className={styles.grid}>
        {state.assets.map((card) => (
          <article className={styles.card} key={card.key} data-tone={tone(card.bias)}>
            <header>
              <div>
                <small>{card.label}</small>
                <strong>{formatLast(card)}</strong>
              </div>
              <span data-tone={tone(card.bias)}>{card.bias.replaceAll("_", " ")}</span>
            </header>
            <div className={styles.change}>{formatChange(card)}</div>
            {card.key === "US_RATES" && dollarLiquidity ? (
              <div className={styles.liquidityLine}>
                <b>$ liquidity</b>
                <span>{dollarLiquidity.state.replaceAll("_", " ")}</span>
                {policyLiquidityInteraction ? (
                  <small>{policyLiquidityInteraction.alignment.replaceAll("_", " ")}</small>
                ) : null}
              </div>
            ) : null}
            <p>{card.primaryDriver}</p>
            <footer>
              <span><b>Conviction</b>{card.conviction}</span>
              {card.confirmingSignal ? <span><b>Confirm</b>{card.confirmingSignal}</span> : null}
              {card.contradictingSignal ? <span><b>Contradict</b>{card.contradictingSignal}</span> : null}
              {card.invalidation ? <span><b>Change view</b>{card.invalidation}</span> : null}
              {card.sourceLabel ? <span><b>Price source</b>{card.sourceLabel}</span> : null}
            </footer>
          </article>
        ))}
      </div>

      {state.stockRadar.length ? (
        <div className={styles.radar}>
          <div className={styles.radarHead}>
            <div>
              <span>TODAY&apos;S STOCK RADAR</span>
              <strong>Verified research watchlist</strong>
            </div>
            <small>Max 3 · creator ideas remain leads until verified</small>
          </div>
          <div className={styles.radarGrid}>
            {state.stockRadar.map((item) => (
              <article key={item.symbol} data-tone={tone(item.bias)}>
                <header>
                  <div><b>{item.symbol}</b><span>{item.companyName}</span></div>
                  <strong>{item.bias === "UNRESOLVED" ? "WATCH" : `${item.bias} WATCH`}</strong>
                </header>
                <p>{item.whyRelevant}</p>
                <small><b>Confirm:</b> {item.confirmingSignal}</small>
                <small><b>Invalidate:</b> {item.invalidatingSignal}</small>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
