/**
 * Peel simulation.js into grid.js / particles.js / sun.js draws.
 * Leaves simulation.js with updateFx + re-exports.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const lib = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "lib");
const simPath = fs.existsSync(path.join(lib, "simulation.full.bak.js"))
  ? path.join(lib, "simulation.full.bak.js")
  : path.join(lib, "simulation.js");
const lines = fs.readFileSync(simPath, "utf8").split(/\r?\n/);
console.log("source", path.basename(simPath), lines.length, "lines");

function idx(re, from = 0) {
  for (let i = from; i < lines.length; i++) if (re.test(lines[i])) return i;
  throw new Error("missing " + re);
}

const iHooks = idx(/^export function setRainSpawnHooks/);
const iGrid = idx(/^function spawnGridFlock/);
const iKeys = idx(/^function spawnKeySparks/);
const iUpdate = idx(/^function updateFx/);
const iAurora = idx(/^function drawSoloAurora\(/);
const iSun = idx(/^function drawSunPetals\(/);
const iHorizon = idx(/^function drawHorizon\(/);
const iFog = idx(/^function drawFog\(/);
const iMeters = idx(/^function updateMeters\(/);
const iExport = idx(/^export \{/);
console.log({ iGrid, iKeys, iUpdate, iAurora, iSun, iHorizon, iFog, iMeters });

const preamble = lines.slice(0, iHooks).join("\n"); // imports through streakDir + hooks start
// Rebuild shared import header for leaf modules
const stateImport = `import {
  canvas, ctx, W, H, dpr, t0,
  vizMode, playing, sourceMode, levels,
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
  bassDot, midDot, airDot, stage,
  BH_DISK_TILT,
} from "./state.js";
import { PERF, sparkCap } from "./perf.js";
import { SW_RAINBOW, synthRainbow, swapRemove, ecgShape, bandEnergy, smooth, midCentroid } from "./math.js";
import { vanishX, applyWorldTransform, resetScreenTransform, updateCamera } from "./camera.js";
import { sunYFrac, sunAnchor, sunDiskRadius, blackHoleOccludeRadius, behindBlackHole } from "./sun.js";
`;

function slice(a, b) {
  return lines.slice(a, b).join("\n");
}

const gridBody = [slice(iGrid, iKeys), slice(iHorizon, iFog)].join("\n\n");
const particleBody = [slice(iKeys, iUpdate), slice(iAurora, iSun), slice(iFog, iMeters)].join("\n\n");
const sunDrawBody = slice(iSun, iHorizon);
const updateBody = slice(iUpdate, iAurora);
const metersBody = slice(iMeters, iExport);
const hooksAndLocals = slice(iHooks, iGrid);

// seedWorld from runtime
const runtime = fs.readFileSync(path.join(lib, "runtime.js"), "utf8");
const seedM = runtime.match(/function seedWorld\(\) \{[\s\S]*?\n\}\r?\n/);
if (!seedM) throw new Error("seedWorld not found");

fs.writeFileSync(
  path.join(lib, "grid.js"),
  `/**
 * Grid / sea — flocks, meteors, mirror sea, bass mountain, drawSea.
 */
${stateImport}

let streakDir = 0;
function isSeaDrive() { return vizMode === "nightDrive" || vizMode === "rainDrive"; }

${gridBody}

export {
  spawnGridFlock, stepGridCell, spawnGridCells,
  spawnVanishingMeteor, spawnVanishingMeteors,
  spawnGridHeartbeat, spawnHorizonBloom, spawnMirrorSea,
  mirrorMeshPoint, drawMirrorSea,
  bassMountainProfile, updateBassMountain, drawBassMountain,
  gridMusicEnergy, gridMusicHot,
  drawHorizon, drawSea,
};
`
);

fs.writeFileSync(
  path.join(lib, "particles.js"),
  `/**
 * Particles + atmosphere draw helpers + world seed.
 */
