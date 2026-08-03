import { VizScene } from "./base.js";
import { drawTunnel, updateTunnel } from "../runtime.js";

/** Octagonal rib tunnel — bass pulse rings. */
export class TunnelScene extends VizScene {
  update(_now, dt, levels, fx) {
    const { bass, mid, air, peak, snare, hat } = levels;
    updateTunnel(dt, bass, mid, air, peak, snare, hat, fx.solo ?? 0);
  }
  draw(now, levels, fx) {
    const { bass, mid, air, peak, snare, hat } = levels;
    drawTunnel(now, bass, mid, air, peak, snare, hat, fx.solo ?? 0);
  }
}
