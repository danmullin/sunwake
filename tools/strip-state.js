/**
 * Strip state declarations from runtime.js that now live in state.js.
 * Adds: import { ... } from "./state.js";
 * Removes: DOM refs, particle arrays, FX_TOGGLES/FX_REQUIRES/FX_LABELS/fxOn/FX,
 *          SUN_SCALE consts, WHIP consts, GRID consts, bassMountain,
 *          CAM+cam-consts, levels, W/H/dpr/audio-refs/playing/started/raf/t0
 * KEEPS: syncFxDependencies, sunYFrac/sunAnchor/sunDiskRadius/blackHoleOccludeRadius/
 *        behindBlackHole (use W/H/SUN_SCALE via imported bindings)
 *
 * Run: node tools/strip-state.js
 */
const fs = require("fs");
const path = require("path");

const runtimePath = path.join(__dirname, "../lib/runtime.js");
let src = fs.readFileSync(runtimePath, "utf8");
const lines = src.split("\n");
console.log("Input lines:", lines.length);

// Find exact line indices (0-based) for each block to remove.
// We search by content to be resilient to prior edits.
function findLine(text, startAfter = 0, partial = false) {
  for (let i = startAfter; i < lines.length; i++) {
    if (partial ? lines[i].includes(text) : lines[i].trim() === text) return i;
  }
  return -1;
}

function findLinePattern(re, startAfter = 0) {
  for (let i = startAfter; i < lines.length; i++) {
    if (re.test(lines[i])) return i;
  }
  return -1;
}

// Collect ranges to delete as [start, end] inclusive (0-based)
const deletions = [];

function del(start, end) {
  if (start < 0 || end < start) {
    console.warn("Skipping bad range", start, end);
    return;
  }
  deletions.push([start, end]);
}

// ── DOM refs block: from `const canvas = ...` through `const vizPicker = ...`
{
  const s = findLinePattern(/^const canvas = document\.getElementById/, 0);
  const e = findLinePattern(/^const vizPicker = document\.getElementById/, s);
  if (s >= 0 && e >= 0) del(s, e + 1); // +1 for trailing blank
  else console.warn("DOM refs block not found", s, e);
}

// ── VIZ_MODE_LABELS block
{
  const s = findLinePattern(/^const VIZ_MODE_LABELS = \{/, 0);
  // ends at the closing brace then VIZ_MODE_KEY, vizMode, VIZ_MODES, try/catch
  // find the try-catch block end (the } after ignore)
  const e = findLinePattern(/^\} catch \{/, s);
  const end = findLinePattern(/^\}$/, e + 1); // closing brace of catch
  if (s >= 0 && end >= 0) del(s, end + 1); // +1 blank
  else console.warn("VIZ_MODE_LABELS block not found", s, e);
}

// ── isSeaDrive + vizModeLabel functions (they'll be re-implemented in vizMode.js
//    but we keep them in runtime.js for now — so DON'T delete them)

// ── Tunnel/Arcade/RainDrive/Skyline scene-local state
{
  // Tunnel state comment block
  const s = findLinePattern(/^\/\*\* Tunnel mode state/, 0);
  // ends before "let W = 0"
  const e = findLinePattern(/^const skylineEq = new Float32Array/, s);
  if (s >= 0 && e >= 0) del(s, e + 1); // +1 blank
  else console.warn("Scene-local state not found", s, e);
}

// ── W, H, dpr, audio refs, playing, started, raf, t0
{
  const s = findLinePattern(/^let W = 0;/, 0);
  const e = findLinePattern(/^let t0 = performance\.now\(\);/, s);
  if (s >= 0 && e >= 0) del(s, e + 1);
  else console.warn("W/H/dpr/audio block not found", s, e);
}

// ── Particle arrays: ribbons through infalls
{
  const s = findLinePattern(/^const ribbons = \[\];/, 0);
  const e = findLinePattern(/^const infalls = \[\];/, s);
  if (s >= 0 && e >= 0) del(s, e + 1);
  else console.warn("Particle arrays not found", s, e);
}

// ── FX_TOGGLES block (the big object)
{
  const s = findLinePattern(/^const FX_TOGGLES = \{/, 0);
  const e = findLinePattern(/^\};$/, s); // closing }; of FX_TOGGLES
  if (s >= 0 && e >= 0) del(s, e + 1);
  else console.warn("FX_TOGGLES not found", s, e);
}

// ── fxOn function
{
  const s = findLinePattern(/^function fxOn\(key\)/, 0);
  if (s >= 0) del(s, s + 2);
  else console.warn("fxOn not found");
}

