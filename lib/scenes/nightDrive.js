import { vizMode, fxOn, ctx, W, H } from "../state.js";
import { applyWorldTransform, resetScreenTransform, updateCamera } from "../camera.js";
import { drawSky, drawStars, drawShootingStars, drawSoloAurora } from "../effects/sky.js";
import {
  drawHorizonRibbons, drawMistSheets, drawCloudDeck, drawRain, drawFog, drawDew,
} from "../effects/weather.js";
import {
  drawSunPetals, drawQuasarJets, drawSunFlares, drawSoftSun,
  drawHeartbeatRing, drawUsPresence,
} from "../effects/sun.js";
import { drawHorizon, drawSea, drawBassMountain, drawMirrorSea } from "../effects/gridSea.js";
import { drawSparks, drawStreaks, drawShocks, drawChordHalos, drawHammerRipples } from "../effects/impactSparks.js";
import { drawMelodyThread, drawHarmonyConstellation } from "../effects/melody.js";
import {
  drawStormSky, drawStormClouds, drawWetAsphalt, drawLightningBolts,
} from "../storm.js";
import { VizScene } from "./base.js";

export function drawNightDrive(now, bass, mid, air, peak, snare, hat, solo) {
  const storm = vizMode === "rainDrive";
  updateCamera(now, bass, mid, air, peak, snare);
  // Screen-space night fill first — sway can leave gaps that retain prior frames
  resetScreenTransform();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#050814";
  ctx.fillRect(0, 0, W, H);
  applyWorldTransform();

  if (storm) {
    drawStormSky(now, bass, mid);
    drawStormClouds(now, bass, mid);
  } else {
    drawSky(now, bass, mid);
  }
  if (!storm) drawStars(now, air, mid, solo, bass);
  else drawStars(now, air * 0.12, mid, solo * 0.15, bass);
  if (fxOn("harmonyConstellation") && !storm) drawHarmonyConstellation(bass, solo);
  if (fxOn("shootingStars") && !storm) drawShootingStars(bass, solo);
  if (fxOn("soloAurora") && !storm) drawSoloAurora(solo, air);
  if (fxOn("cloudDeck") && !storm) drawCloudDeck(now);
  if (fxOn("melodyThread")) drawMelodyThread();
  if (fxOn("sunPetals") && !storm) drawSunPetals(now, mid, solo);
  if (storm) drawSoftSun(bass * 0.55, mid * 0.5, solo * 0.2);
  else drawSoftSun(bass, mid, solo);
  if (!storm) drawHeartbeatRing(bass, mid);
  drawUsPresence(bass, mid, air);
  if (fxOn("chordHalos")) drawChordHalos();
  if (fxOn("hammerRipples")) drawHammerRipples();
  if (fxOn("shockRings") && !storm) drawShocks();
  if (fxOn("horizonRibbons") && !storm) drawHorizonRibbons(now, bass, mid, solo);
  drawHorizon(bass);
  if (fxOn("bassMountain")) drawBassMountain(bass);
  if (fxOn("mirrorSea") || storm) drawMirrorSea();
  drawSea(now, bass, mid, air);
  if (storm) drawWetAsphalt(now, bass, mid, air);
  if (fxOn("quasarJets")) drawQuasarJets(now, bass, mid, solo);
  if (fxOn("sunFlares") && !storm) drawSunFlares(now, peak, solo, bass);
  if (fxOn("mistSheets") || storm) drawMistSheets(now, mid);
  if (fxOn("rain") || storm) drawRain(mid);
  if (fxOn("fog") || storm) drawFog(now, bass);
  if (fxOn("dew") || storm) drawDew(now, air, mid);
  if (storm) drawLightningBolts();
  if (fxOn("sparks")) drawSparks(bass, solo);
  if (fxOn("streaks")) drawStreaks();

  resetScreenTransform();
}

/** Perspective grid sea — default Sunwake night. */
export class NightDriveScene extends VizScene {
  draw(now, levels, fx) {
    const { bass, mid, air, peak, snare, hat } = levels;
    drawNightDrive(now, bass, mid, air, peak, snare, hat, fx.solo ?? 0);
  }
}
