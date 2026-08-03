import { updateFx } from "./runtime.js";

/** Per-frame FX simulation (onsets, spawns, lifetimes). */
export class Simulation {
  update(bass, mid, air, now, peak, snare, hat, leadPitch) {
    updateFx(bass, mid, air, now, peak, snare, hat, leadPitch);
  }
}

export { updateFx } from "./runtime.js";
