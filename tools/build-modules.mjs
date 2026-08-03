/**
 * DEPRECATED — do not regenerate the live lib/ tree from this script.
 * Ownership now lives in hand-maintained modules (state/audio/grid/particles/
 * simulation/scenes/boot/renderer). Kept only as archaeology next to
 * listen.monolith.bak.js.
 *
 * Historical behavior:
 * 1) lib/runtime.js — full implementation, boot deferred to startRuntime()
 * 2) OOP facades under lib/ that dispatch into runtime
 * 3) Thin listen.js entry
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const backup = path.join(root, "listen.monolith.bak.js");
const srcPath = fs.existsSync(backup) ? backup : path.join(root, "listen.js");

let text = fs.readFileSync(srcPath, "utf8");
if (!fs.existsSync(backup)) {
  fs.writeFileSync(backup, text);
  console.log("Wrote backup listen.monolith.bak.js");
}

const nl = text.includes("\r\n") ? "\r\n" : "\n";
const lines = text.split(/\r?\n/);

let bootIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i] === "resize();") bootIdx = i;
}
if (bootIdx < 0) throw new Error("Could not find boot resize();");

// Function declarations that appear after the boot marker must stay at module scope
// (they were historically mixed into the wiring block — e.g. applySunScale).
const headLines = lines.slice(0, bootIdx);
const bootLinesRaw = lines.slice(bootIdx);
const liftedFns = [];
const bootLines = [];
let i = 0;
while (i < bootLinesRaw.length) {
  const line = bootLinesRaw[i];
  if (line.match(/^function\s+\w+/)) {
    const name = line.match(/^function\s+(\w+)/)[1];
    const block = [line];
    i++;
    // naive brace match for function body
    let depth = 0;
    let started = false;
    // include the starting line's braces
    for (const ch of line) {
      if (ch === "{") {
        depth++;
        started = true;
      } else if (ch === "}") depth--;
    }
    if (!started) {
      // body on following lines
      while (i < bootLinesRaw.length) {
        const L = bootLinesRaw[i];
        block.push(L);
        for (const ch of L) {
          if (ch === "{") {
            depth++;
            started = true;
          } else if (ch === "}") depth--;
        }
        i++;
        if (started && depth <= 0) break;
      }
    } else if (depth > 0) {
      while (i < bootLinesRaw.length && depth > 0) {
        const L = bootLinesRaw[i];
        block.push(L);
        for (const ch of L) {
          if (ch === "{") depth++;
          else if (ch === "}") depth--;
        }
        i++;
      }
    } else {
      // single-line function — already complete
    }
    // applySunScale historically closed over boot-local slider refs — rewrite
    // so a lifted module-scope copy does not throw and abort startRuntime.
    if (name === "applySunScale") {
      const rewritten = block.join(nl)
        .replace(
          /if \(sunScaleSlider\) sunScaleSlider\.value = String\(SUN_SCALE\);\r?\n\s*if \(sunScaleVal\) sunScaleVal\.textContent = SUN_SCALE\.toFixed\(2\);/,
          `const sunScaleSliderEl = document.getElementById("fx-sun-scale");
  const sunScaleValEl = document.getElementById("fx-sun-scale-val");
  if (sunScaleSliderEl) sunScaleSliderEl.value = String(SUN_SCALE);
  if (sunScaleValEl) sunScaleValEl.textContent = SUN_SCALE.toFixed(2);`
        );
      liftedFns.push(`// lifted from boot wiring: ${name}`, rewritten, "");
      continue;
    }
    liftedFns.push(`// lifted from boot wiring: ${name}`, ...block, "");
    continue;
  }
  bootLines.push(line);
  i++;
}

let head = [...headLines, "", ...liftedFns].join(nl);
// Module lives under lib/ — stamp file stays at site root
head = head.replace(
  'new URL("./version.json", import.meta.url)',
  'new URL("../version.json", import.meta.url)'
);
const boot = bootLines.join(nl);

fs.mkdirSync(path.join(root, "lib", "scenes"), { recursive: true });

const runtime = `/**
 * Sunwake runtime — core implementation (migrated from the listen.js monolith).
 * Boot is deferred to {@link startRuntime} so {@link SunwakeApp} can compose OOP facades first.
 */

${head}

/** Start the viz loop and wire DOM — call once from SunwakeApp. */
export function startRuntime() {
${boot
  .split(/\r?\n/)
  .map((l) => (l.length ? "  " + l : l))
  .join(nl)}
}