// ── FX_REQUIRES + FX_LABELS blocks
{
  const s = findLinePattern(/^const FX_REQUIRES = \{/, 0);
  const e1 = findLinePattern(/^\};$/, s);
  // FX_LABELS follows
  const s2 = findLinePattern(/^const FX_LABELS = \{/, e1);
  const e2 = findLinePattern(/^\};$/, s2);
  if (s >= 0 && e2 >= 0) {
    del(s, e1 + 1); // FX_REQUIRES
    del(s2, e2 + 1); // FX_LABELS
  } else console.warn("FX_REQUIRES/LABELS not found", s, s2, e2);
}

// ── FX object (the per-frame energy object)
{
  const s = findLinePattern(/^const FX = \{/, 0);
  const e = findLinePattern(/^\};$/, s);
  if (s >= 0 && e >= 0) del(s, e + 1);
  else console.warn("FX not found", s, e);
}

// ── SUN_SCALE + BH consts
{
  const s = findLinePattern(/^let SUN_SCALE = /, 0);
  // ends at BH_DISK_TILT line
  const e = findLinePattern(/^const BH_DISK_TILT = /, s);
  if (s >= 0 && e >= 0) del(s, e + 1);
  else console.warn("SUN_SCALE block not found", s, e);
}

// ── WHIP_VERTICALS + whip consts + GRID consts + bassMountain + GRID_RAINBOW
{
  const s = findLinePattern(/^\/\/ Vertical grid whip/, 0);
  // ends after bassMountain declaration
  const e = findLinePattern(/^const bassMountain = new Float32Array/, s);
  if (s >= 0 && e >= 0) del(s, e + 1);
  else console.warn("WHIP/GRID consts not found", s, e);
}

