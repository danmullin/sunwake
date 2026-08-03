import { VizScene } from "./base.js";
import { drawArcadeCabinet, updateArcadeCabinet, seedArcadeStars } from "../runtime.js";

/** CRT cabinet — vector starfield + coin-op EQ chrome. */
export class ArcadeScene extends VizScene {
  onEnter() {
    seedArcadeStars();
  }
  update(now, _dt, levels, fx) {
    const { bass, mid, air, peak, snare, hat } = levels;
    updateArcadeCabinet(now, bass, mid, air, peak, snare, hat, fx.solo ?? 0);
  }
  draw(now, levels, fx) {
    const { bass, mid, air, peak, snare, hat } = levels;
    drawArcadeCabinet(now, bass, mid, air, peak, snare, hat, fx.solo ?? 0);
  }
}
