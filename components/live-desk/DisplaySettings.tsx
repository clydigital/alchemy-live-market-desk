"use client";

import { useEffect, useState } from "react";

import styles from "./display-settings.module.css";

type SizeChoice = "compact" | "standard" | "large";

type DisplayPreferences = {
  size: SizeChoice;
};

const STORAGE_KEY = "alchemy-live-desk-display";
const DEFAULTS: DisplayPreferences = { size: "standard" };

const sizes: Array<{ value: SizeChoice; label: string; scale: string }> = [
  { value: "compact", label: "Compact", scale: ".94" },
  { value: "standard", label: "Standard", scale: "1" },
  { value: "large", label: "Large", scale: "1.07" },
];

function isSizeChoice(value: unknown): value is SizeChoice {
  return sizes.some((item) => item.value === value);
}

function applyPreferences(preferences: DisplayPreferences) {
  const stage = document.querySelector<HTMLElement>("[data-live-desk-stage]");
  if (!stage) return;
  const size = sizes.find((item) => item.value === preferences.size) || sizes[1];
  stage.style.fontFamily = "var(--bluebelly-font)";
  stage.style.setProperty("zoom", size.scale);
  stage.dataset.fontChoice = "figtree";
  stage.dataset.sizeChoice = preferences.size;
}

export default function DisplaySettings() {
  const [preferences, setPreferences] = useState<DisplayPreferences>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) as Partial<DisplayPreferences> : null;
      const next = {
        size: isSizeChoice(parsed?.size) ? parsed.size : DEFAULTS.size,
      };
      setPreferences(next);
      applyPreferences(next);
    } catch {
      applyPreferences(DEFAULTS);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    applyPreferences(preferences);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  }, [preferences, ready]);

  return (
    <details className={styles.settings}>
      <summary aria-label="Open Figtree text-size settings">Type settings</summary>
      <div className={styles.popover}>
        <p style={{fontSize:12,margin:"0 0 12px"}}>Typeface: Figtree (site standard)</p>
        <div className={styles.settingGroup}>
          <span>Text size</span>
          <div className={styles.optionGrid}>
            {sizes.map((size) => (
              <button
                key={size.value}
                type="button"
                className={preferences.size === size.value ? styles.active : ""}
                onClick={() => setPreferences((current) => ({ ...current, size: size.value }))}
              >
                {size.label}
              </button>
            ))}
          </div>
        </div>
        <small>Saved in this browser.</small>
      </div>
    </details>
  );
}
