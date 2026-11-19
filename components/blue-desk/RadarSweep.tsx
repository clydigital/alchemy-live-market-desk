import ui from "./radar-sweep.module.css";

/** Decorative brand scanner. Keep it separate from actual data gauges. */
export default function RadarSweep() {
  return <span className={ui.sweep} aria-hidden="true"/>;
}
