/**
 * Comprehensive runtime.js extraction tool — slices 2-6.
 * Extracts function bodies by brace-depth tracking (no regex-heuristic end-finding).
 * Run from projects/sunwake: node tools/extract-all.js
 *
 * Dependency graph (no cycles):
 *   state ← nothing
 *   math  ← nothing
 *   perf  ← nothing
 *   camera ← state, math
 *   sun    ← state
 *   fxConfig ← state
 *   simulation ← state, math, perf, camera, sun, sceneRegistry
 *   scenes/* ← state, math, perf, simulation, camera, sun
 *   vizMode ← state, sceneRegistry, scenes/rainDrive (seed), scenes/arcade (seed), ui
 *   ui      ← state
 *   audio   ← state, ui
 *   input   ← state, audio, vizMode
 *   renderer ← state, perf, math, camera, simulation, scenes/*, sceneRegistry
 *   runtime  ← everything (thin re-exports for compatibility; still holds resize/seedWorld/startRuntime)
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const RUNTIME = path.join(ROOT, "lib", "runtime.js");

let src = fs.readFileSync(RUNTIME, "utf8");
let lines = src.split("\n");

// ── Brace-depth block finder ───────────────────────────────────────────────

/** Find first line (0-based) where pattern matches at start of trimmed line. */
function findLine(pattern, fromIdx = 0, toIdx = lines.length) {
  for (let i = fromIdx; i < toIdx; i++) {
    if (pattern.test(lines[i].trimStart())) return i;
  }
  return -1;
}

/**
 * Given a line index where a function/block starts,
 * returns [startIdx, endIdx] (inclusive) by tracking brace depth.
 */
function blockRange(startIdx) {
  let depth = 0;
  let opened = false;
  for (let i = startIdx; i < lines.length; i++) {
    const l = lines[i];
    // Count braces, ignore ones inside strings/regex (good enough for this codebase)
    let inStr = false, strChar = "";
    for (let j = 0; j < l.length; j++) {
      const c = l[j];
      if (inStr) {
        if (c === strChar && l[j - 1] !== "\\") inStr = false;
      } else if (c === '"' || c === "'" || c === "`") {
        inStr = true; strChar = c;
      } else if (c === "{") {
        depth++; opened = true;
      } else if (c === "}") {
        depth--;
      }
    }
    if (opened && depth === 0) return [startIdx, i];
  }
  return [startIdx, lines.length - 1];
}

/** Extract ranges for a list of function specs. */
function extractRanges(specs) {
  const ranges = [];
  let cursor = 0;
  for (const spec of specs) {
    const idx = findLine(spec.pattern, spec.from ?? cursor);
    if (idx === -1) {
      console.warn(`  NOT FOUND: ${spec.name} (${spec.pattern})`);
      continue;
    }
    const [s, e] = blockRange(idx);
    ranges.push({ start: s, end: e, name: spec.name });
    cursor = e + 1;
  }
  return ranges;
}

/** Get the text for a set of ranges. */
function bodyText(ranges) {
  return ranges.map(({ start, end }) => lines.slice(start, end + 1).join("\n")).join("\n\n");
}

/** Mark line indices for deletion. */
function markLines(ranges) {
  const s = new Set();
  for (const r of ranges) {
    for (let i = r.start; i <= r.end; i++) s.add(i);
    // Include trailing blank line
    if (r.end + 1 < lines.length && lines[r.end + 1].trim() === "") s.add(r.end + 1);
  }
  return s;
}

// ── Function groups ────────────────────────────────────────────────────────
// NOTE: resize() and seedWorld() stay in runtime.js (they call scene seed fns)
// NOTE: seed functions (seedStormClouds, seedArcadeStars, seedSkylineCity) stay in runtime.js
//       because they're called from runtime.js's seedWorld/resize/setVizMode.

