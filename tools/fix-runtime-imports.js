/**
 * Rewrite runtime.js header: fix the broken import block and remove orphaned JSDoc/constants.
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const RT = path.join(ROOT, "lib", "runtime.js");

const lines = fs.readFileSync(RT, "utf8").split("\n");

// Find where startRuntime begins (that's where the real code starts)
let startRuntimeIdx = -1;
let resizeIdx = -1;
let seedWorldIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (/^export function startRuntime\(/.test(lines[i])) startRuntimeIdx = i;
  if (/^function resize\(/.test(lines[i]))    resizeIdx = i;
  if (/^function seedWorld\(/.test(lines[i])) seedWorldIdx = i;
}

// Find the export block at the bottom
let exportBlockIdx = -1;
for (let i = lines.length - 1; i >= 0; i--) {
  if (/^export \{/.test(lines[i])) { exportBlockIdx = i; break; }
}

console.log(`resize: ${resizeIdx+1}, seedWorld: ${seedWorldIdx+1}, startRuntime: ${startRuntimeIdx+1}, export: ${exportBlockIdx+1}`);

// Build the body: resize + seedWorld + startRuntime + export block
// We keep everything from resizeIdx onwards (cleanup the orphaned comments above it)
const body = lines.slice(resizeIdx).join("\n");

// Also check for the `let streakDir = 0;` — it's between seedWorld JSDoc comments
const streakDirLine = lines.findIndex(l => /^let streakDir\s*=\s*0/.test(l));
console.log(`streakDir: ${streakDirLine !== -1 ? streakDirLine+1 : "not found"}`);

// Build the TUNNEL constants — they should go into tunnel.js, but for now
// check if they're still in runtime.js between the orphaned comments
const tunnelConstIdx = lines.findIndex(l => /^const TUNNEL_RIBS\s*=/.test(l));
console.log(`TUNNEL_RIBS: ${tunnelConstIdx !== -1 ? tunnelConstIdx+1 : "not found"}`);

// Correct imports header
const header = `/**
 * Sunwake runtime — core implementation (migrated from the listen.js monolith).
 * Boot is deferred to {@link startRuntime} so {@link SunwakeApp} can compose OOP facades first.
 */

