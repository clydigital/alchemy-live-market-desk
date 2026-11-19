/** Decorative radar blips, not market observations. */
export const MAX_RADAR_BLIPS = 5;
export const RADAR_RELOCATION_CYCLES = 3;
export type RadarBlip = {angle: number; radius: number};

export function randomRadarBlips(random: () => number = Math.random): RadarBlip[] {
  const count = 3 + Math.floor(random() * 3);
  const blips: RadarBlip[] = [];
  for (let i = 0; i < count; i++) {
    let angle = random() * 360;
    // Avoid overlapping dots, including on the compact Learn ring.
    for (let attempt = 0; attempt < 64 && blips.some(b => Math.abs(((angle - b.angle + 540) % 360) - 180) < 18); attempt++) {
      angle = random() * 360;
    }
    while (blips.some(b => Math.abs(((angle - b.angle + 540) % 360) - 180) < 18)) angle = (angle + 19) % 360;
    blips.push({angle, radius: 30 + random() * 15});
  }
  return blips;
}

/** The scanner's brightest leading edge starts at -93 degrees. */
export function radarBlipPosition(angle: number) {
  const radians = angle * Math.PI / 180;
  return {
    x: Math.sin(radians),
    y: -Math.cos(radians),
    contactPhase: (((angle + 93) % 360 + 360) % 360) / 360,
  };
}

/** Read group and revolution phase from the actual CSS sweep clock. */
export function radarSweepFrame(elapsed: number, duration: number) {
  const turns = Math.max(0, elapsed) / duration;
  return {group: Math.floor(turns / RADAR_RELOCATION_CYCLES), cycle: Math.floor(turns), phase: turns % 1};
}

/** Strictly hidden before contact, a brief full-strength hold, then fade.
 * Each revolution resets visibility before its next scan. */
export function radarBlipOpacity(phase: number, contactPhase: number): number {
  const age = phase - contactPhase;
  if (age < 0 || age >= .15) return 0;
  return age <= .05 ? 1 : Math.max(0, 1 - (age - .05) / .10);
}
