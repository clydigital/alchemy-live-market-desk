/** Seven decorative Dragon Radar-style blips, not market observations. */
export const RADAR_BLIPS = [
  {angle: 12, radius: 34},
  {angle: 57, radius: 43},
  {angle: 111, radius: 32},
  {angle: 162, radius: 44},
  {angle: 210, radius: 35},
  {angle: 260, radius: 42},
  {angle: 307, radius: 32},
] as const;

/** The shared scanner's bright leading edge starts at -93 degrees.
 * The blip's glow peaks at 2% of its cycle, so offset the animation
 * to meet the rotating edge without introducing a second sweep. */
export function radarBlipPosition(angle: number) {
  const radians = angle * Math.PI / 180;
  const contactPhase = (((angle + 93) % 360 + 360) % 360) / 360;
  return {
    x: Math.sin(radians),
    y: -Math.cos(radians),
    delay: -((1.02 - contactPhase) % 1),
  };
}