export {
  // mode / UI
  vizMode,
  VIZ_MODES,
  VIZ_MODE_LABELS,
  isSeaDrive,
  vizModeLabel,
  setVizMode,
  syncVizModeUi,
  setVizPickerOpen,
  toggleVizPicker,
  // fx
  FX,
  FX_TOGGLES,
  FX_REQUIRES,
  FX_LABELS,
  fxOn,
  syncFxDependencies,
  applySunScale,
  // audio / playback
  ensureGraph,
  start,
  toggle,
  restart,
  loadFile,
  startSystemListen,
  stopSystemListen,
  playing,
  started,
  sourceMode,
  levels,
  // canvas
  canvas,
  ctx,
  stage,
  W,
  H,
  dpr,
  resize,
  PERF,
  updatePerf,
  sparkCap,
  // camera / sun
  CAM,
  updateCamera,
  vanishX,
  applyWorldTransform,
  resetScreenTransform,
  SUN_SCALE,
  sunAnchor,
  sunDiskRadius,
  // world
  seedWorld,
  seedSkylineCity,
  seedArcadeStars,
  seedStormClouds,
  updateFx,
  // scenes draw
  drawNightDrive,
  drawTunnel,
  drawArcadeCabinet,
  drawSkyline,
  updateArcadeEq,
  updateSkylineEq,
  // frame
  frame,
  // input helpers
  onKey,
  onDragOver,
  onDragLeave,
  onDrop,
  setUiHidden,
  toggleUiHidden,
  setFxPanelHidden,
  toggleFxPanelHidden,
  showFileChrome,
  showSystemChrome,
  // math
  smooth,
  bandEnergy,
  swapRemove,
  synthRainbow,
  midCentroid,
  WHIP_VERTICALS,
};
`;

fs.writeFileSync(path.join(root, "lib", "runtime.js"), runtime);
console.log("lib/runtime.js", runtime.length, "chars");

// --- Facade modules ---

const write = (rel, body) => {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, body.replace(/\n/g, nl));
  console.log("wrote", rel);
};

write(
  "lib/math.js",
  `/** Pure helpers — re-exported from runtime for a stable public surface. */
export { smooth, bandEnergy, swapRemove, synthRainbow, midCentroid } from "./runtime.js";
`
);

write(
  "lib/perf.js",
  `import { PERF, updatePerf as _updatePerf, sparkCap as _sparkCap } from "./runtime.js";

/** Performance knobs + frame dt EMA. */
export class PerfMonitor {
  get state() {
    return PERF;
  }
  update(now) {
    _updatePerf(now);
  }
  sparkCap() {
    return _sparkCap();
  }
}

export { PERF, updatePerf, sparkCap } from "./runtime.js";
`
);

write(
  "lib/dom.js",
  `/**
 * DOM element lookups for Sunwake chrome.
 * Runtime also binds these at module scope; this class is the OOP entry for UI code.
 */
export class DomRefs {
  constructor(root = document) {
    this.canvas = root.getElementById("viz");
    this.stage = root.getElementById("stage");
    this.gate = root.getElementById("gate");
    this.playBtn = root.getElementById("play");
    this.systemPlayBtn = root.getElementById("system-play");
    this.systemChromeBtn = root.getElementById("system-chrome");
    this.toggleBtn = root.getElementById("toggle");
    this.restartBtn = root.getElementById("restart");
    this.pickBtn = root.getElementById("pick-btn");
    this.filePick = root.getElementById("file-pick");
    this.trackTitleEl = root.getElementById("track-title");
    this.statusEl = root.getElementById("status");
    this.bassDot = root.getElementById("bass-dot");
    this.midDot = root.getElementById("mid-dot");
    this.airDot = root.getElementById("air-dot");
    this.chromePresets = root.getElementById("chrome-presets");
    this.hideUiBtn = root.getElementById("hide-ui");
    this.uiPeek = root.getElementById("ui-peek");
    this.brandEyebrow = root.getElementById("brand-eyebrow");
    this.vizSwitchBtn = root.getElementById("viz-switch");
    this.vizPicker = root.getElementById("viz-picker");
    this.fxPanel = root.getElementById("fx-panel");
    this.fxPanelCollapse = root.getElementById("fx-panel-collapse");
    this.fxPanelHide = root.getElementById("fx-panel-hide");
    this.fxPeek = root.getElementById("fx-peek");
    this.fxPanelDrag = root.getElementById("fx-panel-drag");
    this.sunScaleSlider = root.getElementById("fx-sun-scale");
    this.sunScaleVal = root.getElementById("fx-sun-scale-val");
  }

