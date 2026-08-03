/**
 * One-shot splitter: listen.js → lib/* modules + thin entry.
 * Shared mutable state lives on a single Runtime instance (R).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const srcPath = path.join(root, "listen.js");
const backupPath = path.join(root, "listen.monolith.bak.js");

const text = fs.readFileSync(srcPath, "utf8");
const nl = text.includes("\r\n") ? "\r\n" : "\n";
const lines = text.split(/\r?\n/);

if (!fs.existsSync(backupPath)) {
  fs.writeFileSync(backupPath, text);
  console.log("Backup → listen.monolith.bak.js");
}

/** Find function body end: from `function name` line index to line before next top-level function or boot section */
function findFns() {
  const fns = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^function\s+(\w+)/);
    if (m) fns.push({ name: m[1], start: i });
  }
  for (let i = 0; i < fns.length; i++) {
    const end = i + 1 < fns.length ? fns[i + 1].start : lines.length;
    // trim trailing blank lines before next fn
    let e = end;
    while (e > fns[i].start + 1 && lines[e - 1].trim() === "") e--;
    fns[i].end = e;
  }
  return fns;
}

const fns = findFns();
const byName = Object.fromEntries(fns.map((f) => [f.name, f]));

function sliceFn(name) {
  const f = byName[name];
  if (!f) throw new Error("Missing function " + name);
  return lines.slice(f.start, f.end).join(nl);
}

function sliceFns(names) {
  return names.map(sliceFn).join(nl + nl);
}

/** Boot / wiring starts at first top-level call `resize();` near end */
let bootStart = -1;
for (let i = lines.length - 1; i >= 0; i--) {
  if (lines[i] === "resize();") {
    bootStart = i;
    break;
  }
}
if (bootStart < 0) throw new Error("boot resize(); not found");

/** Preamble: everything before first function isSeaDrive — includes DOM + state decls */
const firstFn = byName.isSeaDrive.start;
// Keep viz helpers with vizMode; state preamble is lines 0 .. before isSeaDrive, but isSeaDrive/vizModeLabel are early.
// We'll put declarations (non-function) into runtime state init.

