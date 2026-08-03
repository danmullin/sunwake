import {
  analyser, freq, time, raf, setRaf, t0,
  vizMode, levels, FX,
} from "./state.js";
import { PERF, updatePerf } from "./perf.js";
import { bandEnergy, smooth, midCentroid } from "./math.js";
import { getScene } from "./sceneRegistry.js";
import { resetScreenTransform } from "./camera.js";
import { updateFx, drawVignette, updateMeters } from "./simulation.js";
import { drawNightDrive } from "./scenes/nightDrive.js";
import { drawSkyline, updateSkylineEq } from "./scenes/skyline.js";
import { updateTunnel, drawTunnel } from "./scenes/tunnel.js";
import { updateArcadeCabinet, drawArcadeCabinet } from "./scenes/arcade.js";
import { setFrameRef } from "./audio.js";

function frame(now) {
  setRaf(requestAnimationFrame(frame));
  updatePerf(now);

  if (analyser && freq && time) {
    analyser.getByteFrequencyData(freq);
    analyser.getByteTimeDomainData(time);
    const n = freq.length;
    const bass = bandEnergy(freq, 1, n * 0.06);
    const mid = bandEnergy(freq, n * 0.06, n * 0.28);
    const air = bandEnergy(freq, n * 0.28, n * 0.7);
    // Snare: wider body + crack so backbeat snares still register when kicks are loud
    const snareBody = bandEnergy(freq, n * 0.08, n * 0.3);
    const snareCrackBand = bandEnergy(freq, n * 0.22, n * 0.55);
    const snare = snareBody * 0.35 + snareCrackBand * 0.65;
    // Hi-hat: bright top end / sizzle
    const hat = bandEnergy(freq, n * 0.45, n * 0.85);
    let peak = 0;
    const tLen = time.length;
    const tStep = 2;
    for (let i = 0; i < tLen; i += tStep) {
      const v = Math.abs(time[i] - 128) / 128;
      if (v > peak) peak = v;
    }
    levels.bass = smooth(levels.bass, Math.pow(bass, 0.85), 0.22);
    levels.mid = smooth(levels.mid, Math.pow(mid, 0.9), 0.24);
    levels.air = smooth(levels.air, Math.pow(air, 1.05), 0.26);
    levels.peak = smooth(levels.peak, peak, 0.35);
    // Snare/hat stay snappy — heavy smoothing was burying backbeats
    levels.snare = smooth(levels.snare, Math.pow(snare, 0.82), 0.55);
    levels.hat = smooth(levels.hat, Math.pow(hat, 0.9), 0.45);
  } else {
    // idle breath before play
    const breath = 0.5 + 0.5 * Math.sin((now - t0) * 0.0012);
    levels.bass = 0.12 + breath * 0.08;
    levels.mid = 0.1 + (1 - breath) * 0.08;
    levels.air = 0.08 + breath * 0.06;
    levels.peak = 0;
    levels.snare = 0;
    levels.hat = 0;
  }

  const { bass, mid, air, peak, snare, hat } = levels;
  const leadPitch = freq ? midCentroid(freq) : 0.5;
  updateFx(bass, mid, air, now, peak, snare, hat, leadPitch);
  const solo = FX.solo;
  FX.solo = solo;

  const scene = getScene(vizMode);
  const dt = PERF.emaDt || 16.7;
  if (scene) {
    if (vizMode === "skyline" || vizMode === "tunnel" || vizMode === "arcade") {
      resetScreenTransform();
    }
    scene.update(now, dt, levels, FX);
    scene.draw(now, levels, FX);
  } else if (vizMode === "skyline") {
    resetScreenTransform();
    drawSkyline(now, bass, mid, air, peak, snare, hat, solo);
  } else if (vizMode === "tunnel") {
    resetScreenTransform();
    updateTunnel(dt, bass, mid, air, peak, snare, hat, solo);
    drawTunnel(now, bass, mid, air, peak, snare, hat, solo);
  } else if (vizMode === "arcade") {
    resetScreenTransform();
    updateArcadeCabinet(now, bass, mid, air, peak, snare, hat, solo);
    drawArcadeCabinet(now, bass, mid, air, peak, snare, hat, solo);
  } else {
    drawNightDrive(now, bass, mid, air, peak, snare, hat, solo);
  }

  // Arcade paints its own CRT framing — skip the shared vignette
  if (vizMode !== "arcade") drawVignette();
  updateMeters(bass, mid, air);
}

// Register frame with audio.js so audio functions can kick the RAF loop
setFrameRef(frame);

export class Renderer {
  get frame() { return frame; }
  start() { setRaf(requestAnimationFrame(frame)); }
}

export { frame };