  get ctx() {
    return this.canvas.getContext("2d", { alpha: false });
  }
}
`
);

write(
  "lib/fxConfig.js",
  `import {
  FX_TOGGLES,
  FX_REQUIRES,
  FX_LABELS,
  fxOn as _fxOn,
  syncFxDependencies as _sync,
  applySunScale as _applySunScale,
  WHIP_VERTICALS,
} from "./runtime.js";

/** Effects panel toggles + dependency rules. */
export class FxConfig {
  get toggles() {
    return FX_TOGGLES;
  }
  get requires() {
    return FX_REQUIRES;
  }
  get labels() {
    return FX_LABELS;
  }
  on(key) {
    return _fxOn(key);
  }
  syncDependencies() {
    _sync();
  }
  applySunScale(raw) {
    _applySunScale(raw);
  }
  get whipVerticals() {
    return WHIP_VERTICALS;
  }
}

export { FX_TOGGLES, FX_REQUIRES, FX_LABELS, fxOn, syncFxDependencies, applySunScale } from "./runtime.js";
`
);

write(
  "lib/fxRuntime.js",
  `import { FX } from "./runtime.js";

/** Mutable per-frame FX energy / clocks. */
export class FxRuntime {
  get state() {
    return FX;
  }
}

export { FX } from "./runtime.js";
`
);

write(
  "lib/vizMode.js",
  `import {
  vizMode,
  VIZ_MODES,
  VIZ_MODE_LABELS,
  isSeaDrive,
  vizModeLabel,
  setVizMode as _set,
  syncVizModeUi as _sync,
  setVizPickerOpen as _open,
  toggleVizPicker as _toggle,
} from "./runtime.js";

/** Visualizer mode selection + chrome picker. */
export class VizModeController {
  get mode() {
    return vizMode;
  }
  get modes() {
    return VIZ_MODES;
  }
  get labels() {
    return VIZ_MODE_LABELS;
  }
  label(mode) {
    return vizModeLabel(mode);
  }
  isSeaDrive() {
    return isSeaDrive();
  }
  set(mode) {
    _set(mode);
  }
  syncUi() {
    _sync();
  }
  setPickerOpen(open) {
    _open(open);
  }
  togglePicker() {
    _toggle();
  }
}

export {
  vizMode,
  VIZ_MODES,
  VIZ_MODE_LABELS,
  isSeaDrive,
  vizModeLabel,
  setVizMode,
  syncVizModeUi,
  setVizPickerOpen,
  toggleVizPicker,
} from "./runtime.js";
`
);

write(
  "lib/sun.js",
  `import { sunAnchor, sunDiskRadius, SUN_SCALE } from "./runtime.js";

/** Sun / black-hole geometry helpers. */
export class SunModel {
  get scale() {
    return SUN_SCALE;
  }
  anchor() {
    return sunAnchor();
  }
  diskRadius(bass = 0, solo = 0, pulseEnabled = false) {
    return sunDiskRadius(bass, solo, pulseEnabled);
  }
}

export { sunAnchor, sunDiskRadius, SUN_SCALE } from "./runtime.js";
`
);

write(
  "lib/camera.js",
  `import {
  CAM,
  updateCamera as _update,
  vanishX as _vanishX,
  applyWorldTransform as _apply,
  resetScreenTransform as _reset,
} from "./runtime.js";

/** World camera sway + canvas transforms. */
export class Camera {
  get state() {
    return CAM;
  }
  update(now, bass, mid, air, peak, snare) {
    _update(now, bass, mid, air, peak, snare);
  }
  vanishX() {
    return _vanishX();
  }
  applyWorldTransform() {
    _apply();
  }
  resetScreenTransform() {
    _reset();
  }
}

export { CAM, updateCamera, vanishX, applyWorldTransform, resetScreenTransform } from "./runtime.js";
`
);

write(
  "lib/audio.js",
  `import {
  ensureGraph,
  start,
  toggle,
  restart,
  loadFile,
  startSystemListen,
  stopSystemListen,
  playing,
  started,
  sourceMode,
  levels,
} from "./runtime.js";

/** Web Audio graph, file + system capture, level meters. */
export class AudioEngine {
  get levels() {
    return levels;
  }
  get playing() {
    return playing;
  }
  get started() {
    return started;
  }
  get sourceMode() {
    return sourceMode;
  }
  ensureGraph() {
    return ensureGraph();
  }
  start() {
    return start();
  }
  toggle() {
    return toggle();
  }
  restart() {
    return restart();
  }
  loadFile(file) {
    return loadFile(file);
  }
  startSystemListen(e) {
    return startSystemListen(e);
  }
  stopSystemListen() {
    return stopSystemListen();
  }
}

