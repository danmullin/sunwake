import { VizScene } from "./base.js";
import { drawNightDrive } from "../runtime.js";

/** Perspective grid sea — default Sunwake night. */
export class NightDriveScene extends VizScene {
  draw(now, levels, fx) {
    const { bass, mid, air, peak, snare, hat } = levels;
    drawNightDrive(now, bass, mid, air, peak, snare, hat, fx.solo ?? 0);
  }
}
