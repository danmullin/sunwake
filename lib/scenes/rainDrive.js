import { VizScene } from "./base.js";
import { drawNightDrive, seedStormClouds } from "../runtime.js";

/**
 * Storm cousin of Night Drive — same draw path; runtime branches on vizMode.
 */
export class RainDriveScene extends VizScene {
  onEnter() {
    seedStormClouds();
  }
  draw(now, levels, fx) {
    const { bass, mid, air, peak, snare, hat } = levels;
    drawNightDrive(now, bass, mid, air, peak, snare, hat, fx.solo ?? 0);
  }
}
