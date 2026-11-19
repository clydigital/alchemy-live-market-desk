import ui from "./radar-sweep.module.css";
import type { CSSProperties } from "react";
import { RADAR_BLIPS, radarBlipPosition } from "@/lib/bluebelly-radar-blips";

/** Decorative brand scanner. Keep it separate from actual data gauges. */
export default function RadarSweep() {
  return <>
    <span className={ui.sweep} aria-hidden="true"/>
    <span className={ui.blips} aria-hidden="true">
      {RADAR_BLIPS.map(({angle, radius}) => {
        const {x, y, delay} = radarBlipPosition(angle);
        const style = {
          "--blip-x": x,
          "--blip-y": y,
          "--blip-radius": `${radius}%`,
          "--blip-phase": delay,
        } as CSSProperties;
        return <span key={angle} className={ui.blip} style={style}/>;
      })}
    </span>
  </>;
}
