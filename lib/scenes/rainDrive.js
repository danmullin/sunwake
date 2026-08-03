/**
 * Rain Drive scene — Night Drive's stormy cousin.
 * Storm helpers live in lib/storm.js (leaf). We import drawNightDrive from
 * nightDrive.js; nightDrive.js now imports storm helpers from storm.js, so
 * there is no circular dependency.
 */
import { seedStormClouds } from "../storm.js";
import { drawNightDrive } from "./nightDrive.js";
import { VizScene } from "./base.js";

export {
  seedStormClouds,
};

/** Wet-asphalt night drive with full storm: clouds, lightning, rain. */
export class RainDriveScene extends VizScene {
  onEnter(_prev) {
    seedStormClouds();
  }
  draw(now, levels, fx) {
    const { bass, mid, air, peak, snare, hat } = levels;
    drawNightDrive(now, bass, mid, air, peak, snare, hat, fx.solo ?? 0);
  }
}
