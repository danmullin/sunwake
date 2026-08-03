/**
 * Shared runtime state — the single source of truth for all mutable globals.
 * Leaf modules (math, perf) import nothing from here.
 * Runtime and feature modules import what they need.
 *
 * Primitive lets use setter functions so other modules can mutate them safely.
 * Object refs (FX, CAM, levels, arrays) are mutable by reference.
 */

// ─── DOM refs ────────────────────────────────────────────────────────────────

export const canvas = document.getElementById("viz");
export const ctx = canvas.getContext("2d", { alpha: false });
export const stage = document.getElementById("stage");
export const gate = document.getElementById("gate");
export const playBtn = document.getElementById("play");
export const systemPlayBtn = document.getElementById("system-play");
export const systemChromeBtn = document.getElementById("system-chrome");
export const toggleBtn = document.getElementById("toggle");
export const restartBtn = document.getElementById("restart");
export const pickBtn = document.getElementById("pick-btn");
export const filePick = document.getElementById("file-pick");
export const trackTitleEl = document.getElementById("track-title");
export const statusEl = document.getElementById("status");
export const bassDot = document.getElementById("bass-dot");
export const midDot = document.getElementById("mid-dot");
export const airDot = document.getElementById("air-dot");
export const chromePresets = document.getElementById("chrome-presets");
export const hideUiBtn = document.getElementById("hide-ui");
export const uiPeek = document.getElementById("ui-peek");
export const brandEyebrow = document.getElementById("brand-eyebrow");
export const vizSwitchBtn = document.getElementById("viz-switch");
export const vizPicker = document.getElementById("viz-picker");

// ─── Canvas dimensions ───────────────────────────────────────────────────────

export let W = 0;
export let H = 0;
export let dpr = 1;
export function setDimensions(w, h, d) { W = w; H = h; dpr = d; }

// ─── Viz mode ────────────────────────────────────────────────────────────────

export const VIZ_MODE_LABELS = {
  nightDrive: "Night Drive",
  rainDrive:  "Rain Drive",
  tunnel:     "Tunnel",
  arcade:     "Arcade",
  skyline:    "Skyline",
};
export const VIZ_MODE_KEY = "sunwake.vizMode";
export const VIZ_MODES = ["nightDrive", "rainDrive", "tunnel", "arcade", "skyline"];
export let vizMode = "nightDrive";
export function setVizModeVar(m) { vizMode = m; }

try {
  const stored = localStorage.getItem(VIZ_MODE_KEY);
  if (VIZ_MODES.includes(stored)) vizMode = stored;
} catch { /* ignore */ }

// ─── Audio refs ──────────────────────────────────────────────────────────────

export let audioCtx = null;
export let analyser = null;
export let freq = null;
export let time = null;
export let source = null;
export let audio = null;
export let objectUrl = null;
export let displayStream = null;
/** @type {"idle" | "file" | "system"} */
export let sourceMode = "idle";
export let currentTrack = { url: null, title: null };
export let playing = false;
export let started = false;
export let raf = 0;
export let t0 = performance.now();

export function setAudioCtx(v)       { audioCtx = v; }
export function setAnalyser(v)        { analyser = v; }
export function setFreq(v)            { freq = v; }
export function setTime(v)            { time = v; }
export function setSource(v)          { source = v; }
export function setAudio(v)           { audio = v; }
export function setObjectUrl(v)       { objectUrl = v; }
export function setDisplayStream(v)   { displayStream = v; }
export function setSourceMode(v)      { sourceMode = v; }
export function setCurrentTrack(v)    { currentTrack = v; }
export function setPlaying(v)         { playing = v; }
export function setStarted(v)         { started = v; }
export function setRaf(v)             { raf = v; }
export function setT0(v)              { t0 = v; }

// ─── Level meter ─────────────────────────────────────────────────────────────

export const levels = { bass: 0, mid: 0, air: 0, peak: 0, snare: 0, hat: 0 };

// ─── FX config — toggles + dependency rules ──────────────────────────────────

export const FX_TOGGLES = {
  litFlocks: true,
  constellationTrails: true,
  vanishingMeteors: true,
  bassMountain: false,      // B-sides — showy bass ridge
  mirrorSea: false,         // B-sides — dreamy reflection (needs lit flocks)
  gridHeartbeat: false,     // B-sides — cool but busy pulse rings
  horizonBloom: true,
  whipVerticals: true,
  gridWaves: true,
  melodyLines: true,
  shockRings: true,
  sparks: true,
  streaks: true,
  keySparks: true,
  chordHalos: true,
  melodyThread: false,      // B-sides — lead ribbon across the sky
  hammerRipples: true,
  harmonyConstellation: true,
  shootingStars: true,
  soloAurora: true,
  horizonRibbons: true,
  mistSheets: true,
  rain: true,
  fog: true,
  dew: true,
  sunPulse: true,
  sunHalo: true,
  sunPetals: true,
  sunFlares: true,
  blackHole: false,         // void sun + opens Black hole child FX
  quasarJets: true,         // armed by default — one click on Black hole enables full suite
  photonPulse: true,
  infallSparks: true,
  lensingShimmer: true,
  doorway: false,           // B-sides — rare shutter parting
  skyLighting: true,
  starfield: true,
  horizonEllipse: true,
  cameraSway: true,
  horizonSway: true,        // companion — banks world + vanishing point with lateral sway
  depthFog: false,          // B-sides — layered haze into the distance
  cloudDeck: false,         // B-sides — pad clouds; cool but stiffens the sway feel
};