export {
  ensureGraph,
  start,
  toggle,
  restart,
  loadFile,
  startSystemListen,
  stopSystemListen,
  playing,
  started,
  sourceMode,
  levels,
} from "./runtime.js";
`
);

write(
  "lib/ui.js",
  `import {
  setUiHidden,
  toggleUiHidden,
  setFxPanelHidden,
  toggleFxPanelHidden,
  showFileChrome,
  showSystemChrome,
  syncFxDependencies,
} from "./runtime.js";

/** Gate / chrome / FX panel visibility. */
export class ChromeUi {
  setUiHidden(hidden) {
    setUiHidden(hidden);
  }
  toggleUiHidden() {
    toggleUiHidden();
  }
  setFxPanelHidden(hidden) {
    setFxPanelHidden(hidden);
  }
  toggleFxPanelHidden() {
    toggleFxPanelHidden();
  }
  showFileChrome() {
    showFileChrome();
  }
  showSystemChrome() {
    showSystemChrome();
  }
  syncFxDependencies() {
    syncFxDependencies();
  }
}

export {
  setUiHidden,
  toggleUiHidden,
  setFxPanelHidden,
  toggleFxPanelHidden,
  showFileChrome,
  showSystemChrome,
} from "./runtime.js";
`
);

write(
  "lib/input.js",
  `import { onKey, onDragOver, onDragLeave, onDrop } from "./runtime.js";

/** Keyboard + drag/drop bindings (wired inside startRuntime; class exposes handlers). */
export class InputBindings {
  onKey(e) {
    onKey(e);
  }
  onDragOver(e) {
    onDragOver(e);
  }
  onDragLeave(e) {
    onDragLeave(e);
  }
  onDrop(e) {
    onDrop(e);
  }
}

export { onKey, onDragOver, onDragLeave, onDrop } from "./runtime.js";
`
);

write(
  "lib/grid.js",
  `/** Grid sea flocks / meteors / mirror / bass mountain — implemented in runtime. */
export {};
`
);

write(
  "lib/particles.js",
  `import { seedWorld } from "./runtime.js";

/** Shared particle world seed + atmosphere draw (runtime-backed). */
export class ParticleSystem {
  seed() {
    seedWorld();
  }
}

export { seedWorld } from "./runtime.js";
`
);

write(
  "lib/simulation.js",
  `import { updateFx } from "./runtime.js";

/** Per-frame FX simulation (onsets, spawns, lifetimes). */
export class Simulation {
  update(bass, mid, air, now, peak, snare, hat, leadPitch) {
    updateFx(bass, mid, air, now, peak, snare, hat, leadPitch);
  }
}

export { updateFx } from "./runtime.js";
`
);

write(
  "lib/scenes/base.js",
  `/** Base visualizer scene. */
export class VizScene {
  /** @param {import('../app.js').SunwakeApp} app */
  constructor(app) {
    this.app = app;
  }
  onEnter(_prev) {}
  onExit(_next) {}
  onResize(_w, _h) {}
  update(_dt, _levels, _fx) {}
  draw(_now, _levels, _fx) {}
}
`
);

write(
  "lib/scenes/nightDrive.js",
  `import { VizScene } from "./base.js";
import { drawNightDrive } from "../runtime.js";

/** Perspective grid sea — default Sunwake night. */
export class NightDriveScene extends VizScene {
  draw(now, levels, fx) {
    const { bass, mid, air, peak, snare, hat } = levels;
    drawNightDrive(now, bass, mid, air, peak, snare, hat, fx.solo ?? 0);
  }
}
`
);

write(
  "lib/scenes/rainDrive.js",
  `import { VizScene } from "./base.js";
import { drawNightDrive, seedStormClouds } from "../runtime.js";

/**
 * Storm cousin of Night Drive — same draw path; runtime branches on vizMode.
 * Owns storm seed on enter.
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
`
);

write(
  "lib/scenes/skyline.js",
  `import { VizScene } from "./base.js";
import { drawSkyline, seedSkylineCity, updateSkylineEq } from "../runtime.js";

/** Side-view highway + fractal city. */
export class SkylineScene extends VizScene {
  onResize() {
    seedSkylineCity();
  }
  update(_dt, _levels, _fx) {
    // EQ + scroll advance inside drawSkyline today; kept for future extraction.
  }
  draw(now, levels, fx) {
    const { bass, mid, air, peak, snare, hat } = levels;
    updateSkylineEq(now);
    drawSkyline(now, bass, mid, air, peak, snare, hat, fx.solo ?? 0);
  }
}
`
);

write(
  "lib/scenes/tunnel.js",
  `import { VizScene } from "./base.js";