import { getScene } from "./sceneRegistry.js";
import { PERF, updatePerf, sparkCap } from "./perf.js";
import { SW_RAINBOW, synthRainbow, swapRemove, ecgShape, bandEnergy, smooth, midCentroid } from "./math.js";
import {
  // DOM
  canvas, ctx, stage, gate, playBtn, systemPlayBtn, systemChromeBtn,
  toggleBtn, restartBtn, pickBtn, filePick, trackTitleEl, statusEl,
  bassDot, midDot, airDot, chromePresets, hideUiBtn, uiPeek, brandEyebrow,
  vizSwitchBtn, vizPicker,
  // dimensions
  W, H, dpr, setDimensions,
  // viz mode
  VIZ_MODE_LABELS, VIZ_MODE_KEY, VIZ_MODES, vizMode, setVizModeVar,
  // audio
  audioCtx, setAudioCtx, analyser, setAnalyser, freq, setFreq, time, setTime,
  source, setSource, audio, setAudio, objectUrl, setObjectUrl,
  displayStream, setDisplayStream, sourceMode, setSourceMode,
  currentTrack, setCurrentTrack, playing, setPlaying, started, setStarted,
  raf, setRaf, t0, setT0,
  // levels
  levels,
  // FX
  FX_TOGGLES, fxOn, FX_REQUIRES, FX_LABELS, FX,
  // sun
  SUN_SCALE, setSunScale, SUN_SCALE_MIN, SUN_SCALE_MAX, SUN_Y_FRAC,
  SUN_DROP_PER_EXTRA, BH_DISK_TILT,
  // whip + grid
  WHIP_VERTICALS, setWhipVerticals, WHIP_SAMPLE_MS, WHIP_TRAVEL_MS,
  WHIP_CREST_WIDTH, WHIP_STACK,
  GRID_ROWS, GRID_COLS, GRID_CELL_MAX, GRID_TRAIL_MAX, METEOR_MAX, MIRROR_MAX,
  MIRROR_GAP_MS, HEARTBEAT_MAX, BLOOM_MAX, DOORWAY_GAP_MS, DOORWAY_OPEN_MS,
  DOORWAY_HOLD_MS, DOORWAY_CLOSE_MS, KEY_GAP_MS, CHORD_GAP_MS, HAMMER_GAP_MS,
  DRUM_VETO_MS, KEYS_ARM, CHORD_HALO_MAX, MELODY_MAX, HARMONY_LINK_MAX,
  GRID_SUN_COL, BASS_MOUNTAIN_N, DRUM_GAP_KICK_MS, DRUM_GAP_SNARE_MS,
  DRUM_GAP_HAT_MS, GRID_CELL_STEP_MS, GRID_RAINBOW, INFALL_MAX,
  // arrays
  ribbons, dew, fogPuffs, sparks, streaks, shocks, chordHalos, hammerRipples,
  melodyThread, harmonyLinks, stars, rain, mistSheets, cloudDeck, shooting,
  horizonBands, gridCells, gridTrails, meteors, mirrorCells, heartbeats,
  bloomRings, infalls, bassMountain,
  // camera
  CAM, CAM_SWAY_DRAMA, HORIZON_SWAY_BANK, HORIZON_SWAY_VANISH,
  // tunnel
  tunnelScroll, setTunnelScroll, tunnelPulse, setTunnelPulse,
  tunnelSway, setTunnelSway, tunnelPulseRings, TUNNEL_RINGS_MAX,
  // arcade
  ARCADE_EQ_N, arcadeEq, arcadeWarp, setArcadeWarp, arcadeFlash, setArcadeFlash,
  arcadeStars, ARCADE_STAR_N,
  // rain
  stormClouds, lightningBolts, LIGHTNING_MAX, rainSplashes, RAIN_SPLASH_MAX,
  stormFlash, setStormFlash, lastLightningAt, setLastLightningAt,
  // skyline
  skylineFar, skylineMid, skylineNear,
  skylineKickBob, setSkylineKickBob, skylineScrollPx, setSkylineScrollPx,
  skylineDriveSmooth, setSkylineDriveSmooth, SKYLINE_SCROLL_RATE,
  skylineWinLits, SKYLINE_WIN_MAX, SKYLINE_WIN_STEP_MS,
  skylineParty, SKYLINE_PARTY_MAX, SKYLINE_EQ_N, skylineEq,
} from "./state.js";
import { updateCamera, vanishX, applyWorldTransform, resetScreenTransform } from "./camera.js";
import { sunYFrac, sunAnchor, sunDiskRadius, blackHoleOccludeRadius, behindBlackHole } from "./sun.js";
import { syncFxDependencies, applySunScale } from "./fxConfig.js";
import {
  isSeaDrive, vizModeLabel, setVizMode, syncVizModeUi,
  setVizPickerOpen, toggleVizPicker, setVizModeSeedHooks,
} from "./vizMode.js";
import {
  setUiHidden, toggleUiHidden,
  setFxPanelHidden, toggleFxPanelHidden,
  showFileChrome, showSystemChrome,
} from "./ui.js";
import {
  ensureGraph, start, toggle, restart, loadFile,
  startSystemListen, stopSystemListen,
  setTrackTitle, loadBuildStamp,
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
import {
  seedArcadeStars, updateArcadeCabinet, drawArcadeCabinet, updateArcadeEq,
} from "./scenes/arcade.js";
import { updateTunnel, drawTunnel } from "./scenes/tunnel.js";
import { drawNightDrive } from "./scenes/nightDrive.js";
import { frame } from "./renderer.js";

setVizModeSeedHooks(seedStormClouds, seedArcadeStars);

`;

// The body we want to keep: resize() through end of file
// But first strip the orphaned `let streakDir` (it lives in simulation.js now)
// and orphaned JSDoc comments between resize and seedWorld
let bodyLines = lines.slice(resizeIdx);

// Remove `let streakDir = 0;` and orphaned comment blocks
bodyLines = bodyLines.filter(l => {
  if (/^let streakDir\s*=/.test(l)) return false;
  return true;
});

// Remove orphaned JSDoc / comment-only lines at top of body (before function resize)
// (resize should be first real code)

// Also remove TUNNEL constants if they appear in body (they stay in tunnel.js)
bodyLines = bodyLines.filter(l => {
  if (/^const TUNNEL_RIBS\s*=/.test(l)) return false;
  if (/^const TUNNEL_RIB_SPACING\s*=/.test(l)) return false;
  if (/^const TUNNEL_FOV\s*=/.test(l)) return false;
  return true;
});

// Remove dangling comment lines (orphaned JSDoc from extracted functions)
// Strategy: remove lines that are ONLY JSDoc content (no code context)
// We'll do this by stripping clusters of /* */ and /** */ that are between function definitions
let inOrphanedDoc = false;
const cleanBody = [];
for (let i = 0; i < bodyLines.length; i++) {
  const l = bodyLines[i];
  const trimmed = l.trim();
  // Skip isolated JSDoc comment lines that don't belong to any function here
  // (runtime.js only has resize, seedWorld, and startRuntime now)
  // We'll keep everything that's not a stand-alone JSDoc line between functions
  if (trimmed.startsWith("/**") && !trimmed.includes("{")) {
    // Check if next non-empty line is a function definition or real code
    let j = i + 1;
    while (j < bodyLines.length && bodyLines[j].trim() === "") j++;
    const nextLine = j < bodyLines.length ? bodyLines[j].trim() : "";
    if (!nextLine.startsWith("function ") && !nextLine.startsWith("export function") &&
        !nextLine.startsWith("*/") && !nextLine.startsWith("*")) {
      // Orphaned single-line JSDoc
      continue;
    }
  }
  if (trimmed.startsWith("/**") && (i + 1 < bodyLines.length) && bodyLines[i+1].trim().startsWith("*")) {
    // Multi-line JSDoc — check if next function line is in this file
    let j = i;
    while (j < bodyLines.length && !bodyLines[j].trim().endsWith("*/")) j++;
    j++; // skip the */
    while (j < bodyLines.length && bodyLines[j].trim() === "") j++;
    const nextCode = j < bodyLines.length ? bodyLines[j].trim() : "";
    if (!nextCode.startsWith("function ") && !nextCode.startsWith("export function") &&
        !nextCode.startsWith("//")) {
      // Skip this whole JSDoc block
      while (i < bodyLines.length && !bodyLines[i].trim().endsWith("*/")) i++;
      continue;
    }
  }
  cleanBody.push(l);
}

// Export block at the end
const exportBlock = `
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
  // world seeds + update
  seedWorld, seedSkylineCity, seedArcadeStars, seedStormClouds, updateFx,
  // scene draws
  drawNightDrive, drawTunnel, drawArcadeCabinet, drawSkyline,
  updateTunnel, updateArcadeCabinet, updateArcadeEq, updateSkylineEq,
  // frame loop
  frame,
  // input
  onKey, onDragOver, onDragLeave, onDrop,
  setUiHidden, toggleUiHidden, setFxPanelHidden, toggleFxPanelHidden,
  showFileChrome, showSystemChrome,
  // math (re-export for compatibility)
  smooth, bandEnergy, swapRemove, synthRainbow, midCentroid, WHIP_VERTICALS,
};
`;

// Find and remove any existing export block from cleanBody
const existingExportIdx = cleanBody.findIndex(l => /^export \{/.test(l));
const trimmedBody = existingExportIdx !== -1 
  ? cleanBody.slice(0, existingExportIdx) 
  : cleanBody;

const result = header + trimmedBody.join("\n") + "\n" + exportBlock;
fs.writeFileSync(RT, result, "utf8");
console.log(`runtime.js rewritten: ${result.split("\n").length} lines`);

// Syntax check
const { execSync } = require("child_process");
try {
  execSync(`node --check "${RT}"`, { stdio: "pipe" });
  console.log("runtime.js: syntax OK ✓");
} catch (e) {
  console.error("runtime.js: SYNTAX ERROR\n" + e.stderr?.toString().substring(0, 500));
}
