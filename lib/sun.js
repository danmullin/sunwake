import { W, H, SUN_SCALE, SUN_Y_FRAC, SUN_DROP_PER_EXTRA, fxOn } from "./state.js";

/** Sun / black-hole geometry helpers. */
export class SunModel {
  get scale() { return SUN_SCALE; }
  anchor() { return sunAnchor(); }
  diskRadius(bass = 0, solo = 0, pulseEnabled = false) { return sunDiskRadius(bass, solo, pulseEnabled); }
}

export { SUN_SCALE } from "./state.js";

export function sunYFrac() {
  return SUN_Y_FRAC + (SUN_SCALE - 1) * SUN_DROP_PER_EXTRA;
}

export function sunAnchor() {
  return { x: W * 0.5, y: H * sunYFrac() };
}

export function sunDiskRadius(bass = 0, solo = 0, pulseEnabled = false) {
  const base = 0.11 + (pulseEnabled ? bass * 0.07 + solo * 0.04 : 0);
  return Math.min(W, H) * base * SUN_SCALE;
}

/** Event-horizon radius used to hide starfield behind the void. */
export function blackHoleOccludeRadius(bass = 0, solo = 0) {
  if (!fxOn("blackHole")) return 0;
  return sunDiskRadius(bass, solo, fxOn("sunPulse")) * 0.9;
}

export function behindBlackHole(px, py, bass = 0, solo = 0) {
  const R = blackHoleOccludeRadius(bass, solo);
  if (R <= 0) return false;
  const { x, y } = sunAnchor();
  const dx = px - x;
  const dy = py - y;
  return dx * dx + dy * dy <= R * R;
}
