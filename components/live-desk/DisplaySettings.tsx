"use client";

import { useEffect, useState } from "react";

import styles from "./display-settings.module.css";

type FontChoice = "sans" | "humanist" | "serif" | "mono";
type SizeChoice = "compact" | "standard" | "large";

type DisplayPreferences = {
  font: FontChoice;
  size: SizeChoice;
};

const STORAGE_KEY = "alchemy-live-desk-display";
const DEFAULTS: DisplayPreferences = { font: "sans", size: "standard" };

const fonts: Array<{ value: FontChoice; label: string }> = [
  { value: "sans", label: "Sans" },
  { value: "humanist", label: "Humanist" },
  { value: "serif", label: "Serif" },
  { value: "mono", label: "Mono" },
];

const sizes: Array<{ value: SizeChoice; label: string }> = [
  { value: "compact", label: "Compact" },
  { value: "standard", label: "Standard" },
  { value: "large", label: "Large" },
];

function isFontChoice(value: unknown): value is FontChoice {
  return fonts.some((item) => item.value === value);
}

function isSizeChoice(value: unknown): value is SizeChoice {
  return sizes.some((item) => item.value === value);
}

function applyPreferences(preferences: DisplayPreferences) {
  document.documentElement.dataset.deskFont = preferences.font;
  document.documentElement.dataset.deskSize = preferences.size;
}

export default function DisplaySettings() {
  const [preferences, setPreferences] = useState<DisplayPreferences>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) as Partial<DisplayPreferences> : null;
      const next = {
        font: isFontChoice(parsed?.font) ? parsed.font : DEFAULTS.font,
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
      <summary aria-label="Open font and text-size settings">Type settings</summary>
      <div className={styles.popover}>
        <div className={styles.settingGroup}>
          <span>Typeface</span>
          <div className={styles.optionGrid}>
            {fonts.map((font) => (
              <button
                key={font.value}
                type="button"
                className={preferences.font === font.value ? styles.active : ""}
                onClick={() => setPreferences((current) => ({ ...current, font: font.value }))}
              >
                {font.label}
              </button>
            ))}
          </div>
        </div>
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
