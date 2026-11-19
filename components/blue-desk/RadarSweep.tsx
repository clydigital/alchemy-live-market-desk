"use client";

import { useEffect, useRef } from "react";
import { MAX_RADAR_BLIPS, randomRadarBlips, radarBlipPosition, radarBlipOpacity, radarSweepFrame } from "@/lib/bluebelly-radar-blips";
import ui from "./radar-sweep.module.css";

/** Decorative brand scanner. Positions and detection follow one actual clock. */
export default function RadarSweep() {
  const sweepRef = useRef<HTMLSpanElement>(null);
  const blipsRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const sweep = sweepRef.current;
    const nodes = Array.from(blipsRef.current?.children ?? []) as HTMLSpanElement[];
    if (!sweep || !nodes.length || typeof sweep.getAnimations !== "function") return;
    let activeAnimation: Animation | undefined;
    let group = -1;
    let layoutStartCycle = -1;
    let layoutStartPhase = 0;
    let positions: ReturnType<typeof radarBlipPosition>[] = [];
    let frame = 0;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");

    function setVisible(node: HTMLSpanElement, opacity: number) {
      if (node.hidden !== (opacity <= 0)) node.hidden = opacity <= 0;
      if (node.style.opacity !== String(opacity)) node.style.opacity = String(opacity);
    }
    function hideAll() { nodes.forEach(node => setVisible(node, 0)); }

    function tick() {
      if (motion.matches) return;
      const animation = sweep!.getAnimations()[0];
      const elapsed = animation?.currentTime;
      const duration = animation?.effect?.getComputedTiming().duration;
      if (animation && typeof elapsed === "number" && typeof duration === "number" && duration > 0) {
        const next = radarSweepFrame(elapsed, duration);
        if (animation !== activeAnimation || next.group !== group) {
          hideAll();
          activeAnimation = animation;
          group = next.group;
          layoutStartCycle = next.cycle;
          layoutStartPhase = next.phase;
          const blips = randomRadarBlips();
          positions = blips.map(({angle, radius}, i) => {
            const position = radarBlipPosition(angle);
            nodes[i].style.setProperty("--blip-x", String(position.x));
            nodes[i].style.setProperty("--blip-y", String(position.y));
            nodes[i].style.setProperty("--blip-radius", `${radius}%`);
            return position;
          });
        }
        nodes.forEach((node, i) => {
          const position = positions[i];
          const alreadyPassed = position && next.cycle === layoutStartCycle && position.contactPhase < layoutStartPhase;
          setVisible(node, position && !alreadyPassed ? radarBlipOpacity(next.phase, position.contactPhase) : 0);
        });
      } else {
        activeAnimation = undefined;
        group = -1;
        hideAll();
      }
      frame = requestAnimationFrame(tick);
    }
    function syncMotion() {
      cancelAnimationFrame(frame);
      hideAll();
      activeAnimation = undefined;
      group = -1;
      if (!motion.matches) frame = requestAnimationFrame(tick);
    }
    syncMotion();
    motion.addEventListener("change", syncMotion);
    return () => {
      cancelAnimationFrame(frame);
      motion.removeEventListener("change", syncMotion);
      hideAll();
    };
  }, []);

  return <>
    <span ref={sweepRef} className={ui.sweep} aria-hidden="true"/>
    <span ref={blipsRef} className={ui.blips} aria-hidden="true">
      {Array.from({length: MAX_RADAR_BLIPS}, (_, i) => <span key={i} className={ui.blip} hidden/>)}
    </span>
  </>;
}
