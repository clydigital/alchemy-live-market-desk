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

const fonts: Array<{ value: FontChoice; label: string; stack: string }> = [
  { value: "sans", label: "Sans", stack: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  { value: "humanist", label: "Humanist", stack: '"Trebuchet MS", "Segoe UI", sans-serif' },
  { value: "serif", label: "Serif", stack: 'Georgia, "Times New Roman", serif' },
  { value: "mono", label: "Mono", stack: '"SFMono-Regular", Consolas, "Liberation Mono", monospace' },
];

const sizes: Array<{ value: SizeChoice; label: string; scale: string }> = [
  { value: "compact", label: "Compact", scale: ".94" },
  { value: "standard", label: "Standard", scale: "1" },
  { value: "large", label: "Large", scale: "1.07" },
];

function isFontChoice(value: unknown): value is FontChoice {
  return fonts.some((item) => item.value === value);
}

function isSizeChoice(value: unknown): value is SizeChoice {
  return sizes.some((item) => item.value === value);
}

function applyPreferences(preferences: DisplayPreferences) {
  const stage = document.querySelector<HTMLElement>("[data-live-desk-stage]");
  if (!stage) return;
  const font = fonts.find((item) => item.value === preferences.font) || fonts[0];
  const size = sizes.find((item) => item.value === preferences.size) || sizes[1];
  stage.style.fontFamily = font.stack;
  stage.style.setProperty("zoom", size.scale);
  stage.dataset.fontChoice = preferences.font;
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
