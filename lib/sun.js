import { sunAnchor, sunDiskRadius, SUN_SCALE } from "./runtime.js";

/** Sun / black-hole geometry helpers. */
export class SunModel {
  get scale() {
    return SUN_SCALE;
  }
  anchor() {
    return sunAnchor();
  }
  diskRadius(bass = 0, solo = 0, pulseEnabled = false) {
    return sunDiskRadius(bass, solo, pulseEnabled);
  }
}

export { sunAnchor, sunDiskRadius, SUN_SCALE } from "./runtime.js";