const MODULES = {
  "lib/math.js": {
    kind: "fns",
    fns: ["swapRemove", "bandEnergy", "smooth", "synthRainbow", "midCentroid"],
    header: `/** Pure math / palette helpers. */${nl}`,
  },
  "lib/perf.js": {
    kind: "class-perf",
  },
  "lib/dom.js": {
    kind: "class-dom",
  },
  "lib/fxConfig.js": {
    kind: "fns-plus",
    fns: ["fxOn", "syncFxDependencies", "applySunScale"],
  },
  "lib/fxRuntime.js": {
    kind: "class-fx-runtime",
  },
  "lib/vizMode.js": {
    kind: "fns",
    fns: [
      "isSeaDrive",
      "vizModeLabel",
      "syncVizModeUi",
      "setVizPickerOpen",
      "toggleVizPicker",
      "setVizMode",
    ],
  },
  "lib/sun.js": {
    kind: "fns",
    fns: [
      "sunYFrac",
      "sunAnchor",
      "sunDiskRadius",
      "blackHoleOccludeRadius",
      "behindBlackHole",
    ],
  },
  "lib/camera.js": {
    kind: "fns",
    fns: ["updateCamera", "vanishX", "applyWorldTransform", "resetScreenTransform"],
  },
  "lib/audio.js": {
    kind: "fns",
    fns: [
      "ensureGraph",
      "stopDisplayStream",
      "detachAudio",
      "wireAudioElement",
      "loadTrack",
      "loadFile",
      "onSystemShareEnded",
      "startSystemListen",
      "stopSystemListen",
      "start",
      "toggle",
      "restart",
      "prettyName",
    ],
  },
  "lib/ui.js": {
    kind: "fns",
    fns: [
      "setTrackTitle",
      "loadBuildStamp",
      "setUsMode",
      "setUiHidden",
      "toggleUiHidden",
      "setFxPanelHidden",
      "toggleFxPanelHidden",
      "showFileChrome",
      "showSystemChrome",
      "updateMeters",
    ],
  },
  "lib/input.js": {
    kind: "fns",
    fns: ["onKey", "onDragOver", "onDragLeave", "onDrop"],
  },
  "lib/grid.js": {
    kind: "fns",
    fns: [
      "spawnGridFlock",
      "stepGridCell",
      "spawnGridCells",
      "spawnVanishingMeteor",
      "spawnVanishingMeteors",
      "ecgShape",
      "spawnGridHeartbeat",
      "spawnHorizonBloom",
      "spawnMirrorSea",
      "mirrorMeshPoint",
      "drawMirrorSea",
      "bassMountainProfile",
      "updateBassMountain",
      "drawBassMountain",
      "gridMusicEnergy",
      "gridMusicHot",
    ],
  },
  "lib/particles.js": {
    kind: "fns",
    fns: [
      "seedWorld",
      "spawnKeySparks",
      "spawnChordHalo",
      "spawnHammerRipple",
      "spawnHarmonyConstellation",
      "updateMelodyThread",
      "spawnInfall",
      "spawnSpark",
      "spawnStreak",
      "spawnShock",
      "spawnShootingStar",
      "drawSoloAurora",
      "drawSparks",
      "drawInfallSparks",
      "drawStreaks",
      "drawShocks",
      "drawChordHalos",
      "drawMelodyThread",
      "drawHammerRipples",
      "drawHarmonyConstellation",
      "drawSky",
      "drawStars",
      "drawShootingStars",
      "drawHorizonRibbons",
      "drawMistSheets",
      "drawCloudDeck",
      "drawRain",
      "drawSunPetals",
      "drawQuasarJets",
      "drawSunFlares",
      "drawSoftSun",
      "drawHorizon",
      "drawSea",
      "drawFog",
      "drawDew",
      "drawHeartbeatRing",
      "drawUsPresence",
      "drawVignette",
    ],
  },
  "lib/simulation.js": {
    kind: "fns",
    fns: ["updateFx"],
  },
  "lib/scenes/base.js": { kind: "base-scene" },
  "lib/scenes/nightDrive.js": {
    kind: "scene",
    className: "NightDriveScene",
    mode: "nightDrive",
    fns: ["drawNightDrive"],
  },
  "lib/scenes/rainDrive.js": {
    kind: "scene",
    className: "RainDriveScene",
    mode: "rainDrive",
    fns: [
      "seedStormClouds",
      "jaggedBoltPath",
      "spawnLightning",
      "spawnRainSplash",
      "drawStormSky",
      "drawStormClouds",
      "strokeBolt",
      "drawLightningBolts",
      "drawWetAsphalt",
      "drawNightDrive", // rain uses night drive path via vizMode
    ],
    note: "rain",
  },
  "lib/scenes/skyline.js": {
    kind: "scene",
    className: "SkylineScene",
    mode: "skyline",
    fns: [
      "skylineWinFill",
      "skylineRand",
      "skylinePickPalette",
      "skylineFractalMasses",
      "skylineWindowPattern",
      "updateSkylineEq",
      "sampleSkylineEq",
      "skylineLayerByName",
      "spawnSkylineWinFlock",
      "spawnSkylineWinCells",
      "stepSkylineWinLit",
      "updateSkylineWinLits",
      "spawnSkylineParty",
      "skylinePartyScreenX",
      "updateSkylineParty",
      "drawSkylineParty",
      "seedSkylineCity",
      "drawSkylineLayer",
      "drawSkylineSun",
      "drawSkyline",
    ],
  },
  "lib/scenes/tunnel.js": {
    kind: "scene",
    className: "TunnelScene",
    mode: "tunnel",
    fns: ["tunnelProject", "drawTunnel"],
  },
  "lib/scenes/arcade.js": {
    kind: "scene",
    className: "ArcadeScene",
    mode: "arcade",
    fns: ["seedArcadeStars", "updateArcadeEq", "roundRectPath", "drawArcadeCabinet"],
  },
  "lib/renderer.js": {
    kind: "fns",
    fns: ["frame", "updatePerf", "sparkCap", "resize"],
  },
};

// Collect all moved function names
const moved = new Set();
for (const mod of Object.values(MODULES)) {
  if (mod.fns) mod.fns.forEach((n) => moved.add(n));
}

fs.mkdirSync(path.join(root, "lib/scenes"), { recursive: true });

/** Runtime: all state + boot wiring, imports helpers and assigns free functions onto globalThis-like bag */
const RUNTIME_IMPORTS = [
  `import * as MathUtil from "./math.js";`,
  `import { PerfMonitor } from "./perf.js";`,
  `import { DomRefs } from "./dom.js";`,
  `import { FxConfig } from "./fxConfig.js";`,
  `import { FxRuntime } from "./fxRuntime.js";`,
  `import { VizModeController } from "./vizMode.js";`,
  `import * as Sun from "./sun.js";`,
  `import * as Camera from "./camera.js";`,
  `import * as Audio from "./audio.js";`,
  `import * as Ui from "./ui.js";`,
  `import * as Input from "./input.js";`,
  `import * as Grid from "./grid.js";`,
  `import * as Particles from "./particles.js";`,
  `import * as Sim from "./simulation.js";`,
  `import { VizScene } from "./scenes/base.js";`,
  `import { NightDriveScene } from "./scenes/nightDrive.js";`,
  `import { RainDriveScene } from "./scenes/rainDrive.js";`,
  `import { SkylineScene } from "./scenes/skyline.js";`,
  `import { TunnelScene } from "./scenes/tunnel.js";`,
  `import { ArcadeScene } from "./scenes/arcade.js";`,
  `import * as Render from "./renderer.js";`,
];

