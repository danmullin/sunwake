import { VizScene } from "./base.js";
import { drawSkyline, seedSkylineCity } from "../runtime.js";

/** Side-view highway + fractal city. */
export class SkylineScene extends VizScene {
  onResize() {
    seedSkylineCity();
  }
  draw(now, levels, fx) {
    const { bass, mid, air, peak, snare, hat } = levels;
    drawSkyline(now, bass, mid, air, peak, snare, hat, fx.solo ?? 0);
  }
}