import { drawTunnel } from "../runtime.js";

/** Octagonal rib tunnel — bass pulse rings. */
export class TunnelScene extends VizScene {
  draw(now, levels, fx) {
    const { bass, mid, air, peak, snare, hat } = levels;
    drawTunnel(now, bass, mid, air, peak, snare, hat, fx.solo ?? 0);
  }
}
`
);

write(
  "lib/scenes/arcade.js",
  `import { VizScene } from "./base.js";
import { drawArcadeCabinet, seedArcadeStars, updateArcadeEq } from "../runtime.js";

/** CRT cabinet — vector starfield + coin-op EQ chrome. */
export class ArcadeScene extends VizScene {
  onEnter() {
    seedArcadeStars();
  }
  update(_dt, _levels, _fx) {
    // Warp / EQ advance inside drawArcadeCabinet today; kept for future extraction.
  }
  draw(now, levels, fx) {
    const { bass, mid, air, peak, snare, hat } = levels;
    updateArcadeEq(now);
    drawArcadeCabinet(now, bass, mid, air, peak, snare, hat, fx.solo ?? 0);
  }
}
`
);

write(
  "lib/renderer.js",
  `import { frame, resize, PERF } from "./runtime.js";

/** RAF owner — delegates to runtime frame (scene dispatch lives there today). */
export class Renderer {
  /** @param {import('./app.js').SunwakeApp} app */
  constructor(app) {
    this.app = app;
    this._raf = 0;
  }
  resize() {
    resize();
  }
  /** Kick the shared runtime loop (idempotent with runtime's own rAF). */
  start() {
    // runtime startRuntime already schedules rAF; this exists for API completeness
    if (!this._raf) {
      // frame self-reschedules; calling once is enough if runtime hasn't
      this._raf = 1;
    }
  }
  get perf() {
    return PERF;
  }
}

export { frame, resize } from "./runtime.js";
`
);

write(
  "lib/app.js",
  `import { DomRefs } from "./dom.js";
  import { PerfMonitor } from "./perf.js";
  import { FxConfig } from "./fxConfig.js";
  import { FxRuntime } from "./fxRuntime.js";
  import { VizModeController } from "./vizMode.js";
  import { SunModel } from "./sun.js";
  import { Camera } from "./camera.js";
  import { AudioEngine } from "./audio.js";
  import { ChromeUi } from "./ui.js";
  import { InputBindings } from "./input.js";
  import { ParticleSystem } from "./particles.js";
  import { Simulation } from "./simulation.js";
  import { Renderer } from "./renderer.js";
  import { NightDriveScene } from "./scenes/nightDrive.js";
  import { RainDriveScene } from "./scenes/rainDrive.js";
  import { SkylineScene } from "./scenes/skyline.js";
  import { TunnelScene } from "./scenes/tunnel.js";
  import { ArcadeScene } from "./scenes/arcade.js";
  import { startRuntime, vizMode } from "./runtime.js";

/**
 * Sunwake application composer — OOP surface over the runtime engine.
 */
export class SunwakeApp {
  constructor() {
    this.dom = new DomRefs();
    this.perf = new PerfMonitor();
    this.fxConfig = new FxConfig();
    this.fxRuntime = new FxRuntime();
    this.vizMode = new VizModeController();
    this.sun = new SunModel();
    this.camera = new Camera();
    this.audio = new AudioEngine();
    this.ui = new ChromeUi();
    this.input = new InputBindings();
    this.particles = new ParticleSystem();
    this.simulation = new Simulation();
    this.renderer = new Renderer(this);
    this.scenes = {
      nightDrive: new NightDriveScene(this),
      rainDrive: new RainDriveScene(this),
      skyline: new SkylineScene(this),
      tunnel: new TunnelScene(this),
      arcade: new ArcadeScene(this),
    };
  }

  /** Active scene instance for the current viz mode. */
  get scene() {
    return this.scenes[vizMode] || this.scenes.nightDrive;
  }

  /** Wire DOM, seed world, start the render loop. */
  start() {
    startRuntime();
    this.renderer.start();
    return this;
  }
}
`
);

write(
  "listen.js",
  `/**
 * Sunwake — entry.
 * Implementation lives under ./lib (OOP services + scenes + runtime engine).
 */
import { SunwakeApp } from "./lib/app.js";

const app = new SunwakeApp();
app.start();

export { app, SunwakeApp };
`
);

console.log("OK — modules built. Entry is thin listen.js");
// Note: do not mutate _check-public.js here — it already scans lib/.
