"use client";

import { useState } from "react";
import { MarketIcon } from "./MarketIcon";
import styles from "./market-graphics-shelf.module.css";

export const MARKET_GRAPHICS = [
  { id: "divergence", title: "Divergence", description: "Compare related signals that tell different stories." },
  { id: "transmission", title: "Cross-asset transmission", description: "Connect a catalyst to the market through a testable mechanism." },
  { id: "catalyst-timeline", title: "Catalyst timeline", description: "Separate expectations, the release, the reaction and the next test." },
  { id: "regime-matrix", title: "Regime evidence", description: "Sort confirming, contradicting and unresolved evidence." },
  { id: "capex-cashflow", title: "AI investment and cash flow", description: "Contrast investment commitments with the funds available to finance them." },
  { id: "yields-gold", title: "Yields versus gold", description: "Compare nominal rates, real rates, currency and gold." },
] as const;

type GraphicId = typeof MARKET_GRAPHICS[number]["id"];

function resource(id: GraphicId) {
  return `/market-iconography/graphics/${id}.svg`;
}

export async function fetchMarketGraphic(id: GraphicId, fetcher: typeof fetch = fetch) {
  const response = await fetcher(resource(id), { cache: "force-cache" });
  if (!response.ok) throw new Error("Graphic could not be loaded.");
  const svg = await response.text();
  // This asset lives in our own static bundle; never fetch arbitrary URLs.
  if (!svg.trimStart().startsWith("<svg")) throw new Error("Unexpected graphic format.");
  return svg;
}

async function exportPng(svg: string): Promise<Blob> {
  const svgUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    img.src = svgUrl;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 1920;
    canvas.height = 720;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("PNG export is unavailable in this browser.");
    context.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        value => value ? resolve(value) : reject(new Error("PNG conversion failed.")),
        "image/png",
      );
    });
    return blob;
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

function download(blob: Blob, filename: string) {
  const uri = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = uri;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoke after the browser has started the user-requested download.
  window.setTimeout(() => URL.revokeObjectURL(uri), 1500);
}

/** Presentation-only. Mount only within a server-authorised owner route. */
export function MarketGraphicsShelf() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function perform(id: GraphicId, action: "copy" | "svg" | "png") {
    const operation = `${id}:${action}`;
    if (busy) return;
    setBusy(operation);
    try {
      const svg = await fetchMarketGraphic(id);
      if (action === "copy") {
        if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable. Export the SVG instead.");
        await navigator.clipboard.writeText(svg);
        setMessage("SVG copied to clipboard.");
      } else {
        const blob = action === "svg"
          ? new Blob([svg], { type: "image/svg+xml;charset=utf-8" })
          : await exportPng(svg);
        download(blob, `bluebelly-${id}.${action}`);
        setMessage(`${action.toUpperCase()} export started.`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className={styles.shelf} aria-labelledby="market-graphics-title">
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}><MarketIcon name="studio" size={17} /> PRESENTER VISUAL LIBRARY</p>
          <h2 id="market-graphics-title">Market graphics</h2>
          <p>Reusable diagrams for the stream, slides and explainers. These are empty analytical frameworks, not market observations.</p>
        </div>
        <span className={styles.count}>6 templates</span>
      </div>
      <div className={styles.grid}>
        {MARKET_GRAPHICS.map(item => (
          <article className={styles.card} key={item.id}>
            <div className={styles.artwork}>
              {/* Static first-party artwork, never external content or research data. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={resource(item.id)} width={960} height={360} alt={`${item.title}: illustrative schematic, not market data`} loading="lazy" />
            </div>
            <div className={styles.content}>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <div className={styles.actions}>
                <button type="button" disabled={Boolean(busy)} onClick={() => void perform(item.id, "copy")}>
                  <MarketIcon name="copy" size={16} /> Copy SVG
                </button>
                <button type="button" disabled={Boolean(busy)} onClick={() => void perform(item.id, "svg")}>
                  <MarketIcon name="download" size={16} /> SVG
                </button>
                <button type="button" disabled={Boolean(busy)} onClick={() => void perform(item.id, "png")}>
                  <MarketIcon name="download" size={16} /> PNG
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
      <p className={styles.note}>Use real measurements only after independent source and date verification.</p>
      <p className={styles.feedback} role="status" aria-live="polite">{message}</p>
    </section>
  );
}