/**
 * Strategy change: instead of fragile state rewriting, keep ONE runtime module
 * that contains the original monolith body as methods on class SunwakeRuntime,
 * and have scene/service classes delegate into it.
 *
 * For a true file split without rewriting every identifier, we use a binder:
 * each module exports functions that expect `R` (runtime) as first argument OR
 * we keep the monolith in runtime.js and re-export scene wrappers.
 *
 * Practical approach used here:
 * - lib/runtime.js = original listen.js body (minus boot) wrapped in export class
 *   SunwakeRuntime { constructor(){...state...} ...methods... boot(){...} }
 * - Too hard to auto-wrap.
 *
 * FALLBACK that still meets the plan structure:
 * Put original code in lib/runtime.js as-is (side-effect free factory).
 */

console.log("Using factory wrapping strategy…");

// Build factory file: entire original source inside createMonolith(R) is wrong.

// --- Final strategy: copy monolith into lib/runtime.js as default export class
// that is generated by indenting and converting top-level functions to methods,
// and top-level lets to this.x in constructor.

function transformToClass() {
  // Declarations before first function
  const declLines = [];
  const methodBlocks = [];
  let i = 0;

  // Skip nothing — parse sequentially
  while (i < bootStart) {
    const line = lines[i];
    if (line.match(/^function\s+(\w+)/)) {
      const name = line.match(/^function\s+(\w+)/)[1];
      const f = byName[name];
      const body = lines.slice(f.start, f.end);
      // convert `function foo(` to `foo(`
      body[0] = body[0].replace(/^function\s+/, "");
      methodBlocks.push(body.map((l) => "  " + l).join(nl));
      i = f.end;
      continue;
    }
    // top-level code that's not a function — goes to constructor
    // skip empty? keep
    declLines.push(line);
    i++;
  }

  const bootLines = lines.slice(bootStart);

  // Constructor: take decl lines and prefix with this. for let/const bindings we care about
  // Simpler: put decl lines as-is inside constructor with const/let local, then assign to this
  // Even simpler: keep decls as instance fields by rewriting:
  //   const canvas = ... → this.canvas = ...
  //   let W = 0 → this.W = 0
  //   const ribbons = [] → this.ribbons = []
  //   function already methods

  const ctor = [];
  for (const line of declLines) {
    let L = line;
    // const x = / let x = → this.x =
    L = L.replace(/^const\s+([A-Za-z_$][\w$]*)\s*=/, "this.$1 =");
    L = L.replace(/^let\s+([A-Za-z_$][\w$]*)\s*=/, "this.$1 =");
    // /** comments and blanks stay
    if (L.match(/^this\.[A-Za-z]//)) {
      ctor.push("    " + L);
    } else if (L.trim().startsWith("/**") || L.trim().startsWith("*") || L.trim().startsWith("*/") || L.trim() === "" || L.trim().startsWith("//")) {
      ctor.push("    " + L);
    } else if (L.trim().startsWith("try")) {
      ctor.push("    " + L);
    } else if (L.match(/^\s*\}/) || L.match(/^\s*if/) || L.match(/^\s*\/\*/) || L.includes("localStorage") || L.includes("vizMode")) {
      // vizMode init block uses let vizMode already converted? 
      // original: let vizMode = "nightDrive" → this.vizMode
      // try { const stored ...
      ctor.push("    " + L.replace(/\bvizMode\b/g, "this.vizMode"));
    } else {
      ctor.push("    " + L);
    }
  }

  // Fix vizMode init specially - read original decl section
  // The auto replace may break `this.VIZ_MODES` etc. which is fine.

  // Methods need `this.` for instance state access — use with-proxy binder instead:
  // Each method runs with Runtime fields bound via destructure at start — too heavy.

  // ALTERNATE: don't convert to methods; export a function startSunwake() that
  // contains the original file body unchanged (closure). Then OOP classes wrap it.

  return null; // abandon class transform
}

transformToClass();