// ── CAM + sway consts
{
  const s = findLinePattern(/^const CAM = \{/, 0);
  const e = findLinePattern(/^const HORIZON_SWAY_VANISH = /, s);
  if (s >= 0 && e >= 0) del(s, e + 1);
  else console.warn("CAM not found", s, e);
}

// ── levels
{
  const s = findLinePattern(/^const levels = \{/, 0);
  if (s >= 0) del(s, s + 1);
  else console.warn("levels not found");
}

// ── INFALL_MAX (if present - moved to state.js)
{
  const s = findLinePattern(/^const INFALL_MAX = /, 0);
  if (s >= 0) del(s, s);
}

// ── Sort and merge deletions
deletions.sort((a, b) => a[0] - b[0]);

// Build skip set
const skip = new Set();
for (const [s, e] of deletions) {
  for (let i = s; i <= e; i++) skip.add(i);
}

// Build state.js import (right after math.js import on line index ~8)
const stateImport = [
  'import {',
  '  // DOM',
  '  canvas, ctx, stage, gate, playBtn, systemPlayBtn, systemChromeBtn,',
  '  toggleBtn, restartBtn, pickBtn, filePick, trackTitleEl, statusEl,',
  '  bassDot, midDot, airDot, chromePresets, hideUiBtn, uiPeek, brandEyebrow,',
  '  vizSwitchBtn, vizPicker,',
  '  // dimensions',
  '  W, H, dpr, setDimensions,',
  '  // viz mode',
  '  VIZ_MODE_LABELS, VIZ_MODE_KEY, VIZ_MODES, vizMode, setVizModeVar,',
  '  // audio',
  '  audioCtx, setAudioCtx, analyser, setAnalyser, freq, setFreq, time, setTime,',
  '  source, setSource, audio, setAudio, objectUrl, setObjectUrl,',
  '  displayStream, setDisplayStream, sourceMode, setSourceMode,',
  '  currentTrack, setCurrentTrack, playing, setPlaying, started, setStarted,',
  '  raf, setRaf, t0, setT0,',
  '  // levels',
  '  levels,',
  '  // FX',
  '  FX_TOGGLES, fxOn, FX_REQUIRES, FX_LABELS, FX,',
  '  // sun',
  '  SUN_SCALE, setSunScale, SUN_SCALE_MIN, SUN_SCALE_MAX, SUN_Y_FRAC,',
  '  SUN_DROP_PER_EXTRA, BH_DISK_TILT,',
  '  // whip + grid',
  '  WHIP_VERTICALS, setWhipVerticals, WHIP_SAMPLE_MS, WHIP_TRAVEL_MS,',
  '  WHIP_CREST_WIDTH, WHIP_STACK,',
  '  GRID_ROWS, GRID_COLS, GRID_CELL_MAX, GRID_TRAIL_MAX, METEOR_MAX, MIRROR_MAX,',
  '  MIRROR_GAP_MS, HEARTBEAT_MAX, BLOOM_MAX, DOORWAY_GAP_MS, DOORWAY_OPEN_MS,',
  '  DOORWAY_HOLD_MS, DOORWAY_CLOSE_MS, KEY_GAP_MS, CHORD_GAP_MS, HAMMER_GAP_MS,',
  '  DRUM_VETO_MS, KEYS_ARM, CHORD_HALO_MAX, MELODY_MAX, HARMONY_LINK_MAX,',
  '  GRID_SUN_COL, BASS_MOUNTAIN_N, DRUM_GAP_KICK_MS, DRUM_GAP_SNARE_MS,',
  '  DRUM_GAP_HAT_MS, GRID_CELL_STEP_MS, GRID_RAINBOW, INFALL_MAX,',
  '  // arrays',
  '  ribbons, dew, fogPuffs, sparks, streaks, shocks, chordHalos, hammerRipples,',
  '  melodyThread, harmonyLinks, stars, rain, mistSheets, cloudDeck, shooting,',
  '  horizonBands, gridCells, gridTrails, meteors, mirrorCells, heartbeats,',
  '  bloomRings, infalls, bassMountain,',
  '  // camera',
  '  CAM, CAM_SWAY_DRAMA, HORIZON_SWAY_BANK, HORIZON_SWAY_VANISH,',
  '  // tunnel',
  '  tunnelScroll, setTunnelScroll, tunnelPulse, setTunnelPulse,',
  '  tunnelSway, setTunnelSway, tunnelPulseRings, TUNNEL_RINGS_MAX,',
  '  // arcade',
  '  ARCADE_EQ_N, arcadeEq, arcadeWarp, setArcadeWarp, arcadeFlash, setArcadeFlash,',
  '  arcadeStars, ARCADE_STAR_N,',
  '  // rain',
  '  stormClouds, lightningBolts, LIGHTNING_MAX, rainSplashes, RAIN_SPLASH_MAX,',
  '  stormFlash, setStormFlash, lastLightningAt, setLastLightningAt,',
  '  // skyline',
  '  skylineFar, skylineMid, skylineNear,',
  '  skylineKickBob, setSkylineKickBob, skylineScrollPx, setSkylineScrollPx,',
  '  skylineDriveSmooth, setSkylineDriveSmooth, SKYLINE_SCROLL_RATE,',
  '  skylineWinLits, SKYLINE_WIN_MAX, SKYLINE_WIN_STEP_MS,',
  '  skylineParty, SKYLINE_PARTY_MAX, SKYLINE_EQ_N, skylineEq,',
  '} from "./state.js";',
].join("\n");

// Replace mutation sites — direct assignment → setter calls
// We'll handle this via targeted replacements
const mutations = [
  // W/H/dpr: these are set together in resize()
  // We leave resize() to call setDimensions(w, h, d) — handled below
  [/^  W = window\.innerWidth;$/, '  setDimensions(window.innerWidth, window.innerHeight, Math.min(window.devicePixelRatio || 1, PERF.dprCap));'],
  [/^  H = window\.innerHeight;$/, '  // H set by setDimensions above'],
  [/^  dpr = Math\.min\(window\.devicePixelRatio/, '  // dpr set by setDimensions above'],
  // vizMode
  [/^  vizMode = mode;$/, '  setVizModeVar(mode);'],
  // playing
  [/^    playing = (true|false);$/, (m, v) => `    setPlaying(${v});`],
  [/^  playing = (true|false);$/, (m, v) => `  setPlaying(${v});`],
  // started
  [/^    started = (true|false);$/, (m, v) => `    setStarted(${v});`],
  [/^  started = (true|false);$/, (m, v) => `  setStarted(${v});`],
  // sourceMode
  [/^    sourceMode = "(idle|file|system)";$/, (m, v) => `    setSourceMode("${v}");`],
  [/^  sourceMode = "(idle|file|system)";$/, (m, v) => `  setSourceMode("${v}");`],
  // raf
  [/^  raf = requestAnimationFrame\(frame\);$/, '  setRaf(requestAnimationFrame(frame));'],
  // SUN_SCALE
  [/^\s+SUN_SCALE = Math\.min/, '  setSunScale(Math.min(SUN_SCALE_MAX, Math.max(SUN_SCALE_MIN, n)));'],
  // WHIP_VERTICALS
  [/^\s+WHIP_VERTICALS = (FX_TOGGLES\.whipVerticals|input\.checked);$/, (m, v) => `  setWhipVerticals(${v});`],
  // audioCtx
  [/^\s+audioCtx = new AudioContext\(\);$/, '  setAudioCtx(new AudioContext());'],
  [/^\s+analyser = audioCtx\.createAnalyser\(\);$/, '  setAnalyser(audioCtx.createAnalyser());'],
  [/^\s+freq = new Uint8Array\(analyser\.frequencyBinCount\);$/, '  setFreq(new Uint8Array(analyser.frequencyBinCount));'],
  [/^\s+time = new Uint8Array\(analyser\.fftSize\);$/, '  setTime(new Uint8Array(analyser.fftSize));'],
  [/^\s+displayStream = null;$/, '  setDisplayStream(null);'],
  [/^\s+displayStream = stream;$/, '  setDisplayStream(stream);'],
  [/^\s+source = null;$/, '  setSource(null);'],
  [/^\s+source = audioCtx\.createMediaElementSource\(audio\);$/, '  setSource(audioCtx.createMediaElementSource(audio));'],
  [/^\s+source = audioCtx\.createMediaStreamSource\(displayStream\);$/, '  setSource(audioCtx.createMediaStreamSource(displayStream));'],
  [/^\s+objectUrl = null;$/, '  setObjectUrl(null);'],
  [/^\s+objectUrl = url;$/, '  setObjectUrl(url);'],
  [/^\s+audio = new Audio\(url\);$/, '  setAudio(new Audio(url));'],
  [/^\s+audio = null;$/, '  setAudio(null);'],
  [/^\s+currentTrack = \{ url, title \};$/, '  setCurrentTrack({ url, title });'],
  // tunnel/arcade/rain/skyline simple assignments
  [/^\s+stormFlash = 0;$/, (m) => m.replace('stormFlash = 0', 'setStormFlash(0)')],
  [/^\s+stormFlash = Math\.min/, (m) => m.replace('stormFlash = ', 'setStormFlash(').replace(/;$/, ');')],
  [/^\s+lastLightningAt = now;$/, '    setLastLightningAt(now);'],
  [/^\s+tunnelScroll = 0;$/, (m) => m.replace('tunnelScroll = 0', 'setTunnelScroll(0)')],
  [/^\s+tunnelPulse = 0;$/, (m) => m.replace('tunnelPulse = 0', 'setTunnelPulse(0)')],
  [/^\s+arcadeFlash = 0;$/, (m) => m.replace('arcadeFlash = 0', 'setArcadeFlash(0)')],
  [/^\s+arcadeWarp = smooth/, (m) => m.replace('arcadeWarp = smooth', 'setArcadeWarp(smooth').replace(/;$/, ');')],
  [/^\s+arcadeFlash = smooth/, (m) => m.replace('arcadeFlash = smooth', 'setArcadeFlash(smooth').replace(/;$/, ');')],
  [/^\s+tunnelScroll = \(/, (m) => m.replace('tunnelScroll = ', 'setTunnelScroll(').replace(/;$/, ');')],
  [/^\s+tunnelSway = smooth/, (m) => m.replace('tunnelSway = smooth', 'setTunnelSway(smooth').replace(/;$/, ');')],
  [/^\s+tunnelPulse = smooth/, (m) => m.replace('tunnelPulse = smooth', 'setTunnelPulse(smooth').replace(/;$/, ');')],
  [/^\s+skylineKickBob = smooth/, (m) => m.replace('skylineKickBob = smooth', 'setSkylineKickBob(smooth').replace(/;$/, ');')],
  [/^\s+skylineDriveSmooth = smooth/, (m) => m.replace('skylineDriveSmooth = smooth', 'setSkylineDriveSmooth(smooth').replace(/;$/, ');')],
];

// Build new file
const newLines = [];
for (let i = 0; i < lines.length; i++) {
  if (skip.has(i)) continue;
  let line = lines[i];

  // Apply mutation replacements
  for (const [re, repl] of mutations) {
    if (typeof repl === "string") {
      if (re.test(line)) { line = line.replace(re, repl); break; }
    } else {
      const m = line.match(re);
      if (m) { line = repl(...m); break; }
    }
  }

  newLines.push(line);

  // Inject state.js import after the math.js import line
  if (line.includes('from "./math.js"')) {
    newLines.push(stateImport);
  }
}

fs.writeFileSync(runtimePath, newLines.join("\n"), "utf8");
console.log("Output lines:", newLines.length, "(removed", lines.length - newLines.length, "net)");