${stateImport}
import { seedStormClouds } from "./storm.js";
import { seedArcadeStars } from "./scenes/arcade.js";
import {
  setStormFlash, setLastLightningAt, setArcadeFlash, setArcadeWarp,
  rainSplashes, lightningBolts,
} from "./state.js";

let streakDir = 0;
function isSeaDrive() { return vizMode === "nightDrive" || vizMode === "rainDrive"; }

${particleBody}

${seedM[0]}

export class ParticleSystem {
  seed() { seedWorld(); }
}

export {
  spawnKeySparks, spawnChordHalo, spawnHammerRipple, spawnHarmonyConstellation,
  updateMelodyThread, spawnInfall, spawnSpark, spawnStreak, spawnShock, spawnShootingStar,
  drawSoloAurora, drawSparks, drawInfallSparks, drawStreaks, drawShocks,
  drawChordHalos, drawMelodyThread, drawHammerRipples, drawHarmonyConstellation,
  drawSky, drawStars, drawShootingStars, drawHorizonRibbons, drawMistSheets,
  drawCloudDeck, drawRain, drawFog, drawDew, drawHeartbeatRing, drawUsPresence, drawVignette,
  seedWorld,
};
`
);

// Append sun draws to sun.js — rewrite whole file
const sunGeom = fs.readFileSync(path.join(lib, "sun.js"), "utf8");
// Keep only geometry exports (strip any prior draw appends)
const geomOnly = sunGeom.split("// ─── Sun draw")[0].trimEnd();

fs.writeFileSync(
  path.join(lib, "sun.js"),
  `${geomOnly}

// ─── Sun draw helpers ────────────────────────────────────────────────────────
import { ctx, W, H, t0, FX, SUN_SCALE, BH_DISK_TILT, infalls, canvas } from "./state.js";
import { PERF } from "./perf.js";
import { vanishX } from "./camera.js";

${sunDrawBody}

export {
  drawSunPetals, drawQuasarJets, drawSunFlares, drawSoftSun,
};
`
);

// Fix sun.js duplicate imports — rewrite cleanly
const sunClean = `import {
  W, H, SUN_SCALE, SUN_Y_FRAC, SUN_DROP_PER_EXTRA, fxOn, BH_DISK_TILT,
  t0, FX, infalls, canvas, ctx,
} from "./state.js";
import { PERF } from "./perf.js";
import { vanishX } from "./camera.js";

/** Sun / black-hole geometry helpers. */
export class SunModel {
  get scale() { return SUN_SCALE; }
  anchor() { return sunAnchor(); }
  diskRadius(bass = 0, solo = 0, pulseEnabled = false) {
    return sunDiskRadius(bass, solo, pulseEnabled);
  }
}

export { SUN_SCALE };

export function sunYFrac() {
  return SUN_Y_FRAC + (SUN_SCALE - 1) * SUN_DROP_PER_EXTRA;
}

export function sunAnchor() {
  return { x: W * 0.5, y: H * sunYFrac() };
}

export function sunDiskRadius(bass = 0, solo = 0, pulseEnabled = false) {
  const base = 0.11 + (pulseEnabled ? bass * 0.07 + solo * 0.04 : 0);
  return Math.min(W, H) * base * SUN_SCALE;
}

export function blackHoleOccludeRadius(bass = 0, solo = 0) {
  if (!fxOn("blackHole")) return 0;
  return sunDiskRadius(bass, solo, fxOn("sunPulse")) * 0.9;
}

export function behindBlackHole(px, py, bass = 0, solo = 0) {
  const R = blackHoleOccludeRadius(bass, solo);
  if (R <= 0) return false;
  const { x, y } = sunAnchor();
  const dx = px - x;
  const dy = py - y;
  return dx * dx + dy * dy <= R * R;
}

${sunDrawBody}