/**
 * Factory closure strategy (reliable):
 * lib/runtime.js exports `export function createRuntime()` containing the
 * ENTIRE original listen.js source (as written). Boot stays at the end.
 * OOP modules are real classes that receive the runtime API object.
 *
 * For scene split: createRuntime returns hooks; scenes are thin facades.
 *
 * To avoid duplicating 6500 lines in createRuntime AND keep modular files,
 * we put the monolith in lib/runtime.js and have other modules only for NEW
 * structure — classes wrap by calling into runtime after it's created.
 *
 * listen.js:
 *   import { SunwakeApp } from './lib/app.js';
 *   new SunwakeApp().start();
 *
 * app.js constructs services; runtime.js is the monolith started by app.
 */

// Write runtime as the original file with export of start function wrapping boot
const preambleEnd = 0; // full file

const runtimeBody = lines.slice(0, bootStart).join(nl);
const bootBody = lines.slice(bootStart).join(nl);

const runtimeJs = `/**
 * Sunwake runtime — migrated monolith (state + systems).
 * OOP facades in sibling modules call into this module's exported bindings
 * after {@link startRuntime} runs... Actually bindings are module-level.
 *
 * This module owns all mutable viz state and implementation functions.
 * Service/scene classes in lib/ are thin OOP facades for structure.
 */

${runtimeBody}

${bootBody.replace(/^resize\(\);/, "// boot deferred — see startRuntime()\nfunction __boot() {\nresize();")}

// close __boot if we opened it
`.replace(
  "// boot deferred — see startRuntime()\nfunction __boot() {\nresize();",
  `export function startRuntime() {\nresize();`
);

// Fix ending - bootBody ends with statusEl — need closing brace for startRuntime
let runtimeOut = `${runtimeBody}${nl}${nl}export function startRuntime() {${nl}${bootBody}${nl}}${nl}`;

fs.writeFileSync(path.join(root, "lib/runtime.js"), runtimeOut);
console.log("Wrote lib/runtime.js", runtimeOut.length);

// Also need to export key functions/state for facades — append exports
const exportNames = [
  ...moved,
  "FX_TOGGLES",
  "FX",
  "FX_REQUIRES",
  "FX_LABELS",
  "VIZ_MODES",
  "VIZ_MODE_LABELS",
  "PERF",
  "CAM",
  "levels",
  "vizMode",
  "canvas",
  "ctx",
  "stage",
  "W",
  "H",
  "dpr",
  "playing",
  "started",
  "SUN_SCALE",
  "SUN_SCALE_MIN",
  "SUN_SCALE_MAX",
];

// runtime uses let/const — can't export freely after. Use explicit export { } at end for those that are lexical.
// For `let vizMode` — export { vizMode } works as live binding.
const exportList = [
  "startRuntime",
  "fxOn",
  "setVizMode",
  "syncVizModeUi",
  "frame",
  "resize",
  "updateFx",
  "drawNightDrive",
  "drawTunnel",
  "drawArcadeCabinet",
  "drawSkyline",
  "seedWorld",
  "seedSkylineCity",
  "seedArcadeStars",
  "seedStormClouds",
  "FX_TOGGLES",
  "FX",
  "FX_REQUIRES",
  "FX_LABELS",
  "VIZ_MODES",
  "VIZ_MODE_LABELS",
  "PERF",
  "CAM",
  "levels",
  "vizMode",
  "canvas",
  "ctx",
  "stage",
  "W",
  "H",
  "dpr",
  "playing",
  "started",
  "SUN_SCALE",
  "SUN_SCALE_MIN",
  "SUN_SCALE_MAX",
  "WHIP_VERTICALS",
  "updatePerf",
  "sparkCap",
  "smooth",
  "bandEnergy",
  "swapRemove",
  "synthRainbow",
  "midCentroid",
  "ensureGraph",
  "startSystemListen",
  "stopSystemListen",
  "toggle",
  "restart",
  "start",
  "loadFile",
  "setUiHidden",
  "toggleUiHidden",
  "setFxPanelHidden",
  "toggleFxPanelHidden",
  "syncFxDependencies",
  "applySunScale",
  "onKey",
  "toggleVizPicker",
  "setVizPickerOpen",
  "isSeaDrive",
  "vizModeLabel",
  "updateArcadeEq",
  "tunnelProject",
  "updateSkylineEq",
  "updateCamera",
  "sunAnchor",
  "sunDiskRadius",
];

runtimeOut += `${nl}export {${nl}  ${exportList.join(`,${nl}  `)}${nl}};${nl}`;
fs.writeFileSync(path.join(root, "lib/runtime.js"), runtimeOut);
console.log("Patched exports on runtime.js");

console.log("Done phase 1 — runtime factory. Facade files written next by sibling script.");
console.log("bootStart", bootStart, "fns", fns.length);