export function fxOn(key) {
  return FX_TOGGLES[key] !== false;
}

export const FX_REQUIRES = {
  constellationTrails: "litFlocks",
  mirrorSea:           "litFlocks",
  horizonSway:         "cameraSway",
  quasarJets:          "blackHole",
  photonPulse:         "blackHole",
  infallSparks:        "blackHole",
  lensingShimmer:      "blackHole",
};

export const FX_LABELS = {
  litFlocks:             "Lit flocks",
  constellationTrails:   "Constellation trails",
  vanishingMeteors:      "Vanishing meteors",
  bassMountain:          "Bass mountain",
  mirrorSea:             "Mirror sea",
  gridHeartbeat:         "Grid heartbeat",
  horizonBloom:          "Horizon bloom",
  whipVerticals:         "Whip verticals",
  gridWaves:             "Grid waves",
  melodyLines:           "Melody lines",
  shockRings:            "Shock rings",
  sparks:                "Sparks",
  streaks:               "Streaks",
  keySparks:             "Key sparks",
  chordHalos:            "Chord halos",
  melodyThread:          "Melody thread",
  hammerRipples:         "Hammer ripples",
  harmonyConstellation:  "Harmony constellation",
  shootingStars:         "Shooting stars",
  soloAurora:            "Solo aurora",
  horizonRibbons:        "Horizon ribbons",
  mistSheets:            "Haze sheets",
  cloudDeck:             "Cloud deck",
  rain:                  "Rain",
  fog:                   "Fog",
  dew:                   "Dew",
  sunPulse:              "Sun pulse",
  sunHalo:               "Sun halo",
  sunPetals:             "Sun petals",
  sunFlares:             "Sun flares",
  blackHole:             "Black hole",
  quasarJets:            "Quasar jets",
  photonPulse:           "Photon pulse",
  infallSparks:          "Infall sparks",
  lensingShimmer:        "Lensing shimmer",
  doorway:               "Doorway",
  skyLighting:           "Sky lighting",
  starfield:             "Starfield",
  horizonEllipse:        "Horizon ellipse",
  cameraSway:            "Camera sway",
  horizonSway:           "Horizon sway",
  depthFog:              "Depth fog",
};

// ─── Per-frame FX energy / clocks ────────────────────────────────────────────

export const FX = {
  solo: 0,
  prevBass: 0,
  prevAir: 0,
  prevMid: 0,
  bassSlow: 0,
  peakSlow: 0,
  snareSlow: 0,
  snareFloor: 0,
  hatSlow: 0,
  sparkBudget: 0,
  gridScroll: 0,
  gridDrive: 0,
  mist: 0,
  prevNow: 0,
  whips: [],
  whipNextAt: 0,
  lastKickAt: 0,
  lastSnareAt: 0,
  lastHatAt: 0,
  lastMirrorAt: 0,
  lastHeartbeatAt: 0,
  lastBloomAt: 0,
  lastDoorwayAt: 0,
  lastKeyAt: 0,
  lastChordAt: 0,
  lastHammerAt: 0,
  lastDrumAt: 0,
  midSlow: 0,
  sustain: 0,
  chord: 0,
  prevChord: 0,
  keys: 0,
  melodyY: 0.32,
  melodyPresence: 0,
  melodyNextAt: 0,
  doorway: 0,
  flare: 0,
  jet: 0,
  photon: 0,
};

// ─── Sun / black-hole geometry ───────────────────────────────────────────────

export let SUN_SCALE = 1.3;
export function setSunScale(v) { SUN_SCALE = v; }
export const SUN_SCALE_MIN = 1;
export const SUN_SCALE_MAX = 1.5;
export const SUN_Y_FRAC = 0.38;
export const SUN_DROP_PER_EXTRA = 0.07;
export const BH_DISK_TILT = -0.18;

// ─── Vertical grid whip ──────────────────────────────────────────────────────

export let WHIP_VERTICALS = true;
export function setWhipVerticals(v) { WHIP_VERTICALS = v; }
export const WHIP_SAMPLE_MS  = 100;
export const WHIP_TRAVEL_MS  = 1600;
export const WHIP_CREST_WIDTH = 0.14;
export const WHIP_STACK       = 0.45;

// ─── Grid consts ─────────────────────────────────────────────────────────────

