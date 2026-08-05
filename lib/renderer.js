/**
 * RAF owner — analyse audio, tick simulation, dispatch active VizScene.
 */
import {
  analyser, freq, time, setRaf, t0,
  vizMode, levels, FX,
} from "./state.js";
import { PERF, updatePerf } from "./perf.js";
import { bandEnergy, smooth, midCentroid } from "./math.js";
import { getScene } from "./sceneRegistry.js";
import { resetScreenTransform } from "./camera.js";
import { updateFx, updateMeters } from "./simulation.js";
import { drawVignette } from "./effects/vignette.js";
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
    const snareBody = bandEnergy(freq, n * 0.08, n * 0.3);
    const snareCrackBand = bandEnergy(freq, n * 0.22, n * 0.55);
    const snare = snareBody * 0.35 + snareCrackBand * 0.65;
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
    levels.snare = smooth(levels.snare, Math.pow(snare, 0.82), 0.55);
    levels.hat = smooth(levels.hat, Math.pow(hat, 0.9), 0.45);
  } else {
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

  const scene = getScene(vizMode);
  const dt = PERF.emaDt || 16.7;
  if (scene) {
    if (vizMode === "skyline" || vizMode === "tunnel" || vizMode === "arcade") {
      resetScreenTransform();
    }
    scene.update(now, dt, levels, FX);
    scene.draw(now, levels, FX);
  }

  if (vizMode !== "arcade") drawVignette();
  updateMeters(bass, mid, air);
}

setFrameRef(frame);

export class Renderer {
  /** @param {import('./app.js').SunwakeApp} [_app] */
  constructor(_app) {
    this._started = false;
  }
  get frame() {
    return frame;
  }
  /** Idempotent — boot.js also schedules the first frame. */
  start() {
    if (this._started) return;
    this._started = true;
  }
}

export { frame };