export {
  drawSunPetals, drawQuasarJets, drawSunFlares, drawSoftSun,
};
`;
fs.writeFileSync(path.join(lib, "sun.js"), sunClean);

fs.writeFileSync(
  path.join(lib, "simulation.js"),
  `/**
 * Simulation tick — drum routing + lifetimes.
 * Spawn/draw live in grid.js / particles.js / sun.js / storm.js.
 */
${stateImport}
import { getScene } from "./sceneRegistry.js";
import {
  spawnGridFlock, stepGridCell, spawnGridCells,
  spawnVanishingMeteor, spawnVanishingMeteors,
  spawnGridHeartbeat, spawnHorizonBloom, spawnMirrorSea,
  updateBassMountain, gridMusicHot, gridMusicEnergy,
  drawHorizon, drawSea, drawMirrorSea, drawBassMountain,
} from "./grid.js";
import {
  spawnKeySparks, spawnChordHalo, spawnHammerRipple, spawnHarmonyConstellation,
  updateMelodyThread, spawnInfall, spawnSpark, spawnStreak, spawnShock, spawnShootingStar,
  drawSoloAurora, drawSparks, drawInfallSparks, drawStreaks, drawShocks,
  drawChordHalos, drawMelodyThread, drawHammerRipples, drawHarmonyConstellation,
  drawSky, drawStars, drawShootingStars, drawHorizonRibbons, drawMistSheets,
  drawCloudDeck, drawRain, drawFog, drawDew, drawHeartbeatRing, drawUsPresence, drawVignette,
} from "./particles.js";
import { drawSunPetals, drawQuasarJets, drawSunFlares, drawSoftSun } from "./sun.js";
import {
  spawnSkylineWinFlock, spawnSkylineParty, updateSkylineWinLits, updateSkylineParty,
  updateSkylineEq,
} from "./scenes/skyline.js";
import {
  skylineWinLits, skylineParty, skylineKickBob, setSkylineKickBob,
  skylineScrollPx, setSkylineScrollPx, skylineDriveSmooth, setSkylineDriveSmooth,
  SKYLINE_SCROLL_RATE, stormFlash, setStormFlash, lastLightningAt, setLastLightningAt,
  rainSplashes, lightningBolts,
} from "./state.js";

${hooksAndLocals}

${updateBody}

${metersBody}

export class Simulation {
  update(bass, mid, air, now, peak = 0, snare = 0, hat = 0, leadPitch = 0.5) {
    updateFx(bass, mid, air, now, peak, snare, hat, leadPitch);
  }
}

export {
  updateFx, updateMeters, setRainSpawnHooks,
  spawnGridFlock, spawnGridCells, spawnVanishingMeteor, spawnVanishingMeteors,
  spawnGridHeartbeat, spawnHorizonBloom, spawnMirrorSea,
  drawMirrorSea, drawBassMountain, drawHorizon, drawSea,
  spawnKeySparks, spawnChordHalo, spawnHammerRipple, spawnHarmonyConstellation,
  updateMelodyThread, spawnInfall, spawnSpark, spawnStreak, spawnShock, spawnShootingStar,
  drawSoloAurora, drawSparks, drawInfallSparks, drawStreaks, drawShocks,
  drawChordHalos, drawMelodyThread, drawHammerRipples, drawHarmonyConstellation,
  drawSky, drawStars, drawShootingStars, drawHorizonRibbons, drawMistSheets,
  drawCloudDeck, drawRain, drawSunPetals, drawQuasarJets, drawSunFlares,
  drawSoftSun, drawFog, drawDew, drawHeartbeatRing, drawUsPresence, drawVignette,
};
`
);

console.log("peeled simulation → grid / particles / sun");
console.log({
  grid: fs.readFileSync(path.join(lib, "grid.js"), "utf8").split("\n").length,
  particles: fs.readFileSync(path.join(lib, "particles.js"), "utf8").split("\n").length,
  sun: fs.readFileSync(path.join(lib, "sun.js"), "utf8").split("\n").length,
  simulation: fs.readFileSync(path.join(lib, "simulation.js"), "utf8").split("\n").length,
});