// FX helpers → fxConfig.js
const fxConfigSpecs = [
  { name: "syncFxDependencies", pattern: /^function syncFxDependencies\(/ },
  { name: "applySunScale",       pattern: /^function applySunScale\(/ },
];

// Viz mode functions → vizMode.js
const vizModeSpecs = [
  { name: "isSeaDrive",       pattern: /^function isSeaDrive\(/ },
  { name: "vizModeLabel",     pattern: /^function vizModeLabel\(/ },
  { name: "syncVizModeUi",    pattern: /^function syncVizModeUi\(/ },
  { name: "setVizPickerOpen", pattern: /^function setVizPickerOpen\(/ },
  { name: "toggleVizPicker",  pattern: /^function toggleVizPicker\(/ },
  { name: "setVizMode",       pattern: /^function setVizMode\(/ },
];

// UI chrome → ui.js
const uiSpecs = [
  { name: "setUiHidden",          pattern: /^function setUiHidden\(/ },
  { name: "toggleUiHidden",       pattern: /^function toggleUiHidden\(/ },
  { name: "setFxPanelHidden",     pattern: /^function setFxPanelHidden\(/ },
  { name: "toggleFxPanelHidden",  pattern: /^function toggleFxPanelHidden\(/ },
  { name: "showFileChrome",       pattern: /^function showFileChrome\(/ },
  { name: "showSystemChrome",     pattern: /^function showSystemChrome\(/ },
];

// Audio → audio.js
const audioSpecs = [
  { name: "prettyName",         pattern: /^function prettyName\(/ },
  { name: "setTrackTitle",      pattern: /^function setTrackTitle\(/ },
  { name: "loadBuildStamp",     pattern: /^async function loadBuildStamp\(/ },
  { name: "ensureGraph",        pattern: /^function ensureGraph\(/ },
  { name: "stopDisplayStream",  pattern: /^function stopDisplayStream\(/ },
  { name: "detachAudio",        pattern: /^function detachAudio\(/ },
  { name: "setUsMode",          pattern: /^function setUsMode\(/ },
  { name: "wireAudioElement",   pattern: /^function wireAudioElement\(/ },
  { name: "loadTrack",          pattern: /^async function loadTrack\(/ },
  { name: "loadFile",           pattern: /^async function loadFile\(/ },
  { name: "onSystemShareEnded", pattern: /^function onSystemShareEnded\(/ },
  { name: "startSystemListen",  pattern: /^async function startSystemListen\(/ },
  { name: "stopSystemListen",   pattern: /^function stopSystemListen\(/ },
  { name: "start",              pattern: /^async function start\(/ },
  { name: "toggle",             pattern: /^function toggle\(/ },
  { name: "restart",            pattern: /^async function restart\(/ },
];

// Input → input.js
const inputSpecs = [
  { name: "onKey",       pattern: /^function onKey\(/ },
  { name: "onDragOver",  pattern: /^function onDragOver\(/ },
  { name: "onDragLeave", pattern: /^function onDragLeave\(/ },
  { name: "onDrop",      pattern: /^function onDrop\(/ },
];

// World simulation → simulation.js  (NO seed fns, NO resize, NO seedWorld)
const simSpecs = [
  { name: "spawnGridFlock",          pattern: /^function spawnGridFlock\(/ },
  { name: "stepGridCell",            pattern: /^function stepGridCell\(/ },
  { name: "spawnGridCells",          pattern: /^function spawnGridCells\(/ },
  { name: "spawnVanishingMeteor",    pattern: /^function spawnVanishingMeteor\(/ },
  { name: "spawnVanishingMeteors",   pattern: /^function spawnVanishingMeteors\(/ },
  { name: "spawnGridHeartbeat",      pattern: /^function spawnGridHeartbeat\(/ },
  { name: "spawnHorizonBloom",       pattern: /^function spawnHorizonBloom\(/ },
  { name: "spawnMirrorSea",          pattern: /^function spawnMirrorSea\(/ },
  { name: "mirrorMeshPoint",         pattern: /^function mirrorMeshPoint\(/ },
  { name: "drawMirrorSea",           pattern: /^function drawMirrorSea\(/ },
  { name: "bassMountainProfile",     pattern: /^function bassMountainProfile\(/ },
  { name: "updateBassMountain",      pattern: /^function updateBassMountain\(/ },
  { name: "drawBassMountain",        pattern: /^function drawBassMountain\(/ },
  { name: "gridMusicEnergy",         pattern: /^function gridMusicEnergy\(/ },
  { name: "gridMusicHot",            pattern: /^function gridMusicHot\(/ },
  { name: "spawnKeySparks",          pattern: /^function spawnKeySparks\(/ },
  { name: "spawnChordHalo",          pattern: /^function spawnChordHalo\(/ },
  { name: "spawnHammerRipple",       pattern: /^function spawnHammerRipple\(/ },
  { name: "spawnHarmonyConstellation", pattern: /^function spawnHarmonyConstellation\(/ },
  { name: "updateMelodyThread",      pattern: /^function updateMelodyThread\(/ },
  { name: "spawnInfall",             pattern: /^function spawnInfall\(/ },
  { name: "spawnSpark",              pattern: /^function spawnSpark\(/ },
  { name: "spawnStreak",             pattern: /^function spawnStreak\(/ },
  { name: "spawnShock",              pattern: /^function spawnShock\(/ },
  { name: "spawnShootingStar",       pattern: /^function spawnShootingStar\(/ },
  { name: "updateFx",                pattern: /^function updateFx\(/ },
  { name: "drawSoloAurora",          pattern: /^function drawSoloAurora\(/ },
  { name: "drawSparks",              pattern: /^function drawSparks\(/ },
  { name: "drawInfallSparks",        pattern: /^function drawInfallSparks\(/ },
  { name: "drawStreaks",             pattern: /^function drawStreaks\(/ },
  { name: "drawShocks",              pattern: /^function drawShocks\(/ },
  { name: "drawChordHalos",          pattern: /^function drawChordHalos\(/ },
  { name: "drawMelodyThread",        pattern: /^function drawMelodyThread\(/ },
  { name: "drawHammerRipples",       pattern: /^function drawHammerRipples\(/ },
  { name: "drawHarmonyConstellation", pattern: /^function drawHarmonyConstellation\(/ },
  { name: "drawSky",                 pattern: /^function drawSky\(/ },
  { name: "drawStars",               pattern: /^function drawStars\(/ },
  { name: "drawShootingStars",       pattern: /^function drawShootingStars\(/ },
  { name: "drawHorizonRibbons",      pattern: /^function drawHorizonRibbons\(/ },
  { name: "drawMistSheets",          pattern: /^function drawMistSheets\(/ },
  { name: "drawCloudDeck",           pattern: /^function drawCloudDeck\(/ },
  { name: "drawRain",                pattern: /^function drawRain\(/ },
  { name: "drawSunPetals",           pattern: /^function drawSunPetals\(/ },
  { name: "drawQuasarJets",          pattern: /^function drawQuasarJets\(/ },
  { name: "drawSunFlares",           pattern: /^function drawSunFlares\(/ },
  { name: "drawSoftSun",             pattern: /^function drawSoftSun\(/ },
  { name: "drawHorizon",             pattern: /^function drawHorizon\(/ },
  { name: "drawSea",                 pattern: /^function drawSea\(/ },
  { name: "drawFog",                 pattern: /^function drawFog\(/ },
  { name: "drawDew",                 pattern: /^function drawDew\(/ },
  { name: "drawHeartbeatRing",       pattern: /^function drawHeartbeatRing\(/ },
  { name: "drawUsPresence",          pattern: /^function drawUsPresence\(/ },
  { name: "drawVignette",            pattern: /^function drawVignette\(/ },
  { name: "updateMeters",            pattern: /^function updateMeters\(/ },
];

// Skyline scene (including seed + helpers) → scenes/skyline.js
const skylineSpecs = [
  { name: "skylineWinFill",       pattern: /^function skylineWinFill\(/ },
  { name: "skylineRand",          pattern: /^function skylineRand\(/ },
  { name: "skylinePickPalette",   pattern: /^function skylinePickPalette\(/ },
  { name: "skylineFractalMasses", pattern: /^function skylineFractalMasses\(/ },
  { name: "skylineWindowPattern", pattern: /^function skylineWindowPattern\(/ },
  { name: "updateSkylineEq",      pattern: /^function updateSkylineEq\(/ },
  { name: "sampleSkylineEq",      pattern: /^function sampleSkylineEq\(/ },
  { name: "skylineLayerByName",   pattern: /^function skylineLayerByName\(/ },
  { name: "spawnSkylineWinFlock", pattern: /^function spawnSkylineWinFlock\(/ },
  { name: "spawnSkylineWinCells", pattern: /^function spawnSkylineWinCells\(/ },
  { name: "stepSkylineWinLit",    pattern: /^function stepSkylineWinLit\(/ },
  { name: "updateSkylineWinLits", pattern: /^function updateSkylineWinLits\(/ },
  { name: "spawnSkylineParty",    pattern: /^function spawnSkylineParty\(/ },
  { name: "skylinePartyScreenX",  pattern: /^function skylinePartyScreenX\(/ },
  { name: "updateSkylineParty",   pattern: /^function updateSkylineParty\(/ },
  { name: "drawSkylineParty",     pattern: /^function drawSkylineParty\(/ },
  { name: "seedSkylineCity",      pattern: /^function seedSkylineCity\(/ },
  { name: "drawSkylineLayer",     pattern: /^function drawSkylineLayer\(/ },
  { name: "drawSkylineSun",       pattern: /^function drawSkylineSun\(/ },
  { name: "drawSkyline",          pattern: /^function drawSkyline\(/ },
];

// RainDrive scene → scenes/rainDrive.js
const rainDriveSpecs = [
  { name: "seedStormClouds",    pattern: /^function seedStormClouds\(/ },
  { name: "jaggedBoltPath",     pattern: /^function jaggedBoltPath\(/ },
  { name: "spawnLightning",     pattern: /^function spawnLightning\(/ },
  { name: "spawnRainSplash",    pattern: /^function spawnRainSplash\(/ },
  { name: "drawStormSky",       pattern: /^function drawStormSky\(/ },
  { name: "drawStormClouds",    pattern: /^function drawStormClouds\(/ },
  { name: "strokeBolt",         pattern: /^function strokeBolt\(/ },
  { name: "drawLightningBolts", pattern: /^function drawLightningBolts\(/ },
  { name: "drawWetAsphalt",     pattern: /^function drawWetAsphalt\(/ },
];

// Tunnel scene → scenes/tunnel.js  (tunnelProject also lives here)
const tunnelSpecs = [
  { name: "tunnelProject",  pattern: /^function tunnelProject\(/ },
  { name: "updateTunnel",   pattern: /^function updateTunnel\(/ },
  { name: "drawTunnel",     pattern: /^function drawTunnel\(/ },
  { name: "ribPoints",      pattern: /^function ribPoints\(/ },
  { name: "drawRib",        pattern: /^function drawRib\(/ },
];

// Arcade scene → scenes/arcade.js  (imports tunnelProject from scenes/tunnel.js)
const arcadeSpecs = [
  { name: "seedArcadeStars",     pattern: /^function seedArcadeStars\(/ },
  { name: "updateArcadeEq",      pattern: /^function updateArcadeEq\(/ },
  { name: "roundRectPath",       pattern: /^function roundRectPath\(/ },
  { name: "updateArcadeCabinet", pattern: /^function updateArcadeCabinet\(/ },
  { name: "drawArcadeCabinet",   pattern: /^function drawArcadeCabinet\(/ },
  { name: "drawSideRail",        pattern: /^function drawSideRail\(/ },
];

// NightDrive → scenes/nightDrive.js
const nightDriveSpecs = [
  { name: "drawNightDrive", pattern: /^function drawNightDrive\(/ },
];

// Renderer → renderer.js
const rendererSpecs = [
  { name: "frame", pattern: /^function frame\(/ },
];

// ── Run extractions ────────────────────────────────────────────────────────
console.log("Extracting ranges…");
const fxConfigRanges   = extractRanges(fxConfigSpecs);
const vizModeRanges    = extractRanges(vizModeSpecs);
const uiRanges         = extractRanges(uiSpecs);
const audioRanges      = extractRanges(audioSpecs);
const inputRanges      = extractRanges(inputSpecs);
const simRanges        = extractRanges(simSpecs);
const skylineRanges    = extractRanges(skylineSpecs);
const rainRanges       = extractRanges(rainDriveSpecs);
const tunnelRanges     = extractRanges(tunnelSpecs);
const arcadeRanges     = extractRanges(arcadeSpecs);
const nightDriveRanges = extractRanges(nightDriveSpecs);
const rendererRanges   = extractRanges(rendererSpecs);

// Report what we found
for (const [name, ranges, specs] of [
  ["fxConfig",   fxConfigRanges,   fxConfigSpecs],
  ["vizMode",    vizModeRanges,    vizModeSpecs],
  ["ui",         uiRanges,         uiSpecs],
  ["audio",      audioRanges,      audioSpecs],
  ["input",      inputRanges,      inputSpecs],
  ["simulation", simRanges,        simSpecs],
  ["skyline",    skylineRanges,    skylineSpecs],
  ["rainDrive",  rainRanges,       rainDriveSpecs],
  ["tunnel",     tunnelRanges,     tunnelSpecs],
  ["arcade",     arcadeRanges,     arcadeSpecs],
  ["nightDrive", nightDriveRanges, nightDriveSpecs],
  ["renderer",   rendererRanges,   rendererSpecs],
]) {
  const ok = ranges.length === specs.length ? "✓" : `✗ ${ranges.length}/${specs.length}`;
  console.log(`  ${name}: ${ok}`);
}

// ── Write module files ─────────────────────────────────────────────────────

function write(relPath, content) {
  const abs = path.join(ROOT, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, "utf8");
  console.log(`  → ${relPath} (${content.split("\n").length} lines)`);
}

// fxConfig.js ─────────────────────────────────────────────────────────────
write("lib/fxConfig.js", `import {
  FX_TOGGLES, FX_REQUIRES, FX_LABELS, fxOn,
  SUN_SCALE, setSunScale, SUN_SCALE_MIN, SUN_SCALE_MAX,
  SUN_Y_FRAC, SUN_DROP_PER_EXTRA,
} from "./state.js";

${bodyText(fxConfigRanges)}

/** Effects panel toggles + dependency rules. */
export class FxConfig {
  get toggles()  { return FX_TOGGLES; }
  get requires() { return FX_REQUIRES; }
  get labels()   { return FX_LABELS; }
  on(key)        { return fxOn(key); }
  syncDependencies() { syncFxDependencies(); }
  applySunScale(raw) { applySunScale(raw); }
}

export { FX_TOGGLES, FX_REQUIRES, FX_LABELS, fxOn, syncFxDependencies, applySunScale };
`);

// ui.js ───────────────────────────────────────────────────────────────────
// NOTE: setUiHidden inlines setVizPickerOpen logic to avoid circular dep with vizMode.js
// We patch setUiHidden body to replace the setVizPickerOpen call with inline logic.
let uiBody = bodyText(uiRanges);
// Inline the setVizPickerOpen(false) call in setUiHidden
uiBody = uiBody.replace(
  "if (hidden) setVizPickerOpen(false);",
  `if (hidden) {
    // Inline picker close — avoids circular dep with vizMode.js
    const vp = vizPicker; const vsb = vizSwitchBtn;
    if (vp) vp.hidden = true;
    if (vsb) vsb.setAttribute("aria-expanded", "false");
  }`
);

write("lib/ui.js", `import {
  stage, gate, toggleBtn, restartBtn, pickBtn, systemChromeBtn,
  chromePresets, vizSwitchBtn, vizPicker, hideUiBtn, uiPeek, statusEl,
} from "./state.js";

${uiBody}

/** Gate / chrome / FX panel visibility. */
export class ChromeUi {
  setUiHidden(hidden)      { setUiHidden(hidden); }
  toggleUiHidden()         { toggleUiHidden(); }
  setFxPanelHidden(hidden) { setFxPanelHidden(hidden); }
  toggleFxPanelHidden()    { toggleFxPanelHidden(); }
  showFileChrome()         { showFileChrome(); }
  showSystemChrome()       { showSystemChrome(); }
}

export {
  setUiHidden, toggleUiHidden,
  setFxPanelHidden, toggleFxPanelHidden,
  showFileChrome, showSystemChrome,
};
`);

// vizMode.js ──────────────────────────────────────────────────────────────
// setVizMode references seedStormClouds, seedArcadeStars — those stay in runtime.js.
// vizMode.js imports them via a late-binding trick: it accepts them as an initializer call.
// Simpler: import the seed fns from scene files (no cycle since scene files don't import vizMode.js).
let vmBody = bodyText(vizModeRanges);
// Replace syncVizModeUi's call to setFxPanelHidden — it's imported from ui.js
write("lib/vizMode.js", `import {
  vizMode, setVizModeVar, VIZ_MODES, VIZ_MODE_LABELS, VIZ_MODE_KEY,
  vizSwitchBtn, vizPicker, stage, brandEyebrow, statusEl,
  started, playing,
  skylineWinLits, skylineParty, gridCells, gridTrails,
  rainSplashes, lightningBolts, setStormFlash,
  tunnelPulseRings, setTunnelScroll, setTunnelPulse,
  arcadeStars, setArcadeFlash,
} from "./state.js";
import { getScene } from "./sceneRegistry.js";
import { setFxPanelHidden } from "./ui.js";

// Seed functions are imported lazily to avoid circular deps.
// runtime.js calls setVizModeSeedHooks once scene files are loaded.
let _seedStormClouds = () => {};
let _seedArcadeStars = () => {};
export function setVizModeSeedHooks(rain, arcade) {
  _seedStormClouds = rain;
  _seedArcadeStars = arcade;
}

${vmBody.replace(/\bseedStormClouds\(\)/g, "_seedStormClouds()").replace(/\bseedArcadeStars\(\)/g, "_seedArcadeStars()")}

/** Visualizer mode selection + chrome picker. */
export class VizModeController {
  get mode()   { return vizMode; }
  get modes()  { return VIZ_MODES; }
  get labels() { return VIZ_MODE_LABELS; }
  label(mode)  { return vizModeLabel(mode); }
  isSeaDrive() { return isSeaDrive(); }
  set(mode)    { setVizMode(mode); }
  syncUi()     { syncVizModeUi(); }
  setPickerOpen(open) { setVizPickerOpen(open); }
  togglePicker()      { toggleVizPicker(); }
}

export {
  vizMode, VIZ_MODES, VIZ_MODE_LABELS,
  isSeaDrive, vizModeLabel,
  setVizMode, syncVizModeUi, setVizPickerOpen, toggleVizPicker,
};
`);

// audio.js ────────────────────────────────────────────────────────────────
// frame is referenced inside audio functions (loadTrack/start/startSystemListen).
// We provide a local proxy that delegates to _frameFn set by renderer.js.
let audioBody = bodyText(audioRanges);
// Replace syncVizModeUi calls in showFileChrome/showSystemChrome — those fns are in ui.js
// showFileChrome and showSystemChrome are in uiRanges not audioRanges, so no issue here.

write("lib/audio.js", `import {
  stage, toggleBtn, restartBtn, pickBtn, filePick, trackTitleEl, statusEl,
  chromePresets, vizSwitchBtn,
  audioCtx, setAudioCtx, analyser, setAnalyser, freq, setFreq,
  time, setTime, source, setSource, audio, setAudio,
  objectUrl, setObjectUrl, displayStream, setDisplayStream,
  sourceMode, setSourceMode, currentTrack, setCurrentTrack,
  playing, setPlaying, started, setStarted, raf, setRaf,
  levels,
} from "./state.js";
import {
  showFileChrome, showSystemChrome, setUsMode,
} from "./ui.js";

/** frame() proxy set by renderer.js to avoid a circular dependency. */
let _frameFn = null;
export function setFrameRef(fn) { _frameFn = fn; }
function frame() { if (_frameFn) return _frameFn(...arguments); }

${audioBody}

/** Web Audio graph, file + system capture, level meters. */
export class AudioEngine {
  get levels()     { return levels; }
  get playing()    { return playing; }
  get started()    { return started; }
  get sourceMode() { return sourceMode; }
  ensureGraph()    { return ensureGraph(); }
  start()          { return start(); }
  toggle()         { return toggle(); }
  restart()        { return restart(); }
  loadFile(file)   { return loadFile(file); }
  startSystemListen(e) { return startSystemListen(e); }
  stopSystemListen()   { return stopSystemListen(); }
}

export {
  ensureGraph, start, toggle, restart, loadFile,
  startSystemListen, stopSystemListen,
  playing, started, sourceMode, levels,
  setTrackTitle, loadBuildStamp, prettyName,
  wireAudioElement, loadTrack, detachAudio, stopDisplayStream,
};
`);

// input.js ────────────────────────────────────────────────────────────────
// onKey uses: sourceMode, stopSystemListen, toggle, start, loadFile, setVizMode, toggleVizPicker
write("lib/input.js", `import { sourceMode, playing, filePick, VIZ_MODES, vizMode } from "./state.js";
import { stopSystemListen, toggle, start, loadFile } from "./audio.js";
import { setVizMode, toggleVizPicker } from "./vizMode.js";

${bodyText(inputRanges)}

export class InputHandler {
  bind() {
    window.addEventListener("keydown", onKey);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
  }
}

export { onKey, onDragOver, onDragLeave, onDrop };
`);

// simulation.js ───────────────────────────────────────────────────────────
// Contains all world/particle/draw helpers. No scene file imports (no cycles).
// isSeaDrive and vizModeLabel are defined locally (2-line helpers) to avoid importing vizMode.js.
write("lib/simulation.js", `import {
  canvas, ctx, W, H, dpr, t0,
  vizMode,
  fxOn, FX_TOGGLES, FX,
  SUN_SCALE, WHIP_VERTICALS, WHIP_SAMPLE_MS, WHIP_TRAVEL_MS,
  WHIP_CREST_WIDTH, WHIP_STACK,
  GRID_ROWS, GRID_COLS, GRID_CELL_MAX, GRID_TRAIL_MAX, METEOR_MAX,
  MIRROR_MAX, HEARTBEAT_MAX, BLOOM_MAX, DOORWAY_GAP_MS, DOORWAY_OPEN_MS,
  DOORWAY_HOLD_MS, DOORWAY_CLOSE_MS, KEY_GAP_MS, CHORD_GAP_MS, HAMMER_GAP_MS,
  DRUM_VETO_MS, KEYS_ARM, CHORD_HALO_MAX, MELODY_MAX, HARMONY_LINK_MAX,
  GRID_SUN_COL, BASS_MOUNTAIN_N, DRUM_GAP_KICK_MS, DRUM_GAP_SNARE_MS,
  DRUM_GAP_HAT_MS, GRID_CELL_STEP_MS, GRID_RAINBOW, INFALL_MAX,
  ribbons, dew, fogPuffs, sparks, streaks, shocks, chordHalos,
  hammerRipples, melodyThread, harmonyLinks, stars, rain, mistSheets,
  cloudDeck, shooting, horizonBands, gridCells, gridTrails, meteors,
  mirrorCells, heartbeats, bloomRings, infalls, bassMountain,
  CAM, CAM_SWAY_DRAMA, HORIZON_SWAY_BANK, HORIZON_SWAY_VANISH,
  tunnelScroll, setTunnelScroll, tunnelPulse, setTunnelPulse,
  tunnelSway, setTunnelSway, tunnelPulseRings, TUNNEL_RINGS_MAX,
  ARCADE_EQ_N, arcadeEq, arcadeWarp, setArcadeWarp, arcadeFlash, setArcadeFlash,
  arcadeStars, ARCADE_STAR_N,
  stormClouds, lightningBolts, LIGHTNING_MAX, rainSplashes, RAIN_SPLASH_MAX,
  stormFlash, setStormFlash, lastLightningAt, setLastLightningAt,
  skylineFar, skylineMid, skylineNear,
  skylineKickBob, setSkylineKickBob, skylineScrollPx, setSkylineScrollPx,
  skylineDriveSmooth, setSkylineDriveSmooth, SKYLINE_SCROLL_RATE,
  skylineWinLits, SKYLINE_WIN_MAX, SKYLINE_WIN_STEP_MS,
  skylineParty, SKYLINE_PARTY_MAX, SKYLINE_EQ_N, skylineEq,
  levels,
} from "./state.js";
import { PERF, sparkCap } from "./perf.js";
import { SW_RAINBOW, synthRainbow, swapRemove, ecgShape, bandEnergy, smooth, midCentroid } from "./math.js";
import { vanishX, applyWorldTransform, resetScreenTransform, updateCamera } from "./camera.js";
import { sunYFrac, sunAnchor, sunDiskRadius, blackHoleOccludeRadius, behindBlackHole } from "./sun.js";
import { getScene } from "./sceneRegistry.js";

// Local helpers (avoid importing vizMode.js, which would create a cycle)
function isSeaDrive() { return vizMode === "nightDrive" || vizMode === "rainDrive"; }
function vizModeLabel(mode) {
  mode = mode ?? vizMode;
  if (mode === "skyline")   return "skyline";
  if (mode === "rainDrive") return "rain drive";
  if (mode === "tunnel")    return "tunnel";
  if (mode === "arcade")    return "arcade";
  return "night drive";
}

${bodyText(simRanges)}

export {
  // spawn
  spawnGridFlock, stepGridCell, spawnGridCells,
  spawnVanishingMeteor, spawnVanishingMeteors,
  spawnGridHeartbeat, spawnHorizonBloom, spawnMirrorSea,
  mirrorMeshPoint, drawMirrorSea,
  bassMountainProfile, updateBassMountain, drawBassMountain,
  gridMusicEnergy, gridMusicHot,
  spawnKeySparks, spawnChordHalo, spawnHammerRipple, spawnHarmonyConstellation,
  updateMelodyThread, spawnInfall, spawnSpark, spawnStreak, spawnShock, spawnShootingStar,
  // main tick
  updateFx,
  // draw helpers
  drawSoloAurora, drawSparks, drawInfallSparks, drawStreaks, drawShocks,
  drawChordHalos, drawMelodyThread, drawHammerRipples, drawHarmonyConstellation,
  drawSky, drawStars, drawShootingStars, drawHorizonRibbons, drawMistSheets,
  drawCloudDeck, drawRain, drawSunPetals, drawQuasarJets, drawSunFlares,
  drawSoftSun, drawHorizon, drawSea,
  drawFog, drawDew, drawHeartbeatRing, drawUsPresence, drawVignette,
  updateMeters,
};
`);

// scenes/nightDrive.js ────────────────────────────────────────────────────
write("lib/scenes/nightDrive.js", `import { ctx, W, H, t0, vizMode, fxOn, FX, levels } from "../state.js";
import { SW_RAINBOW, synthRainbow, smooth } from "../math.js";
import { PERF } from "../perf.js";
import { applyWorldTransform, resetScreenTransform } from "../camera.js";
import { sunAnchor, sunDiskRadius, sunYFrac } from "../sun.js";
import {
  drawSky, drawStars, drawShootingStars, drawHorizonRibbons, drawMistSheets,
  drawCloudDeck, drawRain, drawSunPetals, drawQuasarJets, drawSunFlares,
  drawSoftSun, drawHorizon, drawSea, drawFog, drawDew, drawHeartbeatRing,
  drawUsPresence, drawSparks, drawStreaks, drawShocks, drawChordHalos,
  drawMelodyThread, drawHammerRipples, drawHarmonyConstellation,
  drawSoloAurora, drawBassMountain, drawMirrorSea, drawInfallSparks,
} from "../simulation.js";

${bodyText(nightDriveRanges)}

export { drawNightDrive };
`);

// scenes/rainDrive.js ─────────────────────────────────────────────────────
write("lib/scenes/rainDrive.js", `import {
  ctx, W, H, t0, fxOn, FX,
  stormClouds, lightningBolts, LIGHTNING_MAX, rainSplashes, RAIN_SPLASH_MAX,
  stormFlash, setStormFlash, lastLightningAt, setLastLightningAt,
  levels,
} from "../state.js";
import { SW_RAINBOW, synthRainbow, smooth } from "../math.js";
import { PERF } from "../perf.js";
import { vanishX } from "../camera.js";
import {
  drawSky, drawRain, drawSea, drawFog, drawDew, drawMistSheets,
  drawSoftSun, drawSunFlares, drawHorizon, drawSparks, drawStreaks,
  drawShocks, drawHarmonyConstellation, drawHorizonRibbons, drawSoloAurora,
  drawBassMountain, drawMirrorSea, drawMelodyThread, drawChordHalos,
  drawHammerRipples, drawInfallSparks, drawShootingStars, drawStars,
  updateMeters,
} from "../simulation.js";

${bodyText(rainRanges)}

export {
  seedStormClouds, spawnLightning, spawnRainSplash,
  drawStormSky, drawStormClouds, strokeBolt, drawLightningBolts, drawWetAsphalt,
  jaggedBoltPath,
};
`);

// scenes/tunnel.js ────────────────────────────────────────────────────────
write("lib/scenes/tunnel.js", `import {
  ctx, W, H, t0, fxOn, FX,
  tunnelScroll, setTunnelScroll, tunnelPulse, setTunnelPulse,
  tunnelSway, setTunnelSway, tunnelPulseRings, TUNNEL_RINGS_MAX,
  levels,
} from "../state.js";
import { SW_RAINBOW, synthRainbow, smooth } from "../math.js";
import { PERF } from "../perf.js";
import { vanishX, applyWorldTransform, resetScreenTransform } from "../camera.js";
import {
  drawSky, drawSparks, drawSoloAurora, drawStreaks, drawShocks,
  drawMelodyThread, drawHarmonyConstellation,
} from "../simulation.js";

${bodyText(tunnelRanges)}

export { tunnelProject, updateTunnel, drawTunnel, ribPoints, drawRib };
`);

// scenes/arcade.js ────────────────────────────────────────────────────────
write("lib/scenes/arcade.js", `import {
  ctx, W, H, t0, fxOn, FX,
  ARCADE_EQ_N, arcadeEq, arcadeWarp, setArcadeWarp, arcadeFlash, setArcadeFlash,
  arcadeStars, ARCADE_STAR_N,
  levels,
} from "../state.js";
import { SW_RAINBOW, synthRainbow, smooth } from "../math.js";
import { PERF } from "../perf.js";
import { vanishX, applyWorldTransform, resetScreenTransform } from "../camera.js";
import { tunnelProject } from "./tunnel.js";
import {
  drawSky, drawSparks, drawSoloAurora, drawStreaks, drawShocks,
  drawMelodyThread, drawHarmonyConstellation,
} from "../simulation.js";

${bodyText(arcadeRanges)}

export {
  seedArcadeStars, updateArcadeEq, roundRectPath,
  updateArcadeCabinet, drawArcadeCabinet, drawSideRail,
};
`);

// scenes/skyline.js ───────────────────────────────────────────────────────
write("lib/scenes/skyline.js", `import {
  ctx, W, H, t0, fxOn, FX,
  skylineFar, skylineMid, skylineNear,
  skylineKickBob, setSkylineKickBob, skylineScrollPx, setSkylineScrollPx,
  skylineDriveSmooth, setSkylineDriveSmooth, SKYLINE_SCROLL_RATE,
  skylineWinLits, SKYLINE_WIN_MAX, SKYLINE_WIN_STEP_MS,
  skylineParty, SKYLINE_PARTY_MAX, SKYLINE_EQ_N, skylineEq,
  gridCells, gridTrails, stars, stormClouds, rainSplashes, lightningBolts, stormFlash,
  levels,
} from "../state.js";
import { SW_RAINBOW, synthRainbow, smooth, swapRemove } from "../math.js";
import { PERF, sparkCap } from "../perf.js";
import { vanishX, applyWorldTransform, resetScreenTransform } from "../camera.js";
import { sunAnchor, sunDiskRadius, sunYFrac } from "../sun.js";
import {
  drawSky, drawStars, drawSparks, drawSoloAurora, drawStreaks, drawShocks,
  drawMelodyThread, drawHarmonyConstellation, drawBassMountain, drawMirrorSea,
  drawChordHalos, drawHammerRipples, drawInfallSparks, drawShootingStars,
  spawnSpark, spawnStreak, spawnShock, spawnShootingStar, spawnGridCells,
  spawnVanishingMeteors, spawnGridHeartbeat, spawnHorizonBloom, spawnMirrorSea,
  updateMeters,
} from "../simulation.js";

${bodyText(skylineRanges)}

export {
  seedSkylineCity,
  skylineLayerByName,
  updateSkylineEq, sampleSkylineEq,
  spawnSkylineWinFlock, spawnSkylineWinCells,
  updateSkylineWinLits, spawnSkylineParty, updateSkylineParty,
  drawSkylineParty, drawSkylineLayer, drawSkylineSun, drawSkyline,
};
`);

// renderer.js ─────────────────────────────────────────────────────────────
write("lib/renderer.js", `import {
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

${bodyText(rendererRanges)}

// Register frame with audio.js so audio functions can kick the RAF loop
setFrameRef(frame);

export class Renderer {
  get frame() { return frame; }
  start() { setRaf(requestAnimationFrame(frame)); }
}

export { frame };
`);

// ── Trim runtime.js ────────────────────────────────────────────────────────
console.log("\nTrimming runtime.js…");

// All ranges to remove from runtime.js
const toRemove = [
  ...fxConfigRanges,
  ...vizModeRanges,
  ...uiRanges,
  ...audioRanges,
  ...inputRanges,
  ...simRanges,
  ...skylineRanges,
  ...rainRanges,
  ...tunnelRanges,
  ...arcadeRanges,
  ...nightDriveRanges,
  ...rendererRanges,
];

// Also remove the big export block (we'll replace it)
const exportIdx = findLine(/^export \{/);
if (exportIdx !== -1) {
  const [es, ee] = blockRange(exportIdx);
  toRemove.push({ start: es, end: ee, name: "export-block" });
}

// Remove the _prevSceneMode declaration (now only in vizMode.js)
const prevSceneIdx = findLine(/^let _prevSceneMode/);
if (prevSceneIdx !== -1) toRemove.push({ start: prevSceneIdx, end: prevSceneIdx, name: "_prevSceneMode" });

// Remove stale comment lines that are now orphaned imports
const staleComments = [
  /^\/\/ VIZ_MODE_LABELS.*imported from state\.js/,
  /^\/\/ FX_TOGGLES.*imported from state\.js/,
  /^\/\/ FX .*imported from state\.js/,
];
for (const pattern of staleComments) {
  const idx = findLine(pattern);
  if (idx !== -1) toRemove.push({ start: idx, end: idx, name: "stale-comment" });
}

const marked = markLines(toRemove);

// New import additions for runtime.js
const newImports = `import { syncFxDependencies, applySunScale, FxConfig } from "./fxConfig.js";
import {
  isSeaDrive, vizModeLabel, setVizMode, syncVizModeUi,
  setVizPickerOpen, toggleVizPicker, VizModeController,
  setVizModeSeedHooks,
} from "./vizMode.js";
import { setUiHidden, toggleUiHidden, setFxPanelHidden, toggleFxPanelHidden, showFileChrome, showSystemChrome, ChromeUi } from "./ui.js";
import {
  ensureGraph, start, toggle, restart, loadFile,
  startSystemListen, stopSystemListen,
  setTrackTitle, loadBuildStamp, setUsMode,
  AudioEngine, setFrameRef,
} from "./audio.js";
import { onKey, onDragOver, onDragLeave, onDrop } from "./input.js";
import {
  spawnGridFlock, stepGridCell, spawnGridCells,
  spawnVanishingMeteor, spawnVanishingMeteors,
  spawnGridHeartbeat, spawnHorizonBloom, spawnMirrorSea, mirrorMeshPoint, drawMirrorSea,
  bassMountainProfile, updateBassMountain, drawBassMountain,
  gridMusicEnergy, gridMusicHot,
  spawnKeySparks, spawnChordHalo, spawnHammerRipple, spawnHarmonyConstellation,
  updateMelodyThread, spawnInfall, spawnSpark, spawnStreak, spawnShock, spawnShootingStar,
  updateFx,
  drawSoloAurora, drawSparks, drawInfallSparks, drawStreaks, drawShocks,
  drawChordHalos, drawMelodyThread, drawHammerRipples, drawHarmonyConstellation,
  drawSky, drawStars, drawShootingStars, drawHorizonRibbons, drawMistSheets,
  drawCloudDeck, drawRain, drawSunPetals, drawQuasarJets, drawSunFlares,
  drawSoftSun, drawHorizon, drawSea,
  drawFog, drawDew, drawHeartbeatRing, drawUsPresence, drawVignette,
  updateMeters,
} from "./simulation.js";
import { seedSkylineCity, drawSkyline, updateSkylineEq } from "./scenes/skyline.js";
import { seedStormClouds } from "./scenes/rainDrive.js";
import { seedArcadeStars, updateArcadeCabinet, drawArcadeCabinet, updateArcadeEq } from "./scenes/arcade.js";
import { updateTunnel, drawTunnel } from "./scenes/tunnel.js";
import { drawNightDrive } from "./scenes/nightDrive.js";
import { frame, Renderer } from "./renderer.js";

// Wire vizMode seed hooks (after all scene modules loaded)
setVizModeSeedHooks(seedStormClouds, seedArcadeStars);
`;

// Build filtered lines
const filtered = lines.filter((_, i) => !marked.has(i));

// Find end of existing import block to insert after
let lastImportLine = -1;
for (let i = 0; i < filtered.length; i++) {
  const l = filtered[i];
  if (l.startsWith("import ") || (lastImportLine !== -1 && (l.startsWith("} from ") || l.trim() === ""))) {
    if (l.startsWith("import ") || l.startsWith("} from ")) lastImportLine = i;
  } else if (lastImportLine !== -1 && l.trim() !== "") {
    break;
  }
}

const output = [
  ...filtered.slice(0, lastImportLine + 1),
  "",
  newImports,
  ...filtered.slice(lastImportLine + 1),
];

// Rebuild export block
const newExport = `
export {
  // mode / UI
  vizMode, VIZ_MODES, VIZ_MODE_LABELS,
  isSeaDrive, vizModeLabel,
  setVizMode, syncVizModeUi, setVizPickerOpen, toggleVizPicker,
  // fx
  FX, FX_TOGGLES, FX_REQUIRES, FX_LABELS, fxOn,
  syncFxDependencies, applySunScale,
  // audio / playback
  ensureGraph, start, toggle, restart, loadFile,
  startSystemListen, stopSystemListen,
  playing, started, sourceMode, levels,
  // canvas
  canvas, ctx, stage, W, H, dpr,
  resize, PERF, updatePerf, sparkCap,
  // camera / sun
  CAM, updateCamera, vanishX, applyWorldTransform, resetScreenTransform,
  SUN_SCALE, sunAnchor, sunDiskRadius,
  // world
  seedWorld, seedSkylineCity, seedArcadeStars, seedStormClouds, updateFx,
  // scenes draw
  drawNightDrive, drawTunnel, drawArcadeCabinet, drawSkyline,
  updateTunnel, updateArcadeCabinet, updateArcadeEq, updateSkylineEq,
  // frame
  frame,
  // input
  onKey, onDragOver, onDragLeave, onDrop,
  setUiHidden, toggleUiHidden, setFxPanelHidden, toggleFxPanelHidden,
  showFileChrome, showSystemChrome,
  // math (re-export for compatibility)
  smooth, bandEnergy, swapRemove, synthRainbow, midCentroid, WHIP_VERTICALS,
};
`;
output.push(newExport);

const finalSrc = output.join("\n");
fs.writeFileSync(RUNTIME, finalSrc, "utf8");
console.log(`runtime.js: ${lines.length} → ${finalSrc.split("\n").length} lines`);

// Syntax check all new files
const { execSync } = require("child_process");
const filesToCheck = [
  "lib/fxConfig.js", "lib/vizMode.js", "lib/ui.js", "lib/audio.js",
  "lib/input.js", "lib/simulation.js",
  "lib/scenes/nightDrive.js", "lib/scenes/rainDrive.js",
  "lib/scenes/tunnel.js", "lib/scenes/arcade.js", "lib/scenes/skyline.js",
  "lib/renderer.js", "lib/runtime.js",
];

console.log("\nSyntax checking…");
let allOk = true;
for (const f of filesToCheck) {
  const abs = path.join(ROOT, f);
  if (!fs.existsSync(abs)) { console.log(`  MISSING: ${f}`); allOk = false; continue; }
  try {
    execSync(`node --check "${abs}"`, { stdio: "pipe" });
    console.log(`  OK: ${f}`);
  } catch (e) {
    console.error(`  ERR: ${f}\n    ${e.stderr?.toString().split("\n")[0]}`);
    allOk = false;
  }
}

if (allOk) console.log("\nAll files syntax-OK ✓");
else console.log("\nSome files have syntax errors — fix before running the app.");