export const GRID_ROWS        = 14;
export const GRID_COLS        = 24;
export const GRID_CELL_MAX    = 120;
export const GRID_TRAIL_MAX   = 160;
export const METEOR_MAX       = 28;
export const MIRROR_MAX       = 72;
export const MIRROR_GAP_MS    = 380;
export const HEARTBEAT_MAX    = 4;
export const BLOOM_MAX        = 5;
export const DOORWAY_GAP_MS   = 2800;
export const DOORWAY_OPEN_MS  = 90;
export const DOORWAY_HOLD_MS  = 420;
export const DOORWAY_CLOSE_MS = 380;
export const KEY_GAP_MS       = 85;
export const CHORD_GAP_MS     = 380;
export const HAMMER_GAP_MS    = 140;
export const DRUM_VETO_MS     = 280;
export const KEYS_ARM         = 0.44;
export const CHORD_HALO_MAX   = 6;
export const MELODY_MAX       = 96;
export const HARMONY_LINK_MAX = 18;
export const GRID_SUN_COL     = Math.floor((GRID_COLS - 1) / 2);
export const BASS_MOUNTAIN_N  = 22;
export const DRUM_GAP_KICK_MS = 120;
export const DRUM_GAP_SNARE_MS = 85;
export const DRUM_GAP_HAT_MS  = 65;
export const GRID_CELL_STEP_MS = 110;
export const GRID_RAINBOW     = false;
export const INFALL_MAX       = 90;

// ─── Particle / world arrays ─────────────────────────────────────────────────

export const ribbons       = [];
export const dew           = [];
export const fogPuffs      = [];
export const sparks        = [];
export const streaks       = [];
export const shocks        = [];
export const chordHalos    = [];
export const hammerRipples = [];
export const melodyThread  = [];
export const harmonyLinks  = [];
export const stars         = [];
export const rain          = [];
export const mistSheets    = [];
export const cloudDeck     = [];
export const shooting      = [];
export const horizonBands  = [];
export const gridCells     = [];
export const gridTrails    = [];
export const meteors       = [];
export const mirrorCells   = [];
export const heartbeats    = [];
export const bloomRings    = [];
export const infalls       = [];
export const bassMountain  = new Float32Array(BASS_MOUNTAIN_N);

// ─── Camera state ────────────────────────────────────────────────────────────

export const CAM = { x: 0, y: 0, rot: 0, zoom: 1, bank: 0, vanish: 0 };
export const CAM_SWAY_DRAMA    = 2.35;
export const HORIZON_SWAY_BANK = 0.00115;
export const HORIZON_SWAY_VANISH = 1.1;

// ─── Tunnel state ────────────────────────────────────────────────────────────

export let tunnelScroll = 0;
export let tunnelPulse  = 0;
export let tunnelSway   = 0;
export const tunnelPulseRings = [];
export const TUNNEL_RINGS_MAX = 24;
export function setTunnelScroll(v) { tunnelScroll = v; }
export function setTunnelPulse(v)  { tunnelPulse = v; }
export function setTunnelSway(v)   { tunnelSway = v; }

// ─── Arcade state ────────────────────────────────────────────────────────────

export const ARCADE_EQ_N   = 32;
export const arcadeEq      = new Float32Array(ARCADE_EQ_N);
export let arcadeWarp  = 0;
export let arcadeFlash = 0;
export const arcadeStars   = [];
export const ARCADE_STAR_N = 160;
export function setArcadeWarp(v)  { arcadeWarp = v; }
export function setArcadeFlash(v) { arcadeFlash = v; }

// ─── Rain Drive state ────────────────────────────────────────────────────────

export const stormClouds    = [];
export const lightningBolts = [];
export const LIGHTNING_MAX  = 6;
export const rainSplashes   = [];
export const RAIN_SPLASH_MAX = 48;
export let stormFlash      = 0;
export let lastLightningAt = 0;
export function setStormFlash(v)     { stormFlash = v; }
export function setLastLightningAt(v){ lastLightningAt = v; }

// ─── Skyline state ───────────────────────────────────────────────────────────

export const skylineFar    = [];
export const skylineMid    = [];
export const skylineNear   = [];
export let skylineKickBob    = 0;
export let skylineScrollPx   = 0;
export let skylineDriveSmooth = 1.1;
export const SKYLINE_SCROLL_RATE = 3.8;
export const skylineWinLits  = [];
export const SKYLINE_WIN_MAX  = 220;
export const SKYLINE_WIN_STEP_MS = 95;
export const skylineParty    = [];
export const SKYLINE_PARTY_MAX = 280;
export const SKYLINE_EQ_N    = 56;
export const skylineEq       = new Float32Array(SKYLINE_EQ_N);
export function setSkylineKickBob(v)    { skylineKickBob = v; }
export function setSkylineScrollPx(v)   { skylineScrollPx = v; }
export function setSkylineDriveSmooth(v){ skylineDriveSmooth = v; }
