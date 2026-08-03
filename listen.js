const canvas = document.getElementById("viz");
const ctx = canvas.getContext("2d", { alpha: false });
const stage = document.getElementById("stage");
const gate = document.getElementById("gate");
const playBtn = document.getElementById("play");
const systemPlayBtn = document.getElementById("system-play");
const systemChromeBtn = document.getElementById("system-chrome");
const toggleBtn = document.getElementById("toggle");
const restartBtn = document.getElementById("restart");
const pickBtn = document.getElementById("pick-btn");
const filePick = document.getElementById("file-pick");
const trackTitleEl = document.getElementById("track-title");
const statusEl = document.getElementById("status");
const bassDot = document.getElementById("bass-dot");
const midDot = document.getElementById("mid-dot");
const airDot = document.getElementById("air-dot");
const chromePresets = document.getElementById("chrome-presets");
const hideUiBtn = document.getElementById("hide-ui");
const uiPeek = document.getElementById("ui-peek");
const brandEyebrow = document.getElementById("brand-eyebrow");
const vizSwitchBtn = document.getElementById("viz-switch");

const VIZ_MODE_KEY = "sunwake.vizMode";
/** @type {"nightDrive" | "skyline"} */
let vizMode = "nightDrive";
try {
  const stored = localStorage.getItem(VIZ_MODE_KEY);
  if (stored === "skyline" || stored === "nightDrive") vizMode = stored;
} catch {
  /* ignore */
}

/** Side-scroll city for Skyline mode — regenerated on resize. */
const skylineFar = [];
const skylineMid = [];
const skylineNear = [];
let skylineKickBob = 0;
/** Continuous side-scroll pixels for Skyline (driven by levels + gridDrive). */
let skylineScrollPx = 0;
/** Smoothed scroll rate — avoids bass spikes hitching the strip. */
let skylineDriveSmooth = 1.1;
/** Px advanced per ~16.7ms at driveSmooth=1 — shared by city scroll + party spawn velocity. */
const SKYLINE_SCROLL_RATE = 3.8;
/** Lit window flocks — Skyline's answer to Night Drive grid cells. */
const skylineWinLits = [];
const SKYLINE_WIN_MAX = 220;
const SKYLINE_WIN_STEP_MS = 95;
/** Rooftop party particles — kicks/snares throw confetti into the night. */
const skylineParty = [];
const SKYLINE_PARTY_MAX = 280;
/** Spectrum bars driving Skyline building heights (left=bass → right=air). */
const SKYLINE_EQ_N = 56;
const skylineEq = new Float32Array(SKYLINE_EQ_N);

let W = 0;
let H = 0;
let dpr = 1;
let audioCtx = null;
let analyser = null;
let freq = null;
let time = null;
let source = null;
let audio = null;
let objectUrl = null;
let displayStream = null;
/** @type {"idle" | "file" | "system"} */
let sourceMode = "idle";
let currentTrack = { url: null, title: null };
let playing = false;
let started = false;
let raf = 0;
let t0 = performance.now();

/** Perf knobs — stable every frame (no adaptive toggles; those strobed). */
const PERF = {
  emaDt: 16.7,
  lastNow: 0,
  meterAcc: 0,
  dprCap: 1.5,
  sparkMax: 320,
  gridStep: 12,
  vertSamples: 30,
  cellEdge: 5,
};

function updatePerf(now) {
  const raw = PERF.lastNow ? now - PERF.lastNow : 16.7;
  PERF.lastNow = now;
  const dt = raw > 0 && raw < 80 ? raw : 16.7;
  PERF.emaDt = PERF.emaDt * 0.9 + dt * 0.1;
}

function sparkCap() {
  return PERF.sparkMax;
}

function swapRemove(arr, i) {
  const last = arr.length - 1;
  if (i !== last) arr[i] = arr[last];
  arr.pop();
}


const ribbons = [];
const dew = [];
const fogPuffs = [];
const sparks = [];
const streaks = [];
const shocks = [];
const chordHalos = [];
const hammerRipples = [];
const melodyThread = [];
const harmonyLinks = [];
const stars = [];
const rain = [];
const mistSheets = [];
const cloudDeck = [];
const shooting = [];
const horizonBands = [];
const gridCells = [];
const gridTrails = [];
const meteors = [];
const mirrorCells = [];
const heartbeats = [];
const bloomRings = [];
const infalls = [];

/** Runtime FX switches — mirrored by the glass Effects panel.
 * Main groups default on; B-sides (parked experiments) default off. */
const FX_TOGGLES = {
  litFlocks: true,
  constellationTrails: true,
  vanishingMeteors: true,
  bassMountain: false, // B-sides — showy bass ridge
  mirrorSea: false, // B-sides — dreamy reflection (needs lit flocks)
  gridHeartbeat: false, // B-sides — cool but busy pulse rings
  horizonBloom: true,
  whipVerticals: true,
  gridWaves: true,
  melodyLines: true,
  shockRings: true,
  sparks: true,
  streaks: true,
  keySparks: true,
  chordHalos: true,
  melodyThread: false, // B-sides — lead ribbon across the sky
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
  blackHole: false, // void sun + opens Black hole child FX
  quasarJets: true, // armed by default — one click on Black hole enables full suite
  photonPulse: true,
  infallSparks: true,
  lensingShimmer: true,
  doorway: false, // B-sides — rare shutter parting
  skyLighting: true,
  starfield: true,
  horizonEllipse: true,
  cameraSway: true,
  horizonSway: true, // companion — banks world + vanishing point with lateral sway
  depthFog: false, // B-sides — layered haze into the distance
  cloudDeck: false, // B-sides — pad clouds; cool but stiffens the sway feel
};

function fxOn(key) {
  return FX_TOGGLES[key] !== false;
}

/** Child FX that only do something when a parent toggle is on. */
const FX_REQUIRES = {
  constellationTrails: "litFlocks",
  mirrorSea: "litFlocks",
  horizonSway: "cameraSway",
  quasarJets: "blackHole",
  photonPulse: "blackHole",
  infallSparks: "blackHole",
  lensingShimmer: "blackHole",
};

const FX_LABELS = {
  litFlocks: "Lit flocks",
  constellationTrails: "Constellation trails",
  vanishingMeteors: "Vanishing meteors",
  bassMountain: "Bass mountain",
  mirrorSea: "Mirror sea",
  gridHeartbeat: "Grid heartbeat",
  horizonBloom: "Horizon bloom",
  whipVerticals: "Whip verticals",
  gridWaves: "Grid waves",
  melodyLines: "Melody lines",
  shockRings: "Shock rings",
  sparks: "Sparks",
  streaks: "Streaks",
  keySparks: "Key sparks",
  chordHalos: "Chord halos",
  melodyThread: "Melody thread",
  hammerRipples: "Hammer ripples",
  harmonyConstellation: "Harmony constellation",
  shootingStars: "Shooting stars",
  soloAurora: "Solo aurora",
  horizonRibbons: "Horizon ribbons",
  mistSheets: "Haze sheets",
  cloudDeck: "Cloud deck",
  rain: "Rain",
  fog: "Fog",
  dew: "Dew",
  sunPulse: "Sun pulse",
  sunHalo: "Sun halo",
  sunPetals: "Sun petals",
  sunFlares: "Sun flares",
  blackHole: "Black hole",
  quasarJets: "Quasar jets",
  photonPulse: "Photon pulse",
  infallSparks: "Infall sparks",
  lensingShimmer: "Lensing shimmer",
  doorway: "Doorway",
  skyLighting: "Sky lighting",
  starfield: "Starfield",
  horizonEllipse: "Horizon ellipse",
  cameraSway: "Camera sway",
  horizonSway: "Horizon sway",
  depthFog: "Depth fog",
};

function syncFxDependencies() {
  for (const input of document.querySelectorAll("#fx-panel input[data-fx]")) {
    const key = input.dataset.fx;
    if (!key) continue;
    const label = input.closest(".fx-toggle");
    const parentKey = label?.dataset.requires || FX_REQUIRES[key];
    if (!parentKey) {
      input.disabled = false;
      label?.classList.remove("fx-toggle-disabled");
      if (label && label.dataset.baseTitle != null) {
        label.title = label.dataset.baseTitle;
      }
      continue;
    }
    const parentOn = !!FX_TOGGLES[parentKey];
    input.disabled = !parentOn;
    label?.classList.toggle("fx-toggle-disabled", !parentOn);
    if (label) {
      if (label.dataset.baseTitle == null) {
        label.dataset.baseTitle = label.title || "";
      }
      label.title = parentOn
        ? label.dataset.baseTitle
        : `Needs ${FX_LABELS[parentKey] || parentKey} on`;
    }
  }
}

const FX = {
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
  // Slow-motion whip: sample every WHIP_SAMPLE_MS; each crest travels WHIP_TRAVEL_MS
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
  doorway: 0, // 0 closed → 1 fully parted shutters
  flare: 0,
  jet: 0,
  photon: 0,
};


/**
 * Live sun size — Effects panel slider (1–1.5). Height drop scales with size.
 */
let SUN_SCALE = 1.3;
const SUN_SCALE_MIN = 1;
const SUN_SCALE_MAX = 1.5;
const SUN_Y_FRAC = 0.38; // original center (fraction of H)
/** Extra downward shift as fraction of H, per (SUN_SCALE - 1). */
const SUN_DROP_PER_EXTRA = 0.07;
/** Accretion-disk plane tilt (rad). Disk major axis = local X; poles / jets = local ±Y. */
const BH_DISK_TILT = -0.18;

function sunYFrac() {
  return SUN_Y_FRAC + (SUN_SCALE - 1) * SUN_DROP_PER_EXTRA;
}

function sunAnchor() {
  return { x: W * 0.5, y: H * sunYFrac() };
}

function sunDiskRadius(bass = 0, solo = 0, pulseEnabled = false) {
  const base = 0.11 + (pulseEnabled ? bass * 0.07 + solo * 0.04 : 0);
  return Math.min(W, H) * base * SUN_SCALE;
}

/** Event-horizon radius used to hide starfield behind the void. */
function blackHoleOccludeRadius(bass = 0, solo = 0) {
  if (!fxOn("blackHole")) return 0;
  return sunDiskRadius(bass, solo, fxOn("sunPulse")) * 0.9;
}

function behindBlackHole(px, py, bass = 0, solo = 0) {
  const R = blackHoleOccludeRadius(bass, solo);
  if (R <= 0) return false;
  const { x, y } = sunAnchor();
  const dx = px - x;
  const dy = py - y;
  return dx * dx + dy * dy <= R * R;
}

// Vertical grid whip — also mirrored by FX_TOGGLES.whipVerticals / Effects panel.
let WHIP_VERTICALS = true;
const WHIP_SAMPLE_MS = 100;
const WHIP_TRAVEL_MS = 1600;
const WHIP_CREST_WIDTH = 0.14;
const WHIP_STACK = 0.45;

// Lit grid squares — flocks spawn on drums, hop toward the sun.
const GRID_ROWS = 14;
const GRID_COLS = 24;
const GRID_CELL_MAX = 120;
const GRID_TRAIL_MAX = 160;
const METEOR_MAX = 28;
const MIRROR_MAX = 72;
const MIRROR_GAP_MS = 380;
const HEARTBEAT_MAX = 4;
const BLOOM_MAX = 5;
const DOORWAY_GAP_MS = 2800;
const DOORWAY_OPEN_MS = 90;
const DOORWAY_HOLD_MS = 420;
const DOORWAY_CLOSE_MS = 380;
const KEY_GAP_MS = 85;
const CHORD_GAP_MS = 380;
const HAMMER_GAP_MS = 140;
const DRUM_VETO_MS = 280;
const KEYS_ARM = 0.44;
const CHORD_HALO_MAX = 6;
const MELODY_MAX = 96;
const HARMONY_LINK_MAX = 18;
const GRID_SUN_COL = Math.floor((GRID_COLS - 1) / 2);

// Bass mountain — retro EQ skyline under the horizon, kick-driven.
const BASS_MOUNTAIN_N = 22;
const bassMountain = new Float32Array(BASS_MOUNTAIN_N);
/** Per-drum refractory so a kick can't eat the snare that follows. */
const DRUM_GAP_KICK_MS = 120;
const DRUM_GAP_SNARE_MS = 85;
const DRUM_GAP_HAT_MS = 65;
/** Steady hop toward the sun after spawn (ms per square). */
const GRID_CELL_STEP_MS = 110;

// Synthwave "rainbow" — stays in the night-drive palette (no lime/green).
const GRID_RAINBOW = false;
const SW_RAINBOW = [
  [130, 70, 200], // violet
  [255, 110, 168], // hot pink
  [255, 150, 115], // coral
  [240, 197, 106], // gold
  [69, 224, 255], // cyan
  [95, 155, 255], // electric blue
];

function synthRainbow(t, alpha) {
  const n = SW_RAINBOW.length;
  const x = ((t % 1) + 1) % 1;
  const f = x * n;
  const i = Math.floor(f) % n;
  const j = (i + 1) % n;
  const u = f - Math.floor(f);
  const a = SW_RAINBOW[i];
  const b = SW_RAINBOW[j];
  const r = (a[0] + (b[0] - a[0]) * u) | 0;
  const g = (a[1] + (b[1] - a[1]) * u) | 0;
  const bl = (a[2] + (b[2] - a[2]) * u) | 0;
  return `rgba(${r}, ${g}, ${bl}, ${alpha})`;
}

function spawnGridFlock(size, { row, col, hue, strength } = {}) {
  if (!fxOn("litFlocks") || size <= 0 || !playing) return;
  const flockHue = hue || (Math.random() > 0.55 ? "cyan" : Math.random() > 0.45 ? "pink" : "gold");
  const centerR =
    row != null
      ? Math.max(0, Math.min(GRID_ROWS - 2, row))
      : Math.floor(5 + Math.random() * (GRID_ROWS - 8)); // mid-field so flocks read clearly
  const centerC =
    col != null
      ? Math.max(0, Math.min(GRID_COLS - 2, col))
      : Math.floor(1 + Math.random() * (GRID_COLS - 3));

  let r = centerR;
  let c = centerC;
  const base = strength ?? 0.3 + Math.random() * 0.15;

  for (let k = 0; k < size; k++) {
    // Dense snare rolls fill the cap — recycle oldest so the grid never goes dark
    if (gridCells.length >= GRID_CELL_MAX) {
      gridCells.splice(0, Math.min(10, Math.ceil(size * 0.5)));
    }
    if (k > 0) {
      // Cohesion: often pull back toward the flock center, else step to a neighbor
      if (Math.random() < 0.4) {
        r = centerR + Math.round((Math.random() - 0.5) * 2);
        c = centerC + Math.round((Math.random() - 0.5) * 3);
      } else {
        const dr = Math.random() < 0.75 ? (Math.random() < 0.5 ? -1 : 1) : 0;
        const dc = Math.random() < 0.85 ? (Math.random() < 0.5 ? -1 : 1) : 0;
        r += dr;
        c += dc;
      }
      r = Math.max(0, Math.min(GRID_ROWS - 2, r));
      c = Math.max(0, Math.min(GRID_COLS - 2, c));
    }
    const dist = Math.abs(r - centerR) + Math.abs(c - centerC);
    // Freeze depth at spawn so grid scroll can't slide cells around between kicks.
    const depth = Math.min(0.92, Math.max(0.08, (r + 0.5) / GRID_ROWS));
    gridCells.push({
      depth,
      col: c,
      life: 1 - Math.min(0.2, dist * 0.05),
      decay: 0.003 + Math.random() * 0.003, // hold between beats; burn out at the sun
      hue: flockHue,
      strength: Math.max(0.2, base * (1 - dist * 0.08)),
      traveling: true,
      stepAcc: Math.random() * GRID_CELL_STEP_MS, // slight flock desync
      stepMs: GRID_CELL_STEP_MS * (0.9 + Math.random() * 0.2),
    });
  }
}

/** Advance traveling cells one square toward the sun. */
function stepGridCell(cell) {
  const step = 1 / GRID_ROWS;
  if (fxOn("constellationTrails") && cell.depth > step * 1.2) {
    if (gridTrails.length < GRID_TRAIL_MAX) {
      gridTrails.push({
        depth: cell.depth,
        col: cell.col,
        life: 0.85,
        decay: 0.028 + Math.random() * 0.02,
        hue: cell.hue,
        strength: cell.strength * (0.35 + Math.random() * 0.2),
      });
    }
  }
  if (cell.depth > step * 1.2) {
    cell.depth -= step;
    if (cell.col < GRID_SUN_COL) cell.col += 1;
    else if (cell.col > GRID_SUN_COL) cell.col -= 1;
    cell.col = Math.max(0, Math.min(GRID_COLS - 2, cell.col));
    cell.life = Math.min(1, cell.life + 0.05);
  } else {
    cell.traveling = false;
    cell.depth = step * 0.5;
    cell.decay = 0.07 + Math.random() * 0.04;
    cell.strength *= 1.25;
  }
}

/** Kick entry — several visible flocks so the beat is obvious on the grid. */
function spawnGridCells(n, opts = {}) {
  if (!fxOn("litFlocks") || n <= 0 || !playing) return;
  const flockSize = Math.max(5, Math.min(12, n));
  spawnGridFlock(flockSize, opts);
  // Always fan out 1–2 more flocks across the grid on a hit
  const extras = 1 + (n >= 6 ? 1 : 0);
  for (let i = 0; i < extras; i++) {
    spawnGridFlock(4 + Math.floor(Math.random() * 5), {
      ...opts,
      row: Math.floor(4 + Math.random() * (GRID_ROWS - 7)),
      col: Math.floor(1 + Math.random() * (GRID_COLS - 3)),
    });
  }
}

/**
 * Thin streaks that birth near the sun / vanishing point and race *down*
 * a grid vertical — call-and-response opposite of sunward flocks.
 */
function spawnVanishingMeteor(opts = {}) {
  if (!fxOn("vanishingMeteors") || !playing) return;
  if (meteors.length >= METEOR_MAX) return;
  const col =
    opts.col != null
      ? Math.max(0, Math.min(GRID_COLS, opts.col))
      : Math.floor(1 + Math.random() * (GRID_COLS - 1));
  meteors.push({
    col,
    depth: 0.015 + Math.random() * 0.05,
    speed: 0.014 + Math.random() * 0.022,
    len: 0.05 + Math.random() * 0.09,
    life: 1,
    decay: 0.006 + Math.random() * 0.008,
    // Night-drive palette: violet → pink → coral → gold → cyan → electric blue
    hueT: opts.hueT != null ? opts.hueT : Math.random(),
    width: 1.1 + Math.random() * 1.6,
  });
}

function spawnVanishingMeteors(n, opts = {}) {
  const count = Math.max(1, Math.min(n, 6));
  for (let i = 0; i < count; i++) spawnVanishingMeteor(opts);
}

/** Classic QRS-ish pulse shape; t is distance from the spike center (−0.5..0.5). */
function ecgShape(t) {
  const x = t * 14;
  const p = Math.exp(-Math.pow((x + 3.4) / 0.55, 2)) * 0.22;
  const q = -Math.exp(-Math.pow((x + 0.55) / 0.28, 2)) * 0.32;
  const r = Math.exp(-Math.pow(x / 0.2, 2));
  const s = -Math.exp(-Math.pow((x - 0.48) / 0.28, 2)) * 0.42;
  const tw = Math.exp(-Math.pow((x - 2.9) / 0.95, 2)) * 0.38;
  return p + q + r + s + tw;
}

/** Kick ECG — one waveform crawls a mid-row of the perspective grid. */
function spawnGridHeartbeat(strength = 0.6) {
  if (!fxOn("gridHeartbeat") || !playing) return;
  if (heartbeats.length >= HEARTBEAT_MAX) heartbeats.shift();
  const s = Math.max(0.25, Math.min(1, strength));
  heartbeats.push({
    progress: -0.08,
    speed: 0.016 + s * 0.014,
    life: 1,
    decay: 0.006 + (1 - s) * 0.004,
    amp: 10 + s * 22,
    depth: 0.38 + Math.random() * 0.16,
    hue: Math.random() > 0.45 ? "cyan" : "pink",
  });
}

/**
 * Snare radar — soft trapezoid rides the grid toward the camera, row by row.
 */
function spawnHorizonBloom(strength = 0.6) {
  if (!fxOn("horizonBloom") || !playing) return;
  if (bloomRings.length >= BLOOM_MAX) bloomRings.shift();
  const s = Math.max(0.3, Math.min(1, strength));
  bloomRings.push({
    depth: 0.1 + Math.random() * 0.08, // birth near the horizon
    origin: 3 + Math.random() * (GRID_COLS - 6),
    width: 0.28 + s * 0.35, // span as fraction of grid cols
    expand: 0.035 + s * 0.025, // widens a little each row hop
    stepAcc: 0,
    stepMs: 55 + (1 - s) * 35,
    life: 1,
    decay: 0.01 + (1 - s) * 0.008,
    strength: s,
    hueT: Math.random() > 0.45 ? 0.72 : 0.18, // cyan-ish or pink-ish in SW palette
  });
}

/**
 * Snapshot lit flocks into a brief inverted reflection above the horizon.
 * Fires on big drops — a sea that shouldn't exist up there.
 */
function spawnMirrorSea() {
  if (!fxOn("mirrorSea") || !playing) return;
  if (!gridCells.length) return;
  const ranked = gridCells
    .slice()
    .sort((a, b) => b.life * b.strength - a.life * a.strength);
  const take = Math.min(ranked.length, MIRROR_MAX);
  mirrorCells.length = 0;
  for (let i = 0; i < take; i++) {
    const c = ranked[i];
    mirrorCells.push({
      depth: c.depth,
      col: c.col,
      hue: c.hue,
      strength: c.strength * (0.7 + Math.random() * 0.25),
      life: 1,
      decay: 0.022 + Math.random() * 0.018,
    });
  }
}

/** Flat sea-mesh point (no wave/whip) — clean enough to flip into the sky. */
function mirrorMeshPoint(depth01, colI) {
  const horizon = H * 0.52;
  const seaH = H - horizon;
  const vanishingX = vanishX();
  const depthH = Math.pow(Math.min(0.999, Math.max(0.001, depth01)), 1.55);
  const ySea = horizon + depthH * seaH;
  const bottomX = -0.35 * W + (colI / GRID_COLS) * 1.7 * W;
  const topKeep = 0.28;
  const spread = topKeep + (1 - topKeep) * depthH;
  const x = vanishingX + (bottomX - vanishingX) * spread;
  // Invert across the horizon — reflection that shouldn't exist
  return { x, y: horizon - (ySea - horizon) * 0.92, horizon };
}

function drawMirrorSea() {
  if (!fxOn("mirrorSea") || !mirrorCells.length) return;
  const horizon = H * 0.52;
  const rowSpan = 1 / GRID_ROWS;
  const EDGE = 5;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, horizon);
  ctx.clip();
  ctx.globalCompositeOperation = "lighter";

  for (const cell of mirrorCells) {
    const a = cell.life * cell.strength * 0.55;
    if (a < 0.02) continue;
    const d0 = cell.depth;
    const d1 = Math.min(0.98, cell.depth + rowSpan);
    const c0 = cell.col;
    const c1 = cell.col + 1;
    const fill =
      cell.hue === "gold"
        ? `rgba(240, 197, 106, ${a * 0.45})`
        : cell.hue === "pink"
          ? `rgba(255, 110, 168, ${a * 0.42})`
          : `rgba(69, 224, 255, ${a * 0.42})`;
    ctx.fillStyle = fill;
    ctx.beginPath();
    for (let k = 0; k <= EDGE; k++) {
      const p = mirrorMeshPoint(d0, c0 + (k / EDGE) * (c1 - c0));
      if (k === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    for (let k = 1; k <= EDGE; k++) {
      const p = mirrorMeshPoint(d0 + (k / EDGE) * (d1 - d0), c1);
      ctx.lineTo(p.x, p.y);
    }
    for (let k = 1; k <= EDGE; k++) {
      const p = mirrorMeshPoint(d1, c1 - (k / EDGE) * (c1 - c0));
      ctx.lineTo(p.x, p.y);
    }
    for (let k = 1; k < EDGE; k++) {
      const p = mirrorMeshPoint(d1 - (k / EDGE) * (d1 - d0), c0);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.fill();
  }

  // Soft dream shimmer along the waterline
  const shim = ctx.createLinearGradient(0, horizon - 28, 0, horizon);
  shim.addColorStop(0, "rgba(69, 224, 255, 0)");
  shim.addColorStop(0.7, `rgba(255, 110, 168, ${0.04 + Math.min(0.12, mirrorCells.length * 0.0015)})`);
  shim.addColorStop(1, `rgba(69, 224, 255, ${0.06 + Math.min(0.1, mirrorCells.length * 0.0012)})`);
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = shim;
  ctx.fillRect(0, horizon - 28, W, 28);

  ctx.restore();
}

/** Kick-driven equalizer skyline profile (0..1 across bars). */
function bassMountainProfile(i, now = 0) {
  const u = BASS_MOUNTAIN_N <= 1 ? 0.5 : i / (BASS_MOUNTAIN_N - 1);
  const center = Math.pow(1 - Math.abs(u - 0.5) * 2, 1.35);
  const teeth = 0.55 + 0.45 * Math.sin(u * Math.PI * 7 + i * 0.7 + now * 0.0015);
  const shoulders = 0.35 + 0.65 * Math.sin(u * Math.PI * 2.2);
  return Math.max(0.12, 0.25 * shoulders + 0.55 * center + 0.35 * teeth);
}

function updateBassMountain(bass, kickBoost, now) {
  if (!fxOn("bassMountain")) {
    for (let i = 0; i < BASS_MOUNTAIN_N; i++) bassMountain[i] *= 0.88;
    return;
  }
  for (let i = 0; i < BASS_MOUNTAIN_N; i++) {
    const profile = bassMountainProfile(i, now);
    // Stronger continuous floor so the skyline always tracks the low end
    let target = bass * 0.48 * profile;
    if (kickBoost > 0) {
      target = Math.min(1, target + kickBoost * profile * (0.7 + Math.random() * 0.5));
    }
    const cur = bassMountain[i];
    const rate = target > cur ? (kickBoost > 0.35 ? 0.72 : 0.28) : 0.05;
    bassMountain[i] = cur + (target - cur) * rate;
  }
}

function drawBassMountain(bass) {
  if (!fxOn("bassMountain")) return;
  let peak = 0;
  for (let i = 0; i < BASS_MOUNTAIN_N; i++) peak = Math.max(peak, bassMountain[i]);
  if (peak < 0.02) return;

  const horizon = H * 0.52;
  const vanishingX = vanishX();
  const { x: sunX, y: sunY } = sunAnchor();
  const sunR = Math.min(W, H) * (0.12 + bass * 0.06) * SUN_SCALE;
  const maxH = Math.min(W, H) * (0.16 + bass * 0.1);
  // Same lean language as the sea grid verticals
  const topKeep = 0.28;
  const depthFloor = 0.05;

  const edgeX = (colT, depth) => {
    const bottomX = -0.3 * W + colT * 1.6 * W;
    const spread = topKeep + (1 - topKeep) * depth;
    return vanishingX + (bottomX - vanishingX) * spread;
  };

  // 0 near the sun disk → 1 out on the flanks (lets the sun shine through center)
  const sunWindow = (x, y) => {
    const d = Math.hypot(x - sunX, y - sunY) / (sunR * 1.85);
    if (d <= 0.45) return 0.42;
    if (d >= 1.15) return 1;
    return 0.42 + ((d - 0.45) / 0.7) * 0.58;
  };

  ctx.save();

  // Neon EQ bars — full night-drive palette, tips soft so the sun still bleeds through
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < BASS_MOUNTAIN_N; i++) {
    const h = bassMountain[i];
    if (h < 0.025) continue;
    const colT0 = i / BASS_MOUNTAIN_N;
    const colT1 = (i + 1) / BASS_MOUNTAIN_N;
    const depthTop = depthFloor + h * 0.28;
    const x0b = edgeX(colT0, depthFloor);
    const x1b = edgeX(colT1, depthFloor);
    const x0t = edgeX(colT0, depthTop);
    const x1t = edgeX(colT1, depthTop);
    const yTop = horizon - h * maxH;
    const yBot = horizon + 3;
    const midX = (x0t + x1t) * 0.5;
    const win = sunWindow(midX, (yTop + horizon) * 0.5);
    const hue = i / BASS_MOUNTAIN_N + h * 0.12;

    ctx.beginPath();
    ctx.moveTo(x0b, yBot);
    ctx.lineTo(x1b, yBot);
    ctx.lineTo(x1t, yTop);
    ctx.lineTo(x0t, yTop);
    ctx.closePath();

    // Tip → body → footing, all synthwave hues (violet→pink→coral→gold→cyan→blue)
    const fill = ctx.createLinearGradient(0, yTop, 0, yBot);
    fill.addColorStop(0, synthRainbow(hue + 0.22, (0.12 + h * 0.18) * win));
    fill.addColorStop(0.28, synthRainbow(hue + 0.08, (0.28 + h * 0.32) * win));
    fill.addColorStop(0.62, synthRainbow(hue, (0.38 + h * 0.35) * win));
    fill.addColorStop(1, synthRainbow(hue - 0.12, (0.22 + h * 0.2) * win));
    ctx.fillStyle = fill;
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";

  // Neon crest — rainbow skim along the skyline
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let i = 0; i < BASS_MOUNTAIN_N - 1; i++) {
    const h0 = bassMountain[i];
    const h1 = bassMountain[i + 1];
    const colT0 = (i + 0.5) / BASS_MOUNTAIN_N;
    const colT1 = (i + 1.5) / BASS_MOUNTAIN_N;
    const x0 = edgeX(colT0, depthFloor + h0 * 0.28);
    const y0 = horizon - h0 * maxH;
    const x1 = edgeX(colT1, depthFloor + h1 * 0.28);
    const y1 = horizon - h1 * maxH;
    const win = Math.min(sunWindow(x0, y0), sunWindow(x1, y1));
    if (win < 0.35) continue;
    const a = (0.35 + peak * 0.45) * win;
    ctx.strokeStyle = synthRainbow(i / BASS_MOUNTAIN_N + 0.15, a);
    ctx.lineWidth = 1.5 + peak * 2;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.strokeStyle = synthRainbow(i / BASS_MOUNTAIN_N + 0.35, a * 0.55);
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Hot tips on the flanks
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < BASS_MOUNTAIN_N; i++) {
    const h = bassMountain[i];
    if (h < 0.35) continue;
    const colT = (i + 0.5) / BASS_MOUNTAIN_N;
    const depthTop = depthFloor + h * 0.28;
    const x = edgeX(colT, depthTop);
    const y = horizon - h * maxH;
    const win = sunWindow(x, y);
    if (win < 0.4) continue;
    ctx.fillStyle = synthRainbow(i / BASS_MOUNTAIN_N + 0.25, (0.3 + h * 0.4) * win);
    ctx.beginPath();
    ctx.arc(x, y, 1.2 + h * 2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function gridMusicEnergy(bass, mid, air, snare = 0) {
  return bass * 0.42 + mid * 0.28 + air * 0.12 + snare * 0.38;
}

function gridMusicHot(bass, mid, air, snare = 0) {
  return playing && gridMusicEnergy(bass, mid, air, snare) > 0.1;
}

function prettyName(filename) {
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function setTrackTitle(title) {
  if (trackTitleEl) {
    if (title) {
      trackTitleEl.hidden = false;
      trackTitleEl.textContent = title;
    } else {
      trackTitleEl.textContent = "";
      trackTitleEl.hidden = true;
    }
  }
  document.title = title ? `Sunwake — ${title}` : "Sunwake";
}

async function loadBuildStamp() {
  const el = document.getElementById("build-stamp");
  try {
    const res = await fetch(new URL("./version.json", import.meta.url), {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const v = await res.json();
    const codename = v.codename || "Quasar";
    const sha = v.sha || "local";
    const date = v.date || "dev";
    const name = v.name || "Sunwake";
    const short = `${codename} · ${sha}`;
    const full = `${name} “${codename}” — ${date} · ${sha}`;
    if (el) {
      el.hidden = false;
      el.textContent = short;
      el.title = full;
    }
    console.log(`%c${full}`, "color:#45e0ff;font-weight:600");
  } catch (err) {
    if (el) el.hidden = true;
    console.warn("Sunwake build stamp missing", err);
  }
}

function ensureGraph() {
  if (!audioCtx) {
    audioCtx = new AudioContext();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.82;
    freq = new Uint8Array(analyser.frequencyBinCount);
    time = new Uint8Array(analyser.fftSize);
    // Analyser stays analyse-only. File sources connect to destination separately
    // so system capture never double-plays through the speakers.
  }
}

function stopDisplayStream() {
  if (!displayStream) return;
  for (const track of displayStream.getTracks()) {
    try {
      track.stop();
    } catch {
      /* ignore */
    }
  }
  displayStream = null;
}

function detachAudio() {
  if (audio) {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  }
  if (source) {
    try {
      source.disconnect();
    } catch {
      /* already disconnected */
    }
    source = null;
  }
  stopDisplayStream();
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }
  audio = null;
}

function setUsMode(on) {
  stage.classList.toggle("us-mode", on);
}

function setUiHidden(hidden) {
  stage.classList.toggle("ui-hidden", hidden);
  if (uiPeek) uiPeek.hidden = !hidden;
  if (hideUiBtn) hideUiBtn.textContent = hidden ? "Show UI" : "Hide UI";
}

function toggleUiHidden() {
  setUiHidden(!stage.classList.contains("ui-hidden"));
}

function setFxPanelHidden(hidden) {
  const panel = document.getElementById("fx-panel");
  const peek = document.getElementById("fx-peek");
  panel?.classList.toggle("fx-panel-hidden", hidden);
  if (peek) peek.hidden = !hidden;
}

function toggleFxPanelHidden() {
  const panel = document.getElementById("fx-panel");
  setFxPanelHidden(!panel?.classList.contains("fx-panel-hidden"));
}

function showFileChrome() {
  gate.classList.add("gone");
  toggleBtn.hidden = false;
  restartBtn.hidden = false;
  pickBtn.hidden = false;
  if (chromePresets) chromePresets.hidden = true;
  systemChromeBtn.hidden = false;
  if (vizSwitchBtn) vizSwitchBtn.hidden = false;
  toggleBtn.textContent = "Pause";
  setUsMode(false);
  syncVizModeUi();
}

function showSystemChrome() {
  gate.classList.add("gone");
  toggleBtn.hidden = false;
  restartBtn.hidden = true;
  pickBtn.hidden = false;
  if (chromePresets) chromePresets.hidden = true;
  systemChromeBtn.hidden = true;
  if (vizSwitchBtn) vizSwitchBtn.hidden = false;
  toggleBtn.textContent = "Stop share";
  setUsMode(true);
  syncVizModeUi();
}

function wireAudioElement(url) {
  ensureGraph();
  detachAudio();

  audio = new Audio(url);
  audio.crossOrigin = "anonymous";
  audio.loop = false;
  audio.preload = "auto";

  source = audioCtx.createMediaElementSource(audio);
  source.connect(analyser);
  source.connect(audioCtx.destination);

  audio.addEventListener("ended", () => {
    playing = false;
    toggleBtn.textContent = "Play";
    statusEl.textContent = "ended — hit Restart";
  });
}

async function loadTrack({ url, title, autoplay = false }) {
  currentTrack = { url, title };
  sourceMode = "file";
  setTrackTitle(title);
  wireAudioElement(url);

  if (autoplay || started) {
    if (audioCtx.state === "suspended") await audioCtx.resume();
    await audio.play();
    playing = true;
    started = true;
    showFileChrome();
    statusEl.textContent = "listening";
    if (!raf) raf = requestAnimationFrame(frame);
  } else {
    statusEl.textContent = `loaded — ${title}`;
  }
}

async function loadFile(file) {
  if (!file) return;
  if (!file.type.startsWith("audio/")) {
    const ok = /\.(mp3|wav|flac|m4a|aac|ogg|opus|webm)$/i.test(file.name || "");
    if (!ok) {
      statusEl.textContent = "need an audio file";
      return;
    }
  }
  const url = URL.createObjectURL(file);
  const prev = objectUrl;
  objectUrl = null;
  if (prev) URL.revokeObjectURL(prev);
  await loadTrack({
    url,
    title: prettyName(file.name),
    autoplay: true,
  });
  objectUrl = url;
}

function onSystemShareEnded() {
  if (sourceMode !== "system") return;
  playing = false;
  sourceMode = "idle";
  if (source) {
    try {
      source.disconnect();
    } catch {
      /* ignore */
    }
    source = null;
  }
  displayStream = null;
  setUsMode(false);
  toggleBtn.textContent = "System audio";
  restartBtn.hidden = true;
  systemChromeBtn.hidden = false;
  statusEl.textContent = "share ended";
}

async function startSystemListen(e) {
  e?.stopPropagation?.();
  ensureGraph();
  if (audioCtx.state === "suspended") await audioCtx.resume();

  statusEl.textContent = "pick Entire screen + system audio…";

  let stream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
      systemAudio: "include",
    });
  } catch {
    statusEl.textContent = "share cancelled";
    return;
  }

  const audioTracks = stream.getAudioTracks();
  if (!audioTracks.length) {
    for (const track of stream.getTracks()) track.stop();
    statusEl.textContent = "enable Share system audio";
    return;
  }

  detachAudio();
  displayStream = stream;

  source = audioCtx.createMediaStreamSource(displayStream);
  // Analyse only — never connect to destination (you'd hear a second copy).
  source.connect(analyser);

  for (const track of displayStream.getAudioTracks()) {
    track.addEventListener("ended", onSystemShareEnded);
  }

  sourceMode = "system";
  playing = true;
  started = true;
  setTrackTitle("system audio");
  showSystemChrome();
  statusEl.textContent = "listening to system audio";
  if (!raf) raf = requestAnimationFrame(frame);
}

function stopSystemListen() {
  if (sourceMode !== "system") return;
  detachAudio();
  sourceMode = "idle";
  playing = false;
  setUsMode(false);
  toggleBtn.textContent = "System audio";
  restartBtn.hidden = true;
  systemChromeBtn.hidden = false;
  pickBtn.hidden = false;
  if (chromePresets) chromePresets.hidden = true;
  setTrackTitle(currentTrack.title || null);
  statusEl.textContent = "share ended";
}

async function start() {
  if (sourceMode === "system") return;
  if (!audio) {
    filePick?.click();
    return;
  }
  if (audioCtx.state === "suspended") await audioCtx.resume();
  await audio.play();
  playing = true;
  started = true;
  sourceMode = "file";
  showFileChrome();
  statusEl.textContent = "listening";
  if (!raf) raf = requestAnimationFrame(frame);
}

function toggle() {
  if (sourceMode === "system") {
    stopSystemListen();
    return;
  }
  if (!started) return start();
  if (!audio) {
    if (toggleBtn.textContent.toLowerCase().includes("system")) {
      startSystemListen();
    }
    return;
  }
  if (playing) {
    audio.pause();
    playing = false;
    toggleBtn.textContent = "Play";
    statusEl.textContent = "paused";
  } else {
    if (audio.ended || (audio.duration && audio.currentTime >= audio.duration - 0.05)) {
      audio.currentTime = 0;
    }
    audio.play();
    playing = true;
    toggleBtn.textContent = "Pause";
    statusEl.textContent = "listening";
  }
}

async function restart() {
  if (sourceMode === "system") {
    statusEl.textContent = "system mode — stop share to switch songs";
    return;
  }
  if (!started) return start();
  if (!audio) return;
  if (audioCtx?.state === "suspended") await audioCtx.resume();
  audio.currentTime = 0;
  await audio.play();
  playing = true;
  toggleBtn.textContent = "Pause";
  statusEl.textContent = "restarted";
}

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, PERF.dprCap);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.floor(W * dpr);
  canvas.height = Math.floor(H * dpr);
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  seedSkylineCity();
}

function bandEnergy(data, from, to) {
  let sum = 0;
  const a = Math.max(0, Math.floor(from));
  const b = Math.min(data.length - 1, Math.ceil(to));
  if (b <= a) return 0;
  for (let i = a; i <= b; i++) sum += data[i];
  return sum / ((b - a + 1) * 255);
}

function smooth(prev, next, amount) {
  return prev + (next - prev) * amount;
}

/** Soft ride into the river — translate/rotate/zoom the world around the horizon. */
const CAM = { x: 0, y: 0, rot: 0, zoom: 1, bank: 0, vanish: 0 };
/**
 * Camera sway intensity. 1 = current gentle ride; try ~1.6–1.8 for drama.
 * Easy backout: set CAM_SWAY_DRAMA = 1
 */
const CAM_SWAY_DRAMA = 2.35;
/** Horizon sway — bank (rad/px of CAM.x) + vanishing lean (px per CAM.x).
 * Stronger bank-into-turn; ease back with ~0.00048 / 0.62 if too wild. */
const HORIZON_SWAY_BANK = 0.00115;
const HORIZON_SWAY_VANISH = 1.1;

function updateCamera(now, bass, mid, air, peak, snare) {
  let tx = 0;
  let ty = 0;
  let trot = 0;
  let tzoom = 1;
  let tbank = 0;
  let tvanish = 0;
  if (fxOn("cameraSway")) {
    const t = (now - t0) * 0.001;
    const d = CAM_SWAY_DRAMA;
    // Slow cruise — always a little motion so the night never feels bolted down
    tx = (Math.sin(t * 0.21) * 9 + Math.sin(t * 0.47) * 3.5) * d;
    ty = (Math.cos(t * 0.17) * 5.5 + Math.sin(t * 0.31) * 2.5) * d;
    // Lean forward into the sea on low end / peaks
    ty += (bass * 12 + peak * 7) * d;
    // Lateral weave on mid + snare crack
    tx += (Math.sin(t * 0.95) * mid * 5.5 + (snare - 0.15) * 5) * d;
    trot = (Math.sin(t * 0.14) * 0.01 + Math.sin(t * 0.38) * mid * 0.007) * d;
    // Base zoom hides edges while swaying; bass pulls you in
    tzoom = 1.04 + (bass * 0.032 + peak * 0.018 + air * 0.008) * d;
    if (fxOn("horizonSway")) {
      // Bank + perspective lean into the direction of the lateral ride
      tbank = tx * HORIZON_SWAY_BANK;
      tvanish = tx * HORIZON_SWAY_VANISH;
    }
  }
  CAM.x = smooth(CAM.x, tx, 0.07);
  CAM.y = smooth(CAM.y, ty, 0.08);
  CAM.rot = smooth(CAM.rot, trot, 0.06);
  CAM.zoom = smooth(CAM.zoom, tzoom, 0.06);
  CAM.bank = smooth(CAM.bank, tbank, 0.11);
  CAM.vanish = smooth(CAM.vanish, tvanish, 0.1);
}

/** Perspective vanishing X — drifts with horizon sway. */
function vanishX() {
  return W * 0.5 + CAM.vanish;
}

function applyWorldTransform() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cx = W * 0.5;
  const cy = H * 0.55;
  ctx.translate(cx + CAM.x, cy + CAM.y);
  ctx.rotate(CAM.rot + CAM.bank);
  ctx.scale(CAM.zoom, CAM.zoom);
  ctx.translate(-cx, -cy);
}

function resetScreenTransform() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

const levels = { bass: 0, mid: 0, air: 0, peak: 0, snare: 0, hat: 0 };

function seedWorld() {
  ribbons.length = 0;
  dew.length = 0;
  fogPuffs.length = 0;
  sparks.length = 0;
  streaks.length = 0;
  shocks.length = 0;
  chordHalos.length = 0;
  hammerRipples.length = 0;
  melodyThread.length = 0;
  harmonyLinks.length = 0;
  stars.length = 0;
  rain.length = 0;
  mistSheets.length = 0;
  cloudDeck.length = 0;
  shooting.length = 0;
  horizonBands.length = 0;
  meteors.length = 0;
  mirrorCells.length = 0;
  heartbeats.length = 0;
  bloomRings.length = 0;
  infalls.length = 0;
  bassMountain.fill(0);
  FX.solo = 0;
  FX.keys = 0;
  FX.sustain = 0;
  FX.chord = 0;
  FX.prevChord = 0;
  FX.lastDrumAt = 0;
  FX.prevBass = 0;
  FX.prevAir = 0;
  FX.sparkBudget = 0;
  FX.doorway = 0;
  FX.lastDoorwayAt = 0;
  FX.mist = 0;
  FX.flare = 0;
  FX.jet = 0;
  FX.photon = 0;

  for (let i = 0; i < 5; i++) {
    ribbons.push({
      phase: Math.random() * Math.PI * 2,
      speed: 0.35 + i * 0.08,
      amp: 28 + i * 10,
      y: 0.42 + i * 0.055,
      hue: i % 2 === 0 ? "cyan" : "rose",
      width: 1.4 + i * 0.35,
    });
  }

  for (let i = 0; i < 90; i++) {
    dew.push({
      x: Math.random(),
      y: Math.random() * 0.72,
      r: 0.6 + Math.random() * 1.8,
      tw: Math.random() * Math.PI * 2,
      sp: 0.2 + Math.random() * 0.7,
    });
  }

  for (let i = 0; i < 18; i++) {
    fogPuffs.push({
      x: Math.random(),
      y: 0.55 + Math.random() * 0.35,
      r: 120 + Math.random() * 220,
      drift: (Math.random() - 0.5) * 0.03,
      alpha: 0.04 + Math.random() * 0.06,
    });
  }

  for (let i = 0; i < 220; i++) {
    stars.push({
      x: Math.random(),
      y: Math.random() * 0.48,
      r: Math.random() < 0.12 ? 1.4 + Math.random() * 1.6 : 0.5 + Math.random() * 1.1,
      tw: Math.random() * Math.PI * 2,
      sp: 0.35 + Math.random() * 1.2,
      bright: 0.25 + Math.random() * 0.75,
      flare: Math.random() < 0.08,
    });
  }

  for (let i = 0; i < 110; i++) {
    rain.push({
      x: Math.random(),
      y: Math.random(),
      len: 0.012 + Math.random() * 0.028,
      sp: 0.004 + Math.random() * 0.009,
      drift: 0.0015 + Math.random() * 0.003,
      a: 0.12 + Math.random() * 0.28,
    });
  }

  for (let i = 0; i < 5; i++) {
    mistSheets.push({
      x: Math.random(),
      y: 0.15 + Math.random() * 0.55,
      w: 0.35 + Math.random() * 0.55,
      h: 0.08 + Math.random() * 0.14,
      angle: -0.55 - Math.random() * 0.35,
      drift: (Math.random() - 0.5) * 0.00025,
      phase: Math.random() * Math.PI * 2,
      hue: i % 2 === 0 ? "cyan" : "rose",
    });
  }

  // Slow parallax cloud bands — live above the horizon, bloom on pads
  for (let i = 0; i < 5; i++) {
    const depth = i / 4; // 0 far → 1 near
    const puffs = [];
    const n = 4 + (i % 3);
    for (let p = 0; p < n; p++) {
      puffs.push({
        u: p / n + (Math.random() - 0.5) * 0.08,
        w: 0.14 + Math.random() * 0.18,
        h: 0.55 + Math.random() * 0.55,
        lift: (Math.random() - 0.5) * 0.35,
      });
    }
    cloudDeck.push({
      y: 0.26 + depth * 0.2,
      h: 0.028 + depth * 0.022,
      // nearer bands drift a little faster
      speed: 0.000028 + depth * 0.000055,
      offset: Math.random(),
      phase: Math.random() * Math.PI * 2,
      depth,
      hue: i % 3 === 0 ? "cyan" : i % 3 === 1 ? "rose" : "violet",
      puffs,
    });
  }

  for (let i = 0; i < 4; i++) {
    horizonBands.push({
      y: 0.44 + i * 0.018,
      amp: 6 + i * 3,
      speed: 0.4 + i * 0.12,
      phase: Math.random() * Math.PI * 2,
      hue: i % 3 === 0 ? "cyan" : i % 3 === 1 ? "rose" : "gold",
      width: 1.2 + i * 0.35,
    });
  }
}

function spawnKeySparks(strength = 0.5) {
  if (!fxOn("keySparks")) return;
  if (sparks.length > sparkCap()) return;
  const n = Math.min(14, 3 + Math.floor(strength * 10));
  const sy = sunYFrac();
  for (let i = 0; i < n; i++) {
    sparks.push({
      x: 0.5 + (Math.random() - 0.5) * (0.08 + strength * 0.14),
      y: sy + (Math.random() - 0.35) * 0.1,
      vx: (Math.random() - 0.5) * (0.003 + strength * 0.004),
      vy: -0.0015 - Math.random() * (0.0025 + strength * 0.003),
      life: 1,
      decay: 0.011 + Math.random() * 0.012,
      r: 1.1 + Math.random() * 2.4 + strength * 1.2,
      hue: Math.random() > 0.4 ? "gold" : "rose",
    });
  }
}

function spawnChordHalo(strength = 0.5) {
  if (!fxOn("chordHalos")) return;
  while (chordHalos.length >= CHORD_HALO_MAX) chordHalos.shift();
  chordHalos.push({
    life: 1,
    decay: 0.0065 + (1 - strength) * 0.005,
    r: 0.06 + strength * 0.04,
    max: 0.2 + strength * 0.32,
    strength,
    hueT: Math.random() * 0.35 + strength * 0.15,
  });
}

function spawnHammerRipple(strength = 0.5) {
  if (!fxOn("hammerRipples")) return;
  if (hammerRipples.length > 10) hammerRipples.shift();
  hammerRipples.push({
    x: 0.5 + (Math.random() - 0.5) * 0.18,
    y: sunYFrac() + 0.015 + Math.random() * 0.08,
    r: 0.012,
    max: 0.07 + strength * 0.14,
    life: 1,
    decay: 0.02 + (1 - strength) * 0.012,
    strength,
  });
}

function spawnHarmonyConstellation(strength = 0.5) {
  if (!fxOn("harmonyConstellation") || stars.length < 4) return;
  const pool = [];
  for (const s of stars) {
    if (s.y < 0.5 && s.bright > 0.35) pool.push(s);
  }
  if (pool.length < 3) return;
  // Pick a small cluster and link them as a path + a couple chords
  const n = Math.min(pool.length, 3 + Math.floor(strength * 3));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }
  const pick = pool.slice(0, n);
  const addLink = (a, b, lifeScale = 1) => {
    if (harmonyLinks.length >= HARMONY_LINK_MAX) harmonyLinks.shift();
    harmonyLinks.push({
      ax: a.x,
      ay: a.y,
      bx: b.x,
      by: b.y,
      life: 1 * lifeScale,
      decay: 0.007 + (1 - strength) * 0.006,
      hueT: Math.random() * 0.4 + strength * 0.2,
    });
  };
  for (let i = 0; i < pick.length - 1; i++) addLink(pick[i], pick[i + 1]);
  if (pick.length >= 3 && Math.random() < 0.7 + strength * 0.2) {
    addLink(pick[0], pick[pick.length - 1], 0.85);
  }
  if (pick.length >= 4 && Math.random() < 0.45 + strength * 0.3) {
    addLink(pick[1], pick[pick.length - 1], 0.7);
  }
}

function midCentroid(data) {
  if (!data || !data.length) return 0.5;
  const n = data.length;
  const a = Math.max(1, Math.floor(n * 0.06));
  const b = Math.min(n - 1, Math.floor(n * 0.38));
  let sum = 0;
  let w = 0;
  for (let i = a; i <= b; i++) {
    const v = data[i];
    sum += i * v;
    w += v;
  }
  if (w < 8) return 0.5;
  return Math.min(1, Math.max(0, (sum / w - a) / (b - a)));
}

/**
 * Melody thread — one bright ribbon that paints right→left across the sky.
 * Height follows lead pitch (higher notes sit higher). Stays lit through short
 * gaps in the phrase, then fades when the mid line goes quiet.
 */
function updateMelodyThread(now, leadPitch, mid, solo) {
  if (!fxOn("melodyThread")) {
    if (melodyThread.length) melodyThread.length = 0;
    FX.melodyPresence = 0;
    return;
  }

  const energy = Math.max(mid * 1.05, solo * 0.95, FX.sustain * 0.7, FX.chord * 0.45);
  const want = playing && energy > 0.035 ? Math.min(1, energy * 1.35) : 0;
  // Rise fast, fall slow — so the ribbon doesn't blink out between notes
  FX.melodyPresence = smooth(FX.melodyPresence, want, want > FX.melodyPresence ? 0.28 : 0.06);
  const presence = FX.melodyPresence;

  if (presence > 0.04) {
    const targetY = 0.14 + (1 - leadPitch) * 0.36;
    FX.melodyY = smooth(FX.melodyY, targetY, 0.22);
    // Seed immediately so the first notes aren't waiting for a long trail
    const spawnEvery = 28;
    if (!FX.melodyNextAt || now >= FX.melodyNextAt || melodyThread.length < 3) {
      FX.melodyNextAt = now + spawnEvery;
      const wobble = Math.sin(now * 0.002 + presence * 2.5) * 0.01 * presence;
      const count = melodyThread.length < 8 ? 3 : 1;
      for (let i = 0; i < count; i++) {
        melodyThread.push({
          x: 0.78 + i * 0.012 + Math.sin(now * 0.0008) * 0.02,
          y: FX.melodyY + wobble + (Math.random() - 0.5) * 0.004,
          life: 1,
          glow: Math.max(0.25, presence),
        });
      }
    }
  }

  // Steady leftward crawl — trail lasts ~2s across the sky
  const drift = 0.0032 + presence * 0.0015;
  for (let i = melodyThread.length - 1; i >= 0; i--) {
    const p = melodyThread[i];
    p.x -= drift;
    // Soft fade only after it's traveled; keep the tip bright
    const ageFade = p.x < 0.15 ? 0.018 : p.x < 0.4 ? 0.008 : 0.0035;
    p.life -= ageFade;
    if (presence < 0.08) p.life -= 0.01;
    if (p.life <= 0 || p.x < -0.08) melodyThread.splice(i, 1);
  }
  while (melodyThread.length > MELODY_MAX) melodyThread.shift();
}

const INFALL_MAX = 90;

function spawnInfall(strength = 0.5) {
  if (!fxOn("infallSparks") || !fxOn("blackHole")) return;
  if (infalls.length >= INFALL_MAX) return;
  const n = Math.min(5, 1 + Math.floor(strength * 4));
  for (let i = 0; i < n; i++) {
    if (infalls.length >= INFALL_MAX) break;
    infalls.push({
      ang: Math.random() * Math.PI * 2,
      // Multiples of event-horizon radius — spiral in from the disc zone
      rad: 1.55 + Math.random() * 1.35,
      spin: (Math.random() > 0.5 ? 1 : -1) * (0.035 + Math.random() * 0.09 + strength * 0.04),
      fall: 0.01 + Math.random() * 0.018 + strength * 0.012,
      life: 1,
      decay: 0.004 + Math.random() * 0.008,
      r: 0.9 + Math.random() * 1.8 + strength * 0.8,
      hue: Math.random() > 0.55 ? "gold" : Math.random() > 0.45 ? "rose" : "cyan",
    });
  }
}

function spawnSpark(kind = "ember") {
  if (!fxOn("sparks")) return;
  if (sparks.length > sparkCap()) return;

  // Black hole: birth outside the disc, then gravity + orbit pulls them in
  if (fxOn("blackHole")) {
    const strength = kind === "solo" ? 0.9 : kind === "spray" ? 0.6 : 0.45;
    const { x: ax, y: ay } = sunAnchor();
    const holeR =
      sunDiskRadius(0, 0, false) * 0.9 || Math.min(W, H) * 0.1;
    const ang = Math.random() * Math.PI * 2;
    // Start outside the silhouette — close enough that the dive reads quickly
    const dist = holeR * (1.85 + Math.random() * 1.15 + strength * 0.25);
    const px = ax + Math.cos(ang) * dist;
    const py = ay + Math.sin(ang) * dist;
    // Strong tangential kick so they whip in instead of drifting
    const tangSpeed = 3.2 + Math.random() * 3.5 + strength * 2.2;
    const spin = Math.random() > 0.5 ? 1 : -1;
    const tx = -Math.sin(ang) * spin;
    const ty = Math.cos(ang) * spin;
    sparks.push({
      swirl: true,
      spin,
      x: px / W,
      y: py / H,
      lx: px / W,
      ly: py / H,
      trail: [], // recent positions for motion blur
      age: 0,
      vx: (tx * tangSpeed) / W,
      vy: (ty * tangSpeed) / H,
      life: 1,
      decay: 0.008 + Math.random() * 0.012,
      r: kind === "solo" ? 1.5 + Math.random() * 2.6 : 0.9 + Math.random() * 1.7,
      hue:
        kind === "solo"
          ? Math.random() > 0.45
            ? "gold"
            : "rose"
          : Math.random() > 0.5
            ? "cyan"
            : "gold",
    });
    return;
  }

  const cx = 0.5 + (Math.random() - 0.5) * 0.55;
  const fromHorizon = kind === "spray";
  sparks.push({
    x: cx,
    y: fromHorizon ? 0.5 + Math.random() * 0.08 : 0.32 + Math.random() * 0.2,
    vx: (Math.random() - 0.5) * (kind === "solo" ? 0.0045 : 0.0022),
    vy: kind === "solo" ? -0.0025 - Math.random() * 0.0045 : -0.0012 - Math.random() * 0.0025,
    life: 1,
    decay: 0.008 + Math.random() * 0.012,
    r: kind === "solo" ? 1.4 + Math.random() * 2.8 : 0.8 + Math.random() * 1.6,
    hue: kind === "solo" ? (Math.random() > 0.45 ? "gold" : "rose") : Math.random() > 0.5 ? "cyan" : "gold",
  });
}

let streakDir = 0;

function spawnStreak() {
  if (!fxOn("streaks")) return;
  if (streaks.length > 28) return;
  // Round-robin: diagonal-from-right, diagonal-from-left, up
  const mode = streakDir % 3;
  streakDir += 1;
  let angle;
  let x = Math.random();
  let y = Math.random() * 0.55;
  if (mode === 0) {
    // Enter from left, streak diagonally up-right or down-right
    const upish = Math.random() > 0.45;
    angle = upish
      ? -0.35 - Math.random() * 0.55 // up-right
      : 0.25 + Math.random() * 0.45; // down-right
    x = -0.08 - Math.random() * 0.06;
    y = upish ? 0.25 + Math.random() * 0.45 : 0.1 + Math.random() * 0.35;
  } else if (mode === 1) {
    // Enter from right, streak diagonally up-left or down-left
    const upish = Math.random() > 0.45;
    angle = upish
      ? Math.PI + 0.35 + Math.random() * 0.55 // up-left
      : Math.PI - (0.25 + Math.random() * 0.45); // down-left
    x = 1.02 + Math.random() * 0.06;
    y = upish ? 0.25 + Math.random() * 0.45 : 0.1 + Math.random() * 0.35;
  } else {
    angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.5; // up
    y = 0.5 + Math.random() * 0.25;
    x = Math.random();
  }
  streaks.push({
    x,
    y,
    len: 0.05 + Math.random() * 0.12,
    angle,
    speed: 0.007 + Math.random() * 0.014,
    life: 1,
    decay: 0.018 + Math.random() * 0.025,
    hue: Math.random() > 0.5 ? "gold" : "cyan",
  });
}

function spawnShock(strength) {
  if (!fxOn("shockRings")) return;
  if (shocks.length > 6) return;
  shocks.push({
    x: 0.5,
    y: sunYFrac(),
    r: 0.02,
    max: 0.18 + strength * 0.35,
    life: 1,
    decay: 0.018 + (1 - strength) * 0.01,
  });
}

function spawnShootingStar() {
  if (!fxOn("shootingStars")) return;
  if (shooting.length > 5) return;
  const fromLeft = Math.random() > 0.35;
  shooting.push({
    x: fromLeft ? -0.05 - Math.random() * 0.1 : Math.random() * 0.55,
    y: 0.04 + Math.random() * 0.22,
    vx: (fromLeft ? 1 : 0.65) * (0.007 + Math.random() * 0.01),
    vy: 0.0035 + Math.random() * 0.0055,
    len: 0.07 + Math.random() * 0.14,
    life: 1,
    decay: 0.01 + Math.random() * 0.012,
    hue: Math.random() > 0.4 ? "gold" : "cyan",
  });
}

function updateFx(bass, mid, air, now, peak = 0, snare = 0, hat = 0, leadPitch = 0.5) {
  // "Solo" = bright mid/air presence with enough energy to feel like a lead line
  const lead = Math.max(0, mid * 0.55 + air * 1.15 - bass * 0.25);
  const soloTarget = Math.pow(Math.min(1, lead * 1.35), 1.4);
  FX.solo = smooth(FX.solo, soloTarget, 0.12);
  FX.mist = smooth(FX.mist, 0.12 + mid * 0.75 + air * 0.2, 0.1);

  if (fxOn("blackHole") && fxOn("photonPulse")) {
    const hit = Math.max(0, peak * 1.15 + Math.max(0, bass - 0.12) * 0.85 - 0.05);
    FX.photon = smooth(FX.photon, hit, hit > FX.photon ? 0.32 : 0.1);
  } else {
    FX.photon = smooth(FX.photon, 0, 0.14);
  }

  const bassOnset = bass - FX.prevBass;
  const airOnset = air - FX.prevAir;
  const midOnset = mid - (FX.prevMid || 0);
  FX.prevBass = bass;
  FX.prevAir = air;
  FX.prevMid = mid;

  // Slow floors for kick/hat; snare uses a peak-hold floor so rolls keep cracking
  FX.bassSlow = smooth(FX.bassSlow, bass, 0.03);
  FX.peakSlow = smooth(FX.peakSlow, peak, 0.04);
  FX.hatSlow = smooth(FX.hatSlow, hat, 0.04);
  const bassKick = bass - FX.bassSlow;
  const peakKick = peak - FX.peakSlow;
  const hatKick = hat - FX.hatSlow;
  // Peak-hold: rides up with the crack, leaks down so machine-gun snares still onset
  const prevSnareFloor = FX.snareFloor || 0;
  FX.snareFloor =
    snare > prevSnareFloor ? snare : prevSnareFloor * 0.84 + snare * 0.16;
  const snareKick = Math.max(0, snare - prevSnareFloor * 0.62);
  const snareFlux = snare - (FX.prevSnareHot || snare);
  FX.prevSnareHot = snare;
  FX.snareSlow = FX.snareFloor; // keep old name warm for any readers

  // Drum lanes first — piano FX need the veto before they fire
  const shockHit = bassOnset > 0.035 && bass > 0.16;
  const kickFire =
    shockHit || (bassKick > 0.02 && bass > 0.14) || (peakKick > 0.05 && peak > 0.22);
  const snareHot = snare > 0.2 && snare >= bass * 0.7;
  const snareFire =
    (snareKick > 0.01 && snare > 0.07) ||
    (snareFlux > 0.016 && snare > 0.06) ||
    (midOnset > 0.025 && mid > 0.16 && mid > bass * 0.7);
  const hatFire =
    (hatKick > 0.015 && hat > 0.08) || (airOnset > 0.03 && air > 0.16 && air > bass * 0.75);
  if (kickFire || snareFire || hatFire) FX.lastDrumAt = now;
  const drumVeto =
    now - (FX.lastDrumAt || 0) < DRUM_VETO_MS ||
    (bass > 0.26 && bassKick > 0.012) ||
    (snare > 0.14 && snareKick > 0.008);

  // Keys likeness — mid-led, drums quiet, softer attacks
  const midLead = mid / Math.max(0.1, bass * 1.1 + snare * 0.9 + hat * 0.55);
  const softAttack = Math.max(0, 1 - Math.min(1, peakKick * 7 + bassKick * 9 + snareFlux * 6));
  const drumQuiet = Math.max(
    0,
    1 - Math.min(1, bass * 1.15 + snare * 1.35 + hat * 1.05 + (drumVeto ? 0.55 : 0)),
  );
  const keysRaw = Math.min(
    1,
    mid * 0.5 +
      Math.min(1, midLead / 2.4) * 0.42 +
      softAttack * 0.18 +
      drumQuiet * 0.4 +
      Math.max(0, mid - bass) * 0.25 -
      Math.max(0, snare - 0.1) * 0.85 -
      Math.max(0, bass - 0.2) * 0.7 -
      Math.max(0, hat - 0.12) * 0.45,
  );
  FX.keys = smooth(FX.keys, Math.max(0, keysRaw), keysRaw > FX.keys ? 0.14 : 0.07);
  const keysArmed = playing && FX.keys >= KEYS_ARM && !drumVeto;

  // Grid scroll hitch — kick surge + soft mid crawl so piano moves the river too
  const driveTarget =
    0.012 +
    bass * 0.085 +
    Math.max(0, bassOnset) * 0.55 +
    mid * 0.028 +
    FX.sustain * 0.018;
  FX.gridDrive = smooth(FX.gridDrive, driveTarget, 0.22);
  FX.gridScroll = (FX.gridScroll + FX.gridDrive) % 1;

  // Piano / keys path — only when keys-armed (mid-led + no recent drums)
  FX.midSlow = smooth(FX.midSlow, mid, 0.045);
  const noteKick = mid - FX.midSlow;
  const sustainTarget = Math.pow(Math.min(1, mid * 0.9 + air * 0.4), 1.08);
  FX.sustain = smooth(FX.sustain, sustainTarget, 0.07);
  const chordTarget =
    FX.sustain > 0.26 && mid > 0.12
      ? Math.min(1, FX.sustain * 0.75 + mid * 0.45 + air * 0.2 - bass * 0.12)
      : FX.sustain * 0.35;
  FX.chord = smooth(FX.chord, Math.max(0, chordTarget), 0.09);

  const noteFire =
    keysArmed &&
    ((noteKick > 0.018 && mid > 0.1) || (midOnset > 0.022 && mid > 0.12));
  if (noteFire && now - (FX.lastKeyAt || 0) > KEY_GAP_MS) {
    FX.lastKeyAt = now;
    const strength = Math.min(1, noteKick * 9 + midOnset * 7 + mid * 0.5) * FX.keys;
    spawnKeySparks(strength);
    FX.gridScroll = (FX.gridScroll + 0.006 + strength * 0.018) % 1;
    // Forte accents — quiet hammer ripples (not full kick shocks)
    if (
      strength > 0.52 &&
      (noteKick > 0.028 || peak > 0.2) &&
      now - (FX.lastHammerAt || 0) > HAMMER_GAP_MS
    ) {
      FX.lastHammerAt = now;
      spawnHammerRipple(Math.min(1, strength * 0.9 + peak * 0.25));
    }
  }

  const chordRise = FX.chord - (FX.prevChord || 0);
  FX.prevChord = FX.chord;
  const chordFire =
    keysArmed &&
    FX.chord > 0.38 &&
    FX.keys > 0.5 &&
    (chordRise > 0.04 || (FX.sustain > 0.45 && midOnset > 0.01 && mid > 0.17));
  if (chordFire && now - (FX.lastChordAt || 0) > CHORD_GAP_MS) {
    FX.lastChordAt = now;
    const chordStr = Math.min(1, (FX.chord * 0.85 + mid * 0.25) * FX.keys);
    spawnChordHalo(chordStr);
    spawnHarmonyConstellation(chordStr);
  }

  updateMelodyThread(now, leadPitch, mid, FX.solo);

  if (shockHit) {
    FX.gridScroll = (FX.gridScroll + 0.045 + bassOnset * 0.12) % 1;
    spawnShock(Math.min(1, bassOnset * 4 + bass));
    for (let i = 0; i < 4 + Math.floor(bass * 8); i++) spawnSpark("spray");
  }

  // Independent drum lanes — kick/snare/hat each keep their own clock.

  // Bass mountain — ride the same kick lane, plus soft onset / peak nudges
  let mountainBoost = 0;
  if (kickFire) {
    mountainBoost = Math.min(
      1,
      Math.max(0.5, bassOnset * 5.5 + bassKick * 5 + peakKick * 3 + bass * 0.55),
    );
  } else if (bassOnset > 0.01 && bass > 0.07) {
    mountainBoost = Math.min(0.65, bassOnset * 10 + bass * 0.3);
  } else if (peakKick > 0.025 && peak > 0.1) {
    mountainBoost = Math.min(0.45, peakKick * 6 + peak * 0.2);
  } else if (bass > 0.18) {
    // Steady low end still breathes the skyline between hits
    mountainBoost = Math.min(0.28, (bass - 0.12) * 1.4);
  }
  updateBassMountain(bass, mountainBoost, now);

  const spawnDrum = (kind, gapMs) => {
    if (!playing) return;
    const gap =
      gapMs ??
      (kind === "snare" ? DRUM_GAP_SNARE_MS : kind === "hat" ? DRUM_GAP_HAT_MS : DRUM_GAP_KICK_MS);
    const stamp =
      kind === "snare" ? "lastSnareAt" : kind === "hat" ? "lastHatAt" : "lastKickAt";
    if (now - FX[stamp] < gap) return;
    FX[stamp] = now;
    const energy = Math.max(
      gridMusicEnergy(bass, mid, air, snare),
      peak * 0.85,
      snare * 0.95,
      hat * 0.8,
      0.28,
    );
    const flockN =
      kind === "hat"
        ? Math.max(4, Math.floor(4 + energy * 6))
        : Math.max(6, Math.floor(6 + energy * 9));
    const flockOpts = {
      strength: kind === "hat" ? 0.3 + energy * 0.35 : 0.42 + energy * 0.4,
      hue:
        kind === "hat"
          ? Math.random() > 0.5
            ? "cyan"
            : "gold"
          : kind === "snare"
            ? Math.random() > 0.4
              ? "pink"
              : "cyan"
            : Math.random() > 0.4
              ? "gold"
              : Math.random() > 0.5
                ? "pink"
                : "cyan",
    };
    // Skyline: light building windows like Night Drive lights the sea grid
    if (vizMode === "skyline") {
      spawnSkylineWinCells(flockN, flockOpts);
      spawnSkylineParty(kind, flockOpts.strength);
    } else spawnGridCells(flockN, flockOpts);
  };

  if (kickFire) {
    spawnDrum("kick");
    if (
      playing &&
      fxOn("gridHeartbeat") &&
      now - (FX.lastHeartbeatAt || 0) >= DRUM_GAP_KICK_MS
    ) {
      FX.lastHeartbeatAt = now;
      spawnGridHeartbeat(Math.min(1, bassOnset * 5 + bassKick * 4 + bass * 0.55 + peakKick * 2));
    }
  }
  if (snareFire) {
    spawnDrum("snare");
    if (
      playing &&
      fxOn("horizonBloom") &&
      now - (FX.lastBloomAt || 0) >= DRUM_GAP_SNARE_MS
    ) {
      FX.lastBloomAt = now;
      spawnHorizonBloom(
        Math.min(1, snareKick * 6 + snareFlux * 5 + snare * 0.7 + midOnset * 3),
      );
    }
  } else if (snareHot) {
    // Machine-gun / roll: keep flocks dripping when onsets flatten out
    spawnDrum("snare", 55);
  }
  if (hatFire) {
    spawnDrum("hat");
    if (fxOn("infallSparks") && fxOn("blackHole")) {
      spawnInfall(0.35 + hat * 0.65);
    }
    // Hats answer flocks with meteors racing *away* from the sun down the verticals
    if (playing && fxOn("vanishingMeteors")) {
      const burst = 1 + (hat > 0.2 ? 1 : 0) + (Math.random() > 0.55 ? 1 : 0);
      for (let i = 0; i < burst; i++) {
        const side = Math.random() > 0.5 ? 1 : -1;
        const spread = 1 + Math.floor(Math.random() * 8);
        spawnVanishingMeteor({
          col: Math.max(1, Math.min(GRID_COLS - 1, GRID_SUN_COL + side * spread)),
          hueT: (i / Math.max(1, burst - 1)) * 0.55 + Math.random() * 0.2 + now * 0.00008,
        });
      }
    }
  }

  // Mirror sea — after drum spawns so the drop's flocks are in the reflection
  const bigDrop =
    (shockHit && bass > 0.2 && (bassOnset > 0.045 || peakKick > 0.06)) ||
    (peakKick > 0.09 && peak > 0.32 && bass > 0.18) ||
    (bassOnset > 0.07 && bass > 0.28);
  if (
    bigDrop &&
    playing &&
    fxOn("mirrorSea") &&
    gridCells.length > 0 &&
    now - (FX.lastMirrorAt || 0) > MIRROR_GAP_MS
  ) {
    FX.lastMirrorAt = now;
    spawnMirrorSea();
  }

  // Doorway — rare: huge peak parts the center verticals onto deeper starfield
  const hugePeak =
    playing &&
    ((peak > 0.52 && peakKick > 0.11 && bass > 0.22) ||
      (bassOnset > 0.095 && bass > 0.32 && peak > 0.35) ||
      (shockHit && bassOnset > 0.08 && peak > 0.42));
  if (
    hugePeak &&
    fxOn("doorway") &&
    now - (FX.lastDoorwayAt || 0) > DOORWAY_GAP_MS
  ) {
    FX.lastDoorwayAt = now;
  }
  if (fxOn("doorway") && FX.lastDoorwayAt) {
    const age = now - FX.lastDoorwayAt;
    if (age < DOORWAY_OPEN_MS) {
      FX.doorway = age / DOORWAY_OPEN_MS;
    } else if (age < DOORWAY_OPEN_MS + DOORWAY_HOLD_MS) {
      FX.doorway = 1;
    } else if (age < DOORWAY_OPEN_MS + DOORWAY_HOLD_MS + DOORWAY_CLOSE_MS) {
      FX.doorway =
        1 -
        (age - DOORWAY_OPEN_MS - DOORWAY_HOLD_MS) / DOORWAY_CLOSE_MS;
    } else {
      FX.doorway = 0;
    }
  } else {
    FX.doorway = 0;
  }

  if (airOnset > 0.05 && air > 0.22) {
    for (let i = 0; i < 2 + Math.floor(air * 6); i++) spawnSpark("ember");
    if (airOnset > 0.07 && Math.random() < 0.55 + air * 0.35) spawnShootingStar();
    if (fxOn("infallSparks") && fxOn("blackHole")) spawnInfall(0.25 + air * 0.5);
  }

  // Launch a new slow crest every WHIP_SAMPLE_MS (they travel independently).
  const dt = FX.prevNow ? Math.min(64, Math.max(0, now - FX.prevNow)) : 16;
  if (WHIP_VERTICALS && fxOn("whipVerticals")) {
    if (now >= FX.whipNextAt) {
      FX.whipNextAt = now + WHIP_SAMPLE_MS;
      FX.whips.push({
        amp: 10 + mid * 28 + FX.solo * 18 + bass * 10,
        air,
        side: Math.random() > 0.5 ? 1 : -1,
        travel: 0,
        lastBand: -1,
      });
    }
    for (let i = FX.whips.length - 1; i >= 0; i--) {
      const w = FX.whips[i];
      w.travel += dt / WHIP_TRAVEL_MS;
      if (w.travel >= 1) FX.whips.splice(i, 1);
    }
  } else if (FX.whips.length) {
    FX.whips.length = 0;
  }

  // Spawn on kicks; then hop sunward on a steady clock. No music = no squares.
  if (!playing) {
    if (gridCells.length) gridCells.length = 0;
    if (gridTrails.length) gridTrails.length = 0;
    if (meteors.length) meteors.length = 0;
    if (mirrorCells.length) mirrorCells.length = 0;
    if (heartbeats.length) heartbeats.length = 0;
    if (bloomRings.length) bloomRings.length = 0;
    if (skylineWinLits.length) skylineWinLits.length = 0;
    if (skylineParty.length) skylineParty.length = 0;
  } else {
    updateSkylineWinLits(dt);
    updateSkylineParty(dt);
    for (let i = gridCells.length - 1; i >= 0; i--) {
      const cell = gridCells[i];
      if (cell.traveling) {
        cell.stepAcc = (cell.stepAcc || 0) + dt;
        while (cell.traveling && cell.stepAcc >= cell.stepMs) {
          cell.stepAcc -= cell.stepMs;
          stepGridCell(cell);
        }
        cell.life -= cell.decay * (dt / 16);
      } else {
        cell.life -= cell.decay * (dt / 16) * 2.2;
      }
      if (cell.life <= 0) gridCells.splice(i, 1);
    }
    for (let i = gridTrails.length - 1; i >= 0; i--) {
      gridTrails[i].life -= gridTrails[i].decay * (dt / 16);
      if (gridTrails[i].life <= 0) gridTrails.splice(i, 1);
    }
    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i];
      m.depth += m.speed * (dt / 16);
      m.life -= m.decay * (dt / 16);
      if (m.depth > 1.08 || m.life <= 0) meteors.splice(i, 1);
    }
    for (let i = mirrorCells.length - 1; i >= 0; i--) {
      mirrorCells[i].life -= mirrorCells[i].decay * (dt / 16);
      if (mirrorCells[i].life <= 0) mirrorCells.splice(i, 1);
    }
    for (let i = heartbeats.length - 1; i >= 0; i--) {
      const hb = heartbeats[i];
      hb.progress += hb.speed * (dt / 16);
      hb.life -= hb.decay * (dt / 16);
      if (hb.progress > 1.2 || hb.life <= 0) heartbeats.splice(i, 1);
    }
    for (let i = bloomRings.length - 1; i >= 0; i--) {
      const b = bloomRings[i];
      b.stepAcc = (b.stepAcc || 0) + dt;
      const step = 1 / GRID_ROWS;
      while (b.stepAcc >= b.stepMs && b.depth < 0.98) {
        b.stepAcc -= b.stepMs;
        b.depth = Math.min(0.98, b.depth + step);
        b.width = Math.min(1.15, b.width + (b.expand || 0.03));
      }
      b.life -= b.decay * (dt / 16);
      if (b.depth >= 0.97 || b.life <= 0) bloomRings.splice(i, 1);
    }
  }

  FX.prevNow = now;

  // Sustained solo rain
  FX.sparkBudget += FX.solo * 2.8 + air * 0.6 + FX.sustain * 1.2;
  while (FX.sparkBudget >= 1) {
    FX.sparkBudget -= 1;
    spawnSpark(FX.solo > 0.45 ? "solo" : "ember");
    if (FX.solo > 0.55 && Math.random() < FX.solo) spawnStreak();
  }

  if (FX.solo > 0.62 && Math.random() < FX.solo * 0.08) spawnStreak();

  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i];
    if (s.swirl) {
      const { x: ax, y: ay } = sunAnchor();
      const holeR =
        blackHoleOccludeRadius(levels.bass, FX.solo) ||
        sunDiskRadius(levels.bass, FX.solo, fxOn("sunPulse")) * 0.9;
      const px = s.x * W;
      const py = s.y * H;
      const dx = ax - px;
      const dy = ay - py;
      const dist = Math.hypot(dx, dy) || 1;
      // Tidal ramp: mild far out, then sharp acceleration into the horizon (~1/r^3 feel)
      const rNorm = Math.max(0.15, dist / Math.max(holeR, 1));
      const gravity = 0.00035 / (rNorm * rNorm);
      const tidal = 0.0018 / (rNorm * rNorm * rNorm);
      const pull = (gravity + tidal) * (1.05 + FX.solo * 0.45);
      // Orbit fades near the rim so the dive reads as a plunge, not a circle
      const orbit =
        (0.0001 + 0.014 / (dist + 28)) *
        (rNorm > 1.35 ? 1.15 : Math.max(0.12, (rNorm - 0.85) * 1.4));
      const tx = -dy / dist;
      const ty = dx / dist;
      s.vx += (dx / W) * pull + (tx / W) * orbit * (s.spin || 1);
      s.vy += (dy / H) * pull + (ty / H) * orbit * (s.spin || 1);
      // Less drag as they fall in so tidal speed-up sticks
      const drag = rNorm > 1.4 ? 0.988 : rNorm > 1.05 ? 0.994 : 0.998;
      s.vx *= drag;
      s.vy *= drag;
      s.lx = s.x;
      s.ly = s.y;
      s.x += s.vx;
      s.y += s.vy;
      // Motion-blur history — wait before trails so the dive reads first
      s.age = (s.age || 0) + 1;
      if (!s.trail) s.trail = [];
      if (s.age > 28) {
        s.trail.push({ x: s.x, y: s.y });
        const maxTrail = 10 + Math.min(8, Math.floor(Math.hypot(s.vx * W, s.vy * H) * 2.5));
        while (s.trail.length > maxTrail) s.trail.shift();
      }
      s.life -= s.decay;
      if (s.life <= 0 || dist < holeR * 0.92) swapRemove(sparks, i);
      continue;
    }
    s.x += s.vx;
    s.y += s.vy;
    s.vy -= 0.00004;
    s.life -= s.decay;
    if (s.life <= 0 || s.y < -0.05) swapRemove(sparks, i);
  }

  for (let i = infalls.length - 1; i >= 0; i--) {
    const p = infalls[i];
    p.ang += p.spin;
    p.rad -= p.fall;
    p.spin *= 1.012;
    p.life -= p.decay;
    if (p.life <= 0 || p.rad <= 1.02) swapRemove(infalls, i);
  }

  for (let i = streaks.length - 1; i >= 0; i--) {
    const st = streaks[i];
    st.x += Math.cos(st.angle) * st.speed;
    st.y += Math.sin(st.angle) * st.speed;
    st.life -= st.decay;
    if (st.life <= 0) swapRemove(streaks, i);
  }

  for (let i = shocks.length - 1; i >= 0; i--) {
    const sh = shocks[i];
    sh.r += (sh.max - sh.r) * 0.12 + 0.004;
    sh.life -= sh.decay;
    if (sh.life <= 0) swapRemove(shocks, i);
  }

  for (let i = chordHalos.length - 1; i >= 0; i--) {
    const h = chordHalos[i];
    h.r += (h.max - h.r) * 0.07 + 0.002;
    h.life -= h.decay;
    if (h.life <= 0) swapRemove(chordHalos, i);
  }

  for (let i = hammerRipples.length - 1; i >= 0; i--) {
    const h = hammerRipples[i];
    h.r += (h.max - h.r) * 0.14 + 0.003;
    h.life -= h.decay;
    if (h.life <= 0) swapRemove(hammerRipples, i);
  }

  for (let i = harmonyLinks.length - 1; i >= 0; i--) {
    const link = harmonyLinks[i];
    link.life -= link.decay;
    if (link.life <= 0) swapRemove(harmonyLinks, i);
  }

  for (let i = shooting.length - 1; i >= 0; i--) {
    const s = shooting[i];
    s.x += s.vx;
    s.y += s.vy;
    s.life -= s.decay;
    if (s.life <= 0 || s.x > 1.2 || s.y > 0.6) swapRemove(shooting, i);
  }

  for (const d of rain) {
    d.y += d.sp * (0.7 + FX.mist);
    d.x += d.drift * (0.7 + FX.mist);
    if (d.y > 1.05) {
      d.y = -0.05;
      d.x = Math.random();
    }
    if (d.x > 1.05) d.x = -0.05;
  }

  for (const sheet of mistSheets) {
    sheet.x += sheet.drift;
    if (sheet.x < -0.4) sheet.x = 1.2;
    if (sheet.x > 1.2) sheet.x = -0.4;
  }

  if (fxOn("cloudDeck") && cloudDeck.length) {
    const pad = Math.max(0, FX.sustain * 0.9 + FX.chord * 0.55);
    const crawl = 0.35 + pad * 1.4;
    for (const band of cloudDeck) {
      band.offset = (band.offset + band.speed * crawl) % 1;
    }
  }
}

function drawSoloAurora(solo, air) {
  if (solo < 0.2) return;
  const y0 = H * 0.08;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 4; i++) {
    const x = W * (0.2 + i * 0.2);
    const h = H * (0.28 + solo * 0.35);
    const g = ctx.createLinearGradient(x, y0, x, y0 + h);
    const a = (0.04 + solo * 0.14) * (0.7 + air * 0.5);
    g.addColorStop(0, i % 2 ? `rgba(255, 110, 168, ${a})` : `rgba(240, 197, 106, ${a})`);
    g.addColorStop(0.55, `rgba(69, 224, 255, ${a * 0.45})`);
    g.addColorStop(1, "rgba(69, 224, 255, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - W * 0.12, y0 + h);
    ctx.quadraticCurveTo(x, y0, x + W * 0.12, y0 + h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawSparks(bass = 0, solo = 0) {
  if (!sparks.length) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const s of sparks) {
    const a = Math.max(0, s.life);
    const x = s.x * W;
    const y = s.y * H;
    const rgb =
      s.hue === "gold"
        ? "255, 210, 120"
        : s.hue === "rose"
          ? "255, 120, 180"
          : "120, 230, 255";

    // Motion blur: fade ribbon along the recent path into the hole
    if (s.swirl && s.trail && s.trail.length > 1) {
      const pts = s.trail;
      const n = pts.length;
      for (let i = 1; i < n; i++) {
        const t0 = (i - 1) / (n - 1);
        const t1 = i / (n - 1);
        const x0 = pts[i - 1].x * W;
        const y0 = pts[i - 1].y * H;
        const x1 = pts[i].x * W;
        const y1 = pts[i].y * H;
        const segA = a * (0.12 + t1 * 0.75);
        ctx.strokeStyle = `rgba(${rgb}, ${segA})`;
        ctx.lineWidth = Math.max(0.6, s.r * (0.35 + t1 * 0.85));
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
    } else if (s.swirl && s.lx != null) {
      const lx = s.lx * W;
      const ly = s.ly * H;
      ctx.strokeStyle = `rgba(${rgb}, ${a * 0.45})`;
      ctx.lineWidth = Math.max(0.8, s.r * 0.55);
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(x, y);
      ctx.stroke();
    }

    ctx.fillStyle = `rgba(${rgb}, ${a})`;
    ctx.beginPath();
    ctx.arc(x, y, s.r * (0.6 + a), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawInfallSparks(bass = 0, solo = 0) {
  if (!fxOn("infallSparks") || !fxOn("blackHole") || !infalls.length) return;
  const { x, y } = sunAnchor();
  const R = blackHoleOccludeRadius(bass, solo) || sunDiskRadius(bass, solo, fxOn("sunPulse")) * 0.9;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const p of infalls) {
    const a = Math.max(0, p.life);
    const px = x + Math.cos(p.ang) * p.rad * R;
    const py = y + Math.sin(p.ang) * p.rad * R;
    const rgb =
      p.hue === "gold"
        ? "255, 210, 120"
        : p.hue === "rose"
          ? "255, 130, 170"
          : "120, 230, 255";
    const tx = -Math.sin(p.ang) * p.spin * R * 8;
    const ty = Math.cos(p.ang) * p.spin * R * 8;
    ctx.strokeStyle = `rgba(${rgb}, ${a * 0.35})`;
    ctx.lineWidth = Math.max(0.6, p.r * 0.45);
    ctx.beginPath();
    ctx.moveTo(px - tx, py - ty);
    ctx.lineTo(px, py);
    ctx.stroke();
    ctx.fillStyle = `rgba(${rgb}, ${a})`;
    ctx.beginPath();
    ctx.arc(px, py, p.r * (0.55 + a * 0.55), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawStreaks() {
  if (!streaks.length) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  for (const st of streaks) {
    const x = st.x * W;
    const y = st.y * H;
    const len = st.len * Math.min(W, H);
    const x2 = x + Math.cos(st.angle) * len;
    const y2 = y + Math.sin(st.angle) * len;
    const a = Math.max(0, st.life);
    ctx.strokeStyle =
      st.hue === "gold" ? `rgba(255, 214, 130, ${a * 0.85})` : `rgba(120, 230, 255, ${a * 0.8})`;
    ctx.lineWidth = 1.2 + a * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawShocks() {
  if (!shocks.length) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const sh of shocks) {
    const x = sh.x * W;
    const y = sh.y * H;
    const r = sh.r * Math.min(W, H);
    const a = Math.max(0, sh.life) * 0.55;
    ctx.strokeStyle = `rgba(240, 197, 106, ${a})`;
    ctx.lineWidth = 1.5 + sh.life * 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255, 110, 168, ${a * 0.55})`;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.12, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawChordHalos() {
  if (!fxOn("chordHalos") || !chordHalos.length) return;
  const { x, y } = sunAnchor();
  const scale = Math.min(W, H) * SUN_SCALE;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const h of chordHalos) {
    const a = Math.max(0, h.life) * (0.28 + h.strength * 0.5);
    if (a < 0.03) continue;
    const r = h.r * scale;
    ctx.strokeStyle = synthRainbow(h.hueT, a);
    ctx.lineWidth = 1.4 + h.life * 2.2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = synthRainbow(h.hueT + 0.18, a * 0.55);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.2, r * 0.52, -0.14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = synthRainbow(h.hueT + 0.3, a * 0.3);
    ctx.beginPath();
    ctx.arc(x, y, r * 1.35, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMelodyThread() {
  if (!fxOn("melodyThread") || melodyThread.length < 2) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // Soft underglow — whole path
  ctx.beginPath();
  for (let i = 0; i < melodyThread.length; i++) {
    const p = melodyThread[i];
    const x = p.x * W;
    const y = p.y * H;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  const under = 0.1 + FX.melodyPresence * 0.12;
  ctx.strokeStyle = `rgba(255, 220, 170, ${under})`;
  ctx.lineWidth = 7;
  ctx.stroke();
  // Bright core segments
  for (let i = 1; i < melodyThread.length; i++) {
    const a = melodyThread[i - 1];
    const b = melodyThread[i];
    const life = Math.min(a.life, b.life);
    const glow = ((a.glow || 0.3) + (b.glow || 0.3)) * 0.5;
    const alpha = life * (0.4 + glow * 0.6) * (0.55 + FX.melodyPresence * 0.45);
    if (alpha < 0.035) continue;
    const grad = ctx.createLinearGradient(a.x * W, a.y * H, b.x * W, b.y * H);
    grad.addColorStop(0, synthRainbow(0.15 + glow * 0.2, alpha * 0.55));
    grad.addColorStop(0.5, `rgba(255, 245, 220, ${alpha})`);
    grad.addColorStop(1, synthRainbow(0.55 + glow * 0.15, alpha * 0.6));
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.4 + glow * 3 + life * 1.6;
    ctx.beginPath();
    ctx.moveTo(a.x * W, a.y * H);
    ctx.lineTo(b.x * W, b.y * H);
    ctx.stroke();
  }
  // Leading tip — always readable when the thread is alive
  const tip = melodyThread[melodyThread.length - 1];
  if (tip && tip.life > 0.15 && FX.melodyPresence > 0.05) {
    const tx = tip.x * W;
    const ty = tip.y * H;
    const tipA = Math.min(1, tip.life * 0.95 + FX.melodyPresence * 0.35);
    ctx.fillStyle = `rgba(255, 250, 230, ${tipA})`;
    ctx.beginPath();
    ctx.arc(tx, ty, 2.6 + (tip.glow || 0) * 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 180, 120, ${tipA * 0.55})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(tx, ty, 5 + FX.melodyPresence * 4, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHammerRipples() {
  if (!fxOn("hammerRipples") || !hammerRipples.length) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const h of hammerRipples) {
    const x = h.x * W;
    const y = h.y * H;
    const r = h.r * Math.min(W, H);
    const a = Math.max(0, h.life) * (0.35 + h.strength * 0.35);
    if (a < 0.03) continue;
    ctx.strokeStyle = `rgba(255, 230, 180, ${a})`;
    ctx.lineWidth = 1.1 + h.life * 1.4;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255, 160, 120, ${a * 0.45})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.18, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHarmonyConstellation(bass = 0, solo = 0) {
  if (!fxOn("harmonyConstellation") || !harmonyLinks.length) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  for (const link of harmonyLinks) {
    const a = Math.max(0, link.life);
    if (a < 0.04) continue;
    const x0 = link.ax * W;
    const y0 = link.ay * H;
    const x1 = link.bx * W;
    const y1 = link.by * H;
    if (behindBlackHole(x0, y0, bass, solo) && behindBlackHole(x1, y1, bass, solo)) {
      continue;
    }
    const grad = ctx.createLinearGradient(x0, y0, x1, y1);
    grad.addColorStop(0, synthRainbow(link.hueT, a * 0.25));
    grad.addColorStop(0.5, synthRainbow(link.hueT + 0.12, a * 0.85));
    grad.addColorStop(1, synthRainbow(link.hueT + 0.22, a * 0.25));
    ctx.strokeStyle = grad;
    ctx.lineWidth = 0.8 + a * 1.6;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.fillStyle = synthRainbow(link.hueT + 0.18, a * 0.7);
    if (!behindBlackHole(x0, y0, bass, solo)) {
      ctx.beginPath();
      ctx.arc(x0, y0, 1.2 + a, 0, Math.PI * 2);
      ctx.fill();
    }
    if (!behindBlackHole(x1, y1, bass, solo)) {
      ctx.beginPath();
      ctx.arc(x1, y1, 1.2 + a, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawSky(now, bass, mid) {
  const light = fxOn("skyLighting");
  const b = light ? bass : 0;
  const m = light ? mid : 0;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#04070f");
  g.addColorStop(0.45, `rgb(${8 + b * 18}, ${14 + m * 20}, ${28 + b * 30})`);
  g.addColorStop(0.72, "#0a1c2e");
  g.addColorStop(1, "#061018");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  if (!light) return;
  const cx = W * 0.5;
  for (let i = -2; i <= 2; i++) {
    const x = cx + i * W * 0.12;
    const shaft = ctx.createLinearGradient(x, 0, x, H * 0.7);
    shaft.addColorStop(0, `rgba(69, 224, 255, ${0.015 + bass * 0.04})`);
    shaft.addColorStop(1, "rgba(69, 224, 255, 0)");
    ctx.fillStyle = shaft;
    ctx.fillRect(x - W * 0.08, 0, W * 0.16, H * 0.7);
  }
}

function drawStars(now, air, mid, solo, bass = 0) {
  if (!fxOn("starfield") || !stars.length) return;
  const bloom = 0.2 + air * 1.1 + solo * 0.45 + mid * 0.15;
  const lens = fxOn("lensingShimmer") && fxOn("blackHole");
  const anchor = lens ? sunAnchor() : null;
  const holeR = lens ? blackHoleOccludeRadius(bass, solo) : 0;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const s of stars) {
    const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(now * 0.0018 * s.sp + s.tw));
    const a = Math.min(1, s.bright * bloom * tw);
    if (a < 0.08) continue;
    let x = s.x * W;
    let y = s.y * H;
    if (behindBlackHole(x, y, bass, solo)) continue;
    const r = s.r * (0.7 + air * 0.9 + solo * 0.4);

    let streak = 0;
    if (lens && holeR > 0) {
      const dx = x - anchor.x;
      const dy = y - anchor.y;
      const d = Math.hypot(dx, dy) || 1;
      const outer = holeR * 2.35;
      if (d > holeR && d < outer) {
        const u = 1 - (d - holeR) / (outer - holeR); // 1 at rim
        const bend = u * u * holeR * 0.28;
        const tx = -dy / d;
        const ty = dx / d;
        const wobble = Math.sin(now * 0.0022 + s.tw * 3);
        x += tx * bend * wobble;
        y += ty * bend * wobble;
        streak = u * (3.5 + r * 2.5);
      }
    }

    ctx.fillStyle = `rgba(220, 240, 255, ${a * 0.9})`;
    if (streak > 1.2) {
      const dx = x - anchor.x;
      const dy = y - anchor.y;
      const d = Math.hypot(dx, dy) || 1;
      const tx = (-dy / d) * streak;
      const ty = (dx / d) * streak;
      ctx.strokeStyle = `rgba(220, 240, 255, ${a * 0.55})`;
      ctx.lineWidth = Math.max(0.7, r * 0.7);
      ctx.beginPath();
      ctx.moveTo(x - tx, y - ty);
      ctx.lineTo(x + tx, y + ty);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, Math.max(0.8, r * 0.7), 0, Math.PI * 2);
      ctx.fill();
    } else if (!s.flare || a <= 0.45 || r < 1.35) {
      const s2 = Math.max(1, r * 1.6);
      ctx.fillRect(x - s2 * 0.5, y - s2 * 0.5, s2, s2);
    } else {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      const fl = 4 + a * 10 + solo * 8;
      ctx.strokeStyle = `rgba(240, 197, 106, ${a * 0.4})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(x - fl, y);
      ctx.lineTo(x + fl, y);
      ctx.moveTo(x, y - fl);
      ctx.lineTo(x, y + fl);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawShootingStars(bass = 0, solo = 0) {
  if (!shooting.length) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  for (const s of shooting) {
    const a = Math.max(0, s.life);
    const x = s.x * W;
    const y = s.y * H;
    if (behindBlackHole(x, y, bass, solo)) continue;
    const len = s.len * Math.min(W, H);
    const ang = Math.atan2(s.vy, s.vx);
    const x2 = x - Math.cos(ang) * len;
    const y2 = y - Math.sin(ang) * len;
    if (behindBlackHole(x2, y2, bass, solo)) continue;
    const grad = ctx.createLinearGradient(x2, y2, x, y);
    if (s.hue === "gold") {
      grad.addColorStop(0, "rgba(240, 197, 106, 0)");
      grad.addColorStop(0.55, `rgba(255, 220, 150, ${a * 0.45})`);
      grad.addColorStop(1, `rgba(255, 245, 220, ${a})`);
    } else {
      grad.addColorStop(0, "rgba(69, 224, 255, 0)");
      grad.addColorStop(0.55, `rgba(120, 230, 255, ${a * 0.45})`);
      grad.addColorStop(1, `rgba(220, 250, 255, ${a})`);
    }
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.2 + a * 2.2;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.fillStyle = s.hue === "gold" ? `rgba(255, 245, 220, ${a})` : `rgba(230, 250, 255, ${a})`;
    ctx.beginPath();
    ctx.arc(x, y, 1.4 + a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawHorizonRibbons(now, bass, mid, solo) {
  if (!horizonBands.length) return;
  const horizon = H * 0.52;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  for (const b of horizonBands) {
    const yBase = Math.min(horizon - 8, H * b.y);
    const amp = b.amp * (0.55 + mid * 1.4 + solo * 0.8 + bass * 0.35);
    const alpha = 0.12 + mid * 0.4 + solo * 0.25;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 8) {
      const n =
        Math.sin(x * 0.0035 + now * 0.0009 * b.speed + b.phase) * amp +
        Math.sin(x * 0.009 + now * 0.0014 + b.phase) * amp * 0.35;
      const y = yBase + n;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle =
      b.hue === "rose"
        ? `rgba(255, 110, 168, ${alpha * 0.9})`
        : b.hue === "gold"
          ? `rgba(240, 197, 106, ${alpha * 0.85})`
          : `rgba(69, 224, 255, ${alpha})`;
    ctx.lineWidth = b.width + mid * 1.8 + solo * 1.5;
    ctx.stroke();
  }
  ctx.restore();
}

function drawMistSheets(now, mid) {
  if (!mistSheets.length) return;
  const density = FX.mist;
  if (density < 0.08) return;
  ctx.save();
  for (const sheet of mistSheets) {
    ctx.save();
    const cx = sheet.x * W;
    const cy = sheet.y * H + Math.sin(now * 0.0005 + sheet.phase) * 12;
    const tw = sheet.w * W;
    const th = sheet.h * H * (0.85 + mid * 0.4);
    ctx.translate(cx, cy);
    ctx.rotate(sheet.angle);
    const g = ctx.createLinearGradient(-tw * 0.5, 0, tw * 0.5, 0);
    const a = (0.035 + density * 0.09) * (0.7 + mid * 0.5);
    if (sheet.hue === "rose") {
      g.addColorStop(0, "rgba(255, 110, 168, 0)");
      g.addColorStop(0.5, `rgba(255, 140, 190, ${a})`);
      g.addColorStop(1, "rgba(255, 110, 168, 0)");
    } else {
      g.addColorStop(0, "rgba(69, 224, 255, 0)");
      g.addColorStop(0.5, `rgba(160, 230, 255, ${a})`);
      g.addColorStop(1, "rgba(69, 224, 255, 0)");
    }
    ctx.fillStyle = g;
    ctx.fillRect(-tw * 0.5, -th * 0.5, tw, th);
    ctx.restore();
  }
  ctx.restore();
}

/**
 * Slow parallax cloud bands above the horizon — soft synth haze that blooms on pads.
 */
function drawCloudDeck(now) {
  if (!fxOn("cloudDeck") || !cloudDeck.length) return;
  const pad = Math.max(0, FX.sustain * 0.95 + FX.chord * 0.6 - 0.1);
  if (pad < 0.04) return;

  const horizon = H * 0.52;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, horizon - 2);
  ctx.clip();
  ctx.globalCompositeOperation = "lighter";

  for (const band of cloudDeck) {
    const bob = Math.sin(now * 0.00022 + band.phase) * (4 + band.depth * 5);
    const y = band.y * H + bob;
    const bandH = band.h * H * (0.9 + pad * 0.45);
    const layerA = (0.035 + pad * 0.12) * (0.55 + band.depth * 0.55);
    if (layerA < 0.02) continue;

    for (const puff of band.puffs) {
      const u = (puff.u + band.offset) % 1;
      // wrap copies so the band never gaps
      for (const wrap of [-1, 0, 1]) {
        const cx = (u + wrap) * W;
        if (cx < -W * 0.25 || cx > W * 1.25) continue;
        const cy = y + puff.lift * bandH;
        const rw = puff.w * W * (0.85 + pad * 0.2);
        const rh = bandH * puff.h;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rw, rh));
        if (band.hue === "rose") {
          g.addColorStop(0, `rgba(255, 150, 200, ${layerA * 0.85})`);
          g.addColorStop(0.45, `rgba(255, 110, 168, ${layerA * 0.35})`);
          g.addColorStop(1, "rgba(255, 110, 168, 0)");
        } else if (band.hue === "violet") {
          g.addColorStop(0, `rgba(190, 160, 255, ${layerA * 0.8})`);
          g.addColorStop(0.45, `rgba(120, 100, 220, ${layerA * 0.32})`);
          g.addColorStop(1, "rgba(120, 100, 220, 0)");
        } else {
          g.addColorStop(0, `rgba(180, 235, 255, ${layerA * 0.8})`);
          g.addColorStop(0.45, `rgba(69, 224, 255, ${layerA * 0.32})`);
          g.addColorStop(1, "rgba(69, 224, 255, 0)");
        }
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rw, rh, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

function drawRain(mid) {
  if (!rain.length) return;
  const density = FX.mist;
  if (density < 0.1) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  const visible = 0.25 + density * 0.9;
  for (const d of rain) {
    const a = d.a * visible;
    if (a < 0.04) continue;
    const x = d.x * W;
    const y = d.y * H;
    const len = d.len * H;
    ctx.strokeStyle = `rgba(180, 220, 255, ${a})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len * 0.35, y + len);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Soft geometric wedges rotating around the sun on sustained mid/solo —
 * a slow iris that opens with lead energy.
 */
function drawSunPetals(now, mid, solo) {
  if (!fxOn("sunPetals")) return;
  const energy = Math.max(0, solo * 0.9 + mid * 0.28 - 0.14);
  if (energy < 0.06) return;

  const { x, y } = sunAnchor();
  const scale = Math.min(W, H) * SUN_SCALE;
  const rInner = scale * (0.07 + energy * 0.02);
  const rOuter = scale * (0.16 + energy * 0.2);
  const petals = 8;
  const open = 0.32 + energy * 0.48;
  const rot = now * 0.00012 * (0.35 + energy) + solo * 0.55;
  const alpha = Math.min(0.55, 0.1 + energy * 0.45);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.translate(x, y);
  ctx.rotate(rot);

  for (let i = 0; i < petals; i++) {
    const slot = (Math.PI * 2) / petals;
    const a0 = i * slot + slot * (1 - open) * 0.5;
    const a1 = a0 + slot * open;
    const hueT = i / petals + solo * 0.08 + now * 0.00002;

    ctx.beginPath();
    ctx.moveTo(Math.cos(a0) * rInner, Math.sin(a0) * rInner);
    ctx.arc(0, 0, rOuter, a0, a1, false);
    ctx.lineTo(Math.cos(a1) * rInner, Math.sin(a1) * rInner);
    ctx.arc(0, 0, rInner, a1, a0, true);
    ctx.closePath();

    const grad = ctx.createRadialGradient(0, 0, rInner * 0.4, 0, 0, rOuter);
    grad.addColorStop(0, synthRainbow(hueT, alpha * 0.35));
    grad.addColorStop(0.45, synthRainbow(hueT + 0.12, alpha * 0.7));
    grad.addColorStop(0.82, synthRainbow(hueT + 0.22, alpha * 0.35));
    grad.addColorStop(1, synthRainbow(hueT + 0.3, 0));
    ctx.fillStyle = grad;
    ctx.fill();

    // Soft geometric edge
    ctx.strokeStyle = synthRainbow(hueT + 0.18, alpha * 0.45);
    ctx.lineWidth = 1 + energy * 1.2;
    ctx.stroke();
  }

  // Inner iris ring — breathes with solo
  ctx.beginPath();
  ctx.arc(0, 0, rInner * (0.92 + energy * 0.08), 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(255, 220, 180, ${0.08 + energy * 0.2})`;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, rOuter * 0.98, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(69, 224, 255, ${0.04 + energy * 0.12})`;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.restore();
}

/**
 * Quasar jets — twin beams from the poles, along the accretion-disk normal.
 * Soft plumes on a straight polar axis: feathered width, tip bloom, gap through the hole.
 */
function drawQuasarJets(now, bass, mid, solo) {
  if (!fxOn("quasarJets") || !fxOn("blackHole")) return;
  const lead = Math.max(
    0,
    solo * 0.85 + mid * 0.28 + Math.max(0, bass - 0.22) * 0.25 - 0.04,
  );
  FX.jet = smooth(FX.jet, lead, lead > FX.jet ? 0.18 : 0.08);
  const energy = FX.jet;

  const { x, y } = sunAnchor();
  const pulse = fxOn("sunPulse");
  const r = sunDiskRadius(bass, solo, pulse);
  const poleR = r * 0.95;
  const scale = Math.min(W, H) * SUN_SCALE;
  const len = scale * (0.08 + energy * 1.05 + bass * 0.22);
  const baseW = scale * (0.01 + bass * 0.03 + energy * 0.022);
  const alpha = Math.min(0.72, 0.12 + energy * 0.48 + bass * 0.12);
  const t = now * 0.0011;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.translate(x, y);
  ctx.rotate(BH_DISK_TILT);

  const steps = 14;
  for (const dir of [-1, 1]) {
    // Slight width/phase asymmetry so poles don't look stamped
    const phase = dir > 0 ? 0.35 : 1.1;
    const widthBias = dir > 0 ? 1.0 : 0.92;

    const spine = [];
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const along = poleR + len * u;
      // Straight polar axis — softness lives in width + glow, not bend
      spine.push({
        x: 0,
        y: dir * along,
        // Width blooms then tapers — plume, not a ruler triangle
        w:
          baseW *
          widthBias *
          (0.55 + Math.sin(u * Math.PI) * 0.85 + u * 0.25) *
          (1.05 - u * 0.35) *
          (1 + Math.sin(t * 1.6 + phase + u * 1.2) * 0.06),
      });
    }

    // Feathered passes: wide soft sheath → mid glow → thin core
    const passes = [
      { widen: 2.4, a: alpha * 0.22, c0: [69, 224, 255], c1: [130, 70, 200] },
      { widen: 1.35, a: alpha * 0.45, c0: [255, 110, 168], c1: [69, 224, 255] },
      { widen: 0.55, a: alpha * 0.7, c0: [255, 245, 230], c1: [200, 245, 255] },
    ];

    for (const pass of passes) {
      ctx.beginPath();
      for (let i = 0; i < spine.length; i++) {
        const p = spine[i];
        const px = p.x + p.w * pass.widen;
        if (i === 0) ctx.moveTo(px, p.y);
        else ctx.lineTo(px, p.y);
      }
      for (let i = spine.length - 1; i >= 0; i--) {
        const p = spine[i];
        ctx.lineTo(p.x - p.w * pass.widen, p.y);
      }
      ctx.closePath();
      const yA = spine[0].y;
      const yB = spine[spine.length - 1].y;
      const g = ctx.createLinearGradient(0, yA, 0, yB);
      g.addColorStop(0, `rgba(${pass.c0[0]}, ${pass.c0[1]}, ${pass.c0[2]}, ${pass.a})`);
      g.addColorStop(0.45, `rgba(${pass.c1[0]}, ${pass.c1[1]}, ${pass.c1[2]}, ${pass.a * 0.65})`);
      g.addColorStop(1, `rgba(${pass.c1[0]}, ${pass.c1[1]}, ${pass.c1[2]}, 0)`);
      ctx.fillStyle = g;
      ctx.fill();
    }

    // Soft tip bloom
    const tip = spine[spine.length - 1];
    const tipR = baseW * (1.2 + energy * 0.8);
    const tipG = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, tipR);
    tipG.addColorStop(0, `rgba(255, 240, 220, ${alpha * 0.35})`);
    tipG.addColorStop(0.5, `rgba(69, 224, 255, ${alpha * 0.18})`);
    tipG.addColorStop(1, "rgba(69, 224, 255, 0)");
    ctx.fillStyle = tipG;
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, tipR, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Anamorphic sun lens flares — streaks stay axis-aligned (no bank/tilt),
 * while the flare center still rides with the sun under the world transform.
 */
function drawSunFlares(now, peak, solo, bass) {
  if (!fxOn("sunFlares") || fxOn("blackHole")) return;
  const hit = Math.max(
    0,
    peak * 1.15 + solo * 0.9 + Math.max(0, bass - 0.4) * 0.4 - 0.2,
  );
  FX.flare = smooth(FX.flare, hit, hit > FX.flare ? 0.25 : 0.09);
  const energy = FX.flare;
  if (energy < 0.05) return;

  const { x, y } = sunAnchor();
  const scale = Math.min(W, H) * SUN_SCALE;
  const half = W * (0.28 + energy * 0.5);
  const coreH = Math.max(1.2, scale * (0.0025 + energy * 0.006));
  const alpha = Math.min(0.72, 0.12 + energy * 0.55);
  const shimmer = 0.85 + 0.15 * Math.sin(now * 0.006 + solo * 2);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  // Follow the sun, then cancel world bank so H/V stay grid-aligned on screen
  ctx.translate(x, y);
  ctx.rotate(-(CAM.rot + CAM.bank));

  // Soft circular bloom
  const bloomR = scale * (0.14 + energy * 0.42);
  const bloom = ctx.createRadialGradient(0, 0, 0, 0, 0, bloomR);
  bloom.addColorStop(0, `rgba(255, 240, 220, ${alpha * 0.7 * shimmer})`);
  bloom.addColorStop(0.35, `rgba(255, 180, 140, ${alpha * 0.4 * shimmer})`);
  bloom.addColorStop(0.65, `rgba(69, 224, 255, ${alpha * 0.28 * shimmer})`);
  bloom.addColorStop(1, "rgba(69, 224, 255, 0)");
  ctx.fillStyle = bloom;
  ctx.beginPath();
  ctx.arc(0, 0, bloomR, 0, Math.PI * 2);
  ctx.fill();

  // Bright thin core streak — always screen-horizontal
  const core = ctx.createLinearGradient(-half * 0.95, 0, half * 0.95, 0);
  core.addColorStop(0, "rgba(255, 255, 255, 0)");
  core.addColorStop(0.45, `rgba(255, 230, 200, ${alpha * 0.55})`);
  core.addColorStop(0.5, `rgba(255, 255, 255, ${Math.min(1, alpha * 1.1)})`);
  core.addColorStop(0.55, `rgba(200, 240, 255, ${alpha * 0.55})`);
  core.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = core;
  ctx.fillRect(-half * 0.95, -coreH * 0.5, half * 1.9, coreH);

  // Subtle vertical cross — always screen-vertical
  const vHalf = scale * (0.1 + energy * 0.22);
  const vCore = ctx.createLinearGradient(0, -vHalf, 0, vHalf);
  vCore.addColorStop(0, "rgba(255, 255, 255, 0)");
  vCore.addColorStop(0.5, `rgba(255, 220, 190, ${alpha * 0.28})`);
  vCore.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = vCore;
  ctx.fillRect(-coreH * 0.35, -vHalf, coreH * 0.7, vHalf * 2);

  // Ghost orbs along the horizontal streak
  const ghosts = [
    { t: -0.62, r: 0.035, c: [255, 110, 168] },
    { t: -0.28, r: 0.022, c: [240, 197, 106] },
    { t: 0.32, r: 0.028, c: [69, 224, 255] },
    { t: 0.58, r: 0.018, c: [255, 180, 140] },
  ];
  for (const g of ghosts) {
    const gx = half * g.t;
    const gy = Math.sin(now * 0.0015 + g.t * 4) * (1.5 + energy * 2);
    const gr = scale * g.r * (0.75 + energy * 0.6);
    const ga = alpha * (0.22 + energy * 0.35);
    const rad = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
    rad.addColorStop(0, `rgba(${g.c[0]}, ${g.c[1]}, ${g.c[2]}, ${ga})`);
    rad.addColorStop(0.55, `rgba(${g.c[0]}, ${g.c[1]}, ${g.c[2]}, ${ga * 0.35})`);
    rad.addColorStop(1, `rgba(${g.c[0]}, ${g.c[1]}, ${g.c[2]}, 0)`);
    ctx.fillStyle = rad;
    ctx.beginPath();
    ctx.arc(gx, gy, gr, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawSoftSun(bass, mid, solo = 0) {
  const { x, y } = sunAnchor();
  const pulse = fxOn("sunPulse");
  const halo = fxOn("sunHalo");
  const r = sunDiskRadius(bass, solo, pulse);
  const b = pulse || halo ? bass : 0;
  const m = pulse || halo ? mid : 0;
  const so = pulse || halo ? solo : 0;

  if (fxOn("blackHole")) {
    // Disk stays alive even if sunPulse/halo are off
    const bb = Math.max(b, bass * 0.85);
    const mm = Math.max(m, mid * 0.85);
    const ss = Math.max(so, solo * 0.85);
    const tilt = BH_DISK_TILT;
    const rx = r * 1.72;
    const ry = r * 0.34;
    const voidR = r * 0.9;
    const band = r * (0.16 + bb * 0.06);

    // Soft gravitational haze (stronger with sunHalo)
    const hazeA = halo ? 1 : 0.55;
    const haze = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 3.2);
    haze.addColorStop(0, `rgba(255, 140, 90, ${(0.08 + bb * 0.12 + ss * 0.1) * hazeA})`);
    haze.addColorStop(0.35, `rgba(255, 80, 140, ${(0.1 + mm * 0.12) * hazeA})`);
    haze.addColorStop(0.65, `rgba(69, 224, 255, ${(0.06 + bb * 0.08) * hazeA})`);
    haze.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = haze;
    ctx.beginPath();
    ctx.arc(x, y, r * 3.2, 0, Math.PI * 2);
    ctx.fill();

    // Local-space gradient (call only after translate to the sun)
    const diskGrad = (boost) => {
      // Doppler: hot approaching limb → cooler receding
      const g = ctx.createLinearGradient(-rx, 0, rx, 0);
      g.addColorStop(0, `rgba(255, 235, 190, ${(0.4 + ss * 0.35) * boost})`);
      g.addColorStop(0.35, `rgba(255, 140, 90, ${(0.48 + mm * 0.25) * boost})`);
      g.addColorStop(0.55, `rgba(255, 90, 140, ${(0.42 + bb * 0.2) * boost})`);
      g.addColorStop(1, `rgba(90, 180, 255, ${(0.3 + bb * 0.2) * boost})`);
      return g;
    };

    // 1) Full accretion ring behind the silhouette
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "butt";
    ctx.strokeStyle = diskGrad(0.35);
    ctx.lineWidth = band * 1.45;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = diskGrad(0.85);
    ctx.lineWidth = band;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // 2) Event horizon
    const voidGrad = ctx.createRadialGradient(x, y, 0, x, y, voidR);
    voidGrad.addColorStop(0, "#000000");
    voidGrad.addColorStop(0.72, "#000000");
    voidGrad.addColorStop(1, "#000000");
    ctx.fillStyle = voidGrad;
    ctx.beginPath();
    ctx.arc(x, y, voidR, 0, Math.PI * 2);
    ctx.fill();

    // 3) Photon ring (quieter base; Photon pulse breathes with kick/peak)
    const pulse = fxOn("photonPulse") ? FX.photon : 0;
    ctx.save();
    ctx.translate(x, y);
    ctx.globalCompositeOperation = "lighter";
    const ringGlow = 0.4 + ss * 0.25 + pulse * 0.55;
    ctx.strokeStyle = `rgba(255, 230, 200, ${Math.min(0.95, ringGlow)})`;
    ctx.lineWidth = Math.max(1.5, r * (0.035 + pulse * 0.05));
    ctx.beginPath();
    ctx.arc(0, 0, voidR * (1.03 + pulse * 0.02), 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255, 140, 100, ${0.28 + mm * 0.2 + pulse * 0.4})`;
    ctx.lineWidth = Math.max(2, r * (0.06 + pulse * 0.08));
    ctx.beginPath();
    ctx.arc(0, 0, voidR * (1.08 + pulse * 0.025), 0, Math.PI * 2);
    ctx.stroke();
    if (pulse > 0.35) {
      ctx.strokeStyle = `rgba(255, 255, 255, ${(pulse - 0.35) * 0.9})`;
      ctx.lineWidth = Math.max(1, r * 0.02);
      ctx.beginPath();
      ctx.arc(0, 0, voidR * 1.01, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // 4) Front of disk — near side + far side wrapping over the silhouette
    // (same ellipse only; no extra crescent arcs)
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "butt";

    // Near side (bottom) in front of the void
    ctx.strokeStyle = diskGrad(1.0);
    ctx.lineWidth = band;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI, false);
    ctx.stroke();

    // Far side over the top — same ring geometry, slightly softer so it reads continuous
    ctx.strokeStyle = diskGrad(0.9);
    ctx.lineWidth = band * 0.95;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, Math.PI, 0, true);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (halo) {
    const bloom = ctx.createRadialGradient(x, y, r * 0.15, x, y, r * 3.2);
    bloom.addColorStop(0, `rgba(255, 180, 120, ${0.35 + b * 0.35 + so * 0.25})`);
    bloom.addColorStop(0.35, `rgba(255, 110, 168, ${0.18 + m * 0.2 + so * 0.15})`);
    bloom.addColorStop(0.7, `rgba(69, 224, 255, ${0.08 + b * 0.1})`);
    bloom.addColorStop(1, "rgba(69, 224, 255, 0)");
    ctx.fillStyle = bloom;
    ctx.beginPath();
    ctx.arc(x, y, r * 3.2, 0, Math.PI * 2);
    ctx.fill();
  }

  const core = ctx.createRadialGradient(x, y, 0, x, y, r);
  core.addColorStop(0, "rgba(255, 245, 230, 0.95)");
  core.addColorStop(0.45, "rgba(255, 170, 120, 0.75)");
  core.addColorStop(1, "rgba(255, 110, 168, 0)");
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawHorizon(bass) {
  const y = H * 0.52;
  const b = fxOn("skyLighting") ? bass : 0;
  const glow = ctx.createLinearGradient(0, y - 20, 0, y + 40);
  glow.addColorStop(0, "rgba(69, 224, 255, 0)");
  glow.addColorStop(0.45, `rgba(69, 224, 255, ${0.15 + b * 0.35})`);
  glow.addColorStop(0.55, `rgba(255, 110, 168, ${0.2 + b * 0.25})`);
  glow.addColorStop(1, "rgba(255, 110, 168, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, y - 30, W, 80);
}

function drawSea(now, bass, mid, air) {
  const horizon = H * 0.52;
  const seaH = H - horizon;
  const light = fxOn("skyLighting");
  const waves = fxOn("gridWaves");
  const sea = ctx.createLinearGradient(0, horizon, 0, H);
  sea.addColorStop(0, `rgba(28, 70, 98, ${0.65 + (light ? mid * 0.2 : 0)})`);
  sea.addColorStop(0.35, "#0a2238");
  sea.addColorStop(1, "#03070e");
  ctx.fillStyle = sea;
  ctx.fillRect(0, horizon, W, seaH);

  if (fxOn("horizonEllipse")) {
    // Water mirror of the sun — pinned just under the horizon (not chasing sun scale down the sea)
    const rx = vanishX();
    const sunY = sunAnchor().y;
    const gap = Math.max(H * 0.02, horizon - sunY);
    const cy = horizon + Math.min(gap * 0.28, H * 0.065);
    const rr =
      Math.min(W, H) * (0.18 + (light ? bass * 0.1 : 0)) * (0.92 + (SUN_SCALE - 1) * 0.45);
    const rh = rr * 0.42;
    const refl = ctx.createRadialGradient(rx, horizon + 4, 0, rx, cy, rr);
    refl.addColorStop(0, `rgba(255, 170, 130, ${0.28 + (light ? bass * 0.3 : 0)})`);
    refl.addColorStop(0.5, `rgba(255, 110, 168, ${0.1 + (light ? mid * 0.12 : 0)})`);
    refl.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = refl;
    ctx.beginPath();
    ctx.ellipse(rx, cy, rr, rh, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Waving perspective grid — ribbon energy falling into the distance
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, horizon, W, seaH);
  ctx.clip();
  ctx.globalCompositeOperation = "lighter";

  const scroll = FX.gridScroll;
  const rows = GRID_ROWS;
  const cols = GRID_COLS;
  const waveAmp = waves ? 10 + mid * 28 + FX.solo * 18 + bass * 10 : 0;
  const vanishingX = vanishX();
  const phase = now * 0.0008 + FX.gridScroll * Math.PI * 2;
  const sunX = W * 0.5;
  const sunY = sunAnchor().y;
  const sunReach = Math.hypot(W * 0.55, seaH + (horizon - sunY)) || 1;
  const door = fxOn("doorway") ? FX.doorway : 0;

  // Doorway starfield — deeper night through the parted shutters
  if (door > 0.02) {
    const gapTop = door * W * 0.055;
    const gapBot = door * W * 0.16;
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.beginPath();
    ctx.moveTo(vanishingX - gapTop, horizon);
    ctx.lineTo(vanishingX + gapTop, horizon);
    ctx.lineTo(vanishingX + gapBot, H);
    ctx.lineTo(vanishingX - gapBot, H);
    ctx.closePath();
    ctx.clip();
    const deep = ctx.createLinearGradient(0, horizon, 0, H);
    deep.addColorStop(0, "#010208");
    deep.addColorStop(0.45, "#000105");
    deep.addColorStop(1, "#000000");
    ctx.fillStyle = deep;
    ctx.fillRect(0, horizon, W, seaH);
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 55; i++) {
      const sx = vanishingX + (Math.sin(i * 12.989 + now * 0.0003) * 0.5) * gapBot * 1.6;
      const sy = horizon + ((i * 47) % 1000) / 1000 * seaH;
      const tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(now * 0.003 + i));
      const sa = (0.25 + tw * 0.75) * door;
      const sr = i % 5 === 0 ? 1.8 : 1.1;
      ctx.fillStyle =
        i % 3 === 0
          ? `rgba(240, 197, 106, ${sa * 0.7})`
          : i % 3 === 1
            ? `rgba(255, 110, 168, ${sa * 0.55})`
            : `rgba(200, 230, 255, ${sa})`;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }
    // Soft cyan/pink shutter lip glow
    ctx.strokeStyle = `rgba(69, 224, 255, ${0.25 + door * 0.4})`;
    ctx.lineWidth = 1.5 + door;
    ctx.beginPath();
    ctx.moveTo(vanishingX - gapTop, horizon);
    ctx.lineTo(vanishingX - gapBot, H);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(vanishingX + gapTop, horizon);
    ctx.lineTo(vanishingX + gapBot, H);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255, 110, 168, ${0.15 + door * 0.3})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(vanishingX - gapTop, horizon);
    ctx.lineTo(vanishingX - gapBot, H);
    ctx.moveTo(vanishingX + gapTop, horizon);
    ctx.lineTo(vanishingX + gapBot, H);
    ctx.stroke();
    ctx.restore();
    ctx.globalCompositeOperation = "lighter";
  }

  // Same lean + whip/sway as the stroked verticals (fractional col ok).
  const vertSway = (colI, t, depth, lean, y) => {
    if (WHIP_VERTICALS && fxOn("whipVerticals")) {
      const dist = Math.hypot(lean - sunX, y - sunY) / sunReach;
      const tip = 0.45 + depth * 0.85;
      let swaySum = 0;
      for (const w of FX.whips) {
        const u = (dist - w.travel) / WHIP_CREST_WIDTH;
        const bump = Math.exp(-u * u);
        const flick = 1 + Math.sin(dist * 10 + colI * 0.4) * 0.12 * (0.4 + w.air);
        swaySum += w.side * bump * w.amp * tip * flick;
      }
      return swaySum * WHIP_STACK;
    }
    if (!waves) return 0;
    return (
      Math.sin(phase + colI * 0.35 + t * 4) * (6 + mid * 14 + bass * 8) * (0.35 + depth * 0.65) +
      Math.sin(phase * 1.3 + colI + t * 8) * (3 + air * 8) * (0.35 + depth * 0.65)
    );
  };

  // Intersection of horizontal row line + vertical col line, with both curves.
  const meshPoint = (rowI, colI) => {
    const tH = (rowI + scroll) / rows;
    const depthH = Math.pow(Math.min(0.999, Math.max(0.001, tH)), 1.55);
    const yBase = horizon + depthH * seaH;
    const tV = Math.pow(depthH, 1 / 1.35);
    const depthV = depthH;
    const bottomX = -0.35 * W + (colI / cols) * 1.7 * W;
    const topKeep = 0.28;
    const spread = topKeep + (1 - topKeep) * depthV;
    const lean = vanishingX + (bottomX - vanishingX) * spread;
    const sway = vertSway(colI, tV, depthV, lean, yBase);
    const x = lean + sway;
    const amp = waveAmp * (0.25 + depthH * 0.9);
    const nx = (x / W) * 2 - 1;
    const wave =
      Math.sin(nx * 3.2 + phase + rowI * 0.4) * amp +
      Math.sin(nx * 7.5 + phase * 1.4 + rowI) * amp * 0.28 * (0.4 + air);
    const persp = 0.2 + depthH * 0.8;
    return { x, y: yBase + wave * persp, depth: depthH };
  };

  // Fixed world-depth point (ignores scroll) so lit cells only move on kicks.
  const meshPointDepth = (depth01, colI) => {
    const depthH = Math.pow(Math.min(0.999, Math.max(0.001, depth01)), 1.55);
    const yBase = horizon + depthH * seaH;
    const tV = Math.pow(depthH, 1 / 1.35);
    const bottomX = -0.35 * W + (colI / cols) * 1.7 * W;
    const topKeep = 0.28;
    const spread = topKeep + (1 - topKeep) * depthH;
    const lean = vanishingX + (bottomX - vanishingX) * spread;
    const sway = vertSway(colI, tV, depthH, lean, yBase);
    const x = lean + sway;
    const amp = waveAmp * (0.25 + depthH * 0.9);
    const nx = (x / W) * 2 - 1;
    const wave =
      Math.sin(nx * 3.2 + phase + depth01 * 8) * amp +
      Math.sin(nx * 7.5 + phase * 1.4 + depth01 * 6) * amp * 0.28 * (0.4 + air);
    const persp = 0.2 + depthH * 0.8;
    return { x, y: yBase + wave * persp };
  };

  // Curved quads — sample edges so fills ride the same waves as the strokes.
  const paintCellQuad = (cell, alphaScale = 1) => {
    const a = cell.life * cell.strength * alphaScale;
    if (a < 0.015) return;
    const rowSpan = 1 / rows;
    const EDGE = cell.trail ? 3 : PERF.cellEdge;
    const d0 = cell.depth;
    const d1 = Math.min(0.98, cell.depth + rowSpan * (cell.trail ? 0.65 : 1));
    const c0 = cell.col;
    const c1 = cell.col + 1;
    const fill =
      cell.hue === "gold"
        ? `rgba(240, 197, 106, ${a * 0.55})`
        : cell.hue === "pink"
          ? `rgba(255, 110, 168, ${a * 0.5})`
          : `rgba(69, 224, 255, ${a * 0.5})`;
    ctx.fillStyle = fill;
    ctx.beginPath();
    for (let k = 0; k <= EDGE; k++) {
      const p = meshPointDepth(d0, c0 + (k / EDGE) * (c1 - c0));
      if (k === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    for (let k = 1; k <= EDGE; k++) {
      const p = meshPointDepth(d0 + (k / EDGE) * (d1 - d0), c1);
      ctx.lineTo(p.x, p.y);
    }
    for (let k = 1; k <= EDGE; k++) {
      const p = meshPointDepth(d1, c1 - (k / EDGE) * (c1 - c0));
      ctx.lineTo(p.x, p.y);
    }
    for (let k = 1; k < EDGE; k++) {
      const p = meshPointDepth(d1 - (k / EDGE) * (d1 - d0), c0);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.fill();
  };

  if (fxOn("constellationTrails") && gridTrails.length) {
    for (const trail of gridTrails) {
      paintCellQuad({ ...trail, trail: true }, 0.75);
    }
  }

  if (fxOn("litFlocks") && gridCells.length) {
    for (const cell of gridCells) paintCellQuad(cell);
  }

  // Horizon bloom rings — snare trapezoids hopping row-by-row toward the camera
  if (fxOn("horizonBloom") && bloomRings.length) {
    const rowSpan = 1 / rows;
    const EDGE = 8;
    for (const b of bloomRings) {
      const a = b.life * b.strength * (0.55 + b.depth * 0.55);
      if (a < 0.03) continue;
      const half = b.width * cols * 0.5;
      const c0 = b.origin - half;
      const c1 = b.origin + half;
      const d0 = b.depth;
      const d1 = Math.min(0.98, b.depth + rowSpan);
      // Soft fill trapezoid riding the current grid row
      ctx.beginPath();
      for (let k = 0; k <= EDGE; k++) {
        const p = meshPointDepth(d0, c0 + (k / EDGE) * (c1 - c0));
        if (k === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      for (let k = 1; k <= EDGE; k++) {
        const p = meshPointDepth(d0 + (k / EDGE) * (d1 - d0), c1);
        ctx.lineTo(p.x, p.y);
      }
      for (let k = 1; k <= EDGE; k++) {
        const p = meshPointDepth(d1, c1 - (k / EDGE) * (c1 - c0));
        ctx.lineTo(p.x, p.y);
      }
      for (let k = 1; k < EDGE; k++) {
        const p = meshPointDepth(d1 - (k / EDGE) * (d1 - d0), c0);
        ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      const midP = meshPointDepth((d0 + d1) * 0.5, b.origin);
      const grad = ctx.createRadialGradient(
        midP.x,
        midP.y,
        Math.max(4, half * 2),
        midP.x,
        midP.y,
        Math.max(40, half * W * 0.05),
      );
      grad.addColorStop(0, synthRainbow(b.hueT, a * 0.6));
      grad.addColorStop(0.45, synthRainbow(b.hueT + 0.12, a * 0.3));
      grad.addColorStop(1, synthRainbow(b.hueT + 0.25, 0));
      ctx.fillStyle = grad;
      ctx.fill();
      // Leading radar rim on the near edge (toward camera)
      ctx.beginPath();
      for (let k = 0; k <= EDGE; k++) {
        const p = meshPointDepth(d1, c0 + (k / EDGE) * (c1 - c0));
        if (k === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.strokeStyle = synthRainbow(b.hueT + 0.2, a * 0.8);
      ctx.lineWidth = 1.5 + a * 2.4;
      ctx.stroke();
      ctx.strokeStyle = synthRainbow(b.hueT + 0.35, a * 0.4);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  const gridStep = PERF.gridStep;
  for (let i = 0; i < rows; i++) {
    const t = (i + scroll) / rows;
    const depth = Math.pow(t, 1.55);
    const yBase = horizon + depth * seaH;
    const amp = waveAmp * (0.25 + depth * 0.9);
    const a = (0.1 + depth * 0.5) * (0.55 + (light ? bass * 0.35 + mid * 0.25 : 0));
    ctx.lineWidth = 1 + depth * 1.8 + (light ? FX.gridDrive * 8 : 0);
    // One polyline per row — avoids thousands of stroke() calls
    if (!GRID_RAINBOW && door <= 0.02) {
      ctx.strokeStyle = i % 2 ? `rgba(255, 110, 168, ${a})` : `rgba(69, 224, 255, ${a})`;
      ctx.beginPath();
      for (let x = 0; x <= W; x += gridStep) {
        const nx = (x / W) * 2 - 1;
        const wave =
          Math.sin(nx * 3.2 + phase + i * 0.4) * amp +
          Math.sin(nx * 7.5 + phase * 1.4 + i) * amp * 0.28 * (0.4 + air);
        const persp = 0.2 + depth * 0.8;
        const y = yBase + wave * persp;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      continue;
    }
    let prevX = 0;
    let prevY = yBase;
    for (let x = 0; x <= W; x += gridStep) {
      const nx = (x / W) * 2 - 1;
      const wave =
        Math.sin(nx * 3.2 + phase + i * 0.4) * amp +
        Math.sin(nx * 7.5 + phase * 1.4 + i) * amp * 0.28 * (0.4 + air);
      const persp = 0.2 + depth * 0.8;
      const y = yBase + wave * persp;
      const doorFade =
        door > 0.02 ? Math.min(1, Math.abs(nx) / (0.08 + door * 0.14)) : 1;
      if (x > 0 && doorFade > 0.08) {
        const aa = a * doorFade;
        if (GRID_RAINBOW) {
          const hueT =
            x / W * 0.5 +
            phase * 0.11 +
            depth * 0.35 +
            (amp ? (wave / amp) * 0.07 : 0) +
            mid * 0.08 +
            FX.solo * 0.12;
          ctx.strokeStyle = synthRainbow(hueT, aa);
        } else {
          ctx.strokeStyle = i % 2 ? `rgba(255, 110, 168, ${aa})` : `rgba(69, 224, 255, ${aa})`;
        }
        ctx.beginPath();
        ctx.moveTo(prevX, prevY);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      prevX = x;
      prevY = y;
    }
  }

  // Verticals: keep width near the horizon so the upper sides stay filled
  // Doorway parts the center columns like shutters
  const midCol = cols / 2;
  const partReach = 4.5;
  const vertSamples = PERF.vertSamples;
  for (let i = 0; i <= cols; i++) {
    const bottomX = -0.35 * W + (i / cols) * 1.7 * W;
    const a = 0.12 + (light ? mid * 0.2 + air * 0.1 : 0);
    ctx.lineWidth = 1;
    let partX = 0;
    if (door > 0.01) {
      const dist = i - midCol;
      const ad = Math.abs(dist);
      if (ad < partReach) {
        const t = 1 - ad / partReach;
        const side = dist === 0 ? 0 : Math.sign(dist);
        if (ad < 0.35 && door > 0.25) continue;
        partX = side * door * t * t * W * 0.09;
      }
    }
    if (!GRID_RAINBOW) {
      ctx.strokeStyle =
        i % 2 === 0 ? `rgba(69, 224, 255, ${a})` : `rgba(255, 110, 168, ${a * 0.9})`;
      ctx.beginPath();
      for (let s = 0; s <= vertSamples; s++) {
        const t = s / vertSamples;
        const depth = Math.pow(t, 1.35);
        const y = horizon + depth * seaH;
        const topKeep = 0.28;
        const spread = topKeep + (1 - topKeep) * depth;
        const lean = vanishingX + (bottomX - vanishingX) * spread;
        const sway = vertSway(i, t, depth, lean, y);
        const x = lean + sway + partX * (0.35 + depth * 0.9);
        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      continue;
    }
    let prevX = vanishingX + (bottomX - vanishingX) * 0.28 + partX * 0.28;
    let prevY = horizon;
    for (let s = 0; s <= vertSamples; s++) {
      const t = s / vertSamples;
      const depth = Math.pow(t, 1.35);
      const y = horizon + depth * seaH;
      const topKeep = 0.28;
      const spread = topKeep + (1 - topKeep) * depth;
      const lean = vanishingX + (bottomX - vanishingX) * spread;
      const sway = vertSway(i, t, depth, lean, y);
      const x = lean + sway + partX * (0.35 + depth * 0.9);
      if (s > 0) {
        const hueT =
          depth * 0.55 +
          phase * 0.09 +
          i / cols * 0.25 +
          (sway !== 0 ? Math.abs(sway) * 0.004 : 0) +
          mid * 0.06 +
          FX.solo * 0.1;
        ctx.strokeStyle = synthRainbow(hueT, a * (i % 2 === 0 ? 1 : 0.9));
        ctx.beginPath();
        ctx.moveTo(prevX, prevY);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      prevX = x;
      prevY = y;
    }
  }

  // Soft fog banks between grid rows — continuous ribbons (no hard skip pops)
  if (fxOn("depthFog")) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const STEPS = 40;
    const BANK_COUNT = 5;
    for (let b = 0; b < BANK_COUNT; b++) {
      // Drift with grid scroll; wrap softly via edge fade below
      const u = (b / BANK_COUNT + scroll * 0.9) % 1;
      const midD = 0.07 + u * 0.86;
      const thickness =
        0.038 + 0.022 * (0.5 + 0.5 * Math.sin(now * 0.00022 + b * 1.65));
      const d0 = Math.max(0.035, midD - thickness * 0.5);
      const d1 = Math.min(0.97, midD + thickness * 0.5);

      // Fade at horizon + near camera so wraps don't pop
      const edgeFade = Math.sin(Math.PI * Math.min(1, Math.max(0, (midD - 0.05) / 0.9)));
      const breathe = 0.85 + 0.15 * Math.sin(now * 0.00032 + b * 1.05);
      const depthH = Math.pow(midD, 1.35);
      const a = (0.12 + depthH * 0.2 + bass * 0.1 + mid * 0.07) * breathe * edgeFade;
      if (a < 0.035) continue;

      ctx.beginPath();
      for (let s = 0; s <= STEPS; s++) {
        const col = (s / STEPS) * cols;
        const p = meshPointDepth(d0, col);
        if (s === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      for (let s = STEPS; s >= 0; s--) {
        const col = (s / STEPS) * cols;
        const p = meshPointDepth(d1, col);
        ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();

      const farP = meshPointDepth(d0, cols * 0.5);
      const nearP = meshPointDepth(d1, cols * 0.5);
      const grad = ctx.createLinearGradient(0, farP.y, 0, nearP.y);
      const rose = 0.5 + 0.5 * Math.sin(b * 1.8 + now * 0.00008);
      grad.addColorStop(
        0,
        `rgba(${Math.round(69 + rose * 186)}, ${Math.round(224 - rose * 74)}, ${Math.round(255 - rose * 60)}, 0)`,
      );
      grad.addColorStop(
        0.35,
        `rgba(${Math.round(120 + rose * 135)}, ${Math.round(220 - rose * 70)}, ${Math.round(255 - rose * 45)}, ${a * 0.75})`,
      );
      grad.addColorStop(
        0.55,
        `rgba(${Math.round(180 + rose * 75)}, ${Math.round(235 - rose * 55)}, ${Math.round(255 - rose * 45)}, ${a})`,
      );
      grad.addColorStop(
        1,
        `rgba(${Math.round(69 + rose * 186)}, ${Math.round(224 - rose * 74)}, ${Math.round(255 - rose * 60)}, 0)`,
      );
      ctx.fillStyle = grad;
      ctx.fill();
    }
    ctx.restore();
  }

  // Grid heartbeat ECG — QRS crawls a mid-row on kicks
  if (fxOn("gridHeartbeat") && heartbeats.length) {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const hb of heartbeats) {
      const a = Math.max(0, hb.life);
      if (a < 0.04) continue;
      const steps = 64;
      let prev = null;
      for (let s = 0; s <= steps; s++) {
        const u = s / steps;
        const col = u * cols;
        const base = meshPointDepth(hb.depth, col);
        const local = u - hb.progress;
        // Only draw near the crawling complex so it reads as a pulse, not a full row
        const window = Math.exp(-(local * local) * 28);
        if (window < 0.02) {
          prev = null;
          continue;
        }
        const spike = ecgShape(local);
        const lift = spike * hb.amp * (0.55 + hb.depth * 0.9) * window;
        const x = base.x;
        const y = base.y - lift;
        if (prev) {
          const segA = a * (0.35 + window * 0.65);
          ctx.strokeStyle =
            hb.hue === "pink"
              ? `rgba(255, 110, 168, ${segA})`
              : `rgba(69, 224, 255, ${segA})`;
          ctx.lineWidth = 1.4 + a * 2.2 + Math.abs(spike) * window * 1.8;
          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(x, y);
          ctx.stroke();
          // Twin stroke — classic pink/cyan grid language
          ctx.strokeStyle =
            hb.hue === "pink"
              ? `rgba(69, 224, 255, ${segA * 0.45})`
              : `rgba(255, 110, 168, ${segA * 0.45})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        prev = { x, y };
      }
      // Bright QRS tip
      if (hb.progress > 0 && hb.progress < 1) {
        const tip = meshPointDepth(hb.depth, hb.progress * cols);
        const tipY = tip.y - ecgShape(0) * hb.amp * (0.55 + hb.depth * 0.9);
        ctx.fillStyle =
          hb.hue === "pink"
            ? `rgba(255, 200, 230, ${a * 0.85})`
            : `rgba(200, 245, 255, ${a * 0.85})`;
        ctx.beginPath();
        ctx.arc(tip.x, tipY, 2 + a * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Vanishing-point meteors — race down the verticals from the sun
  if (fxOn("vanishingMeteors") && meteors.length) {
    ctx.lineCap = "round";
    for (const m of meteors) {
      const headD = Math.min(0.98, m.depth);
      const tailD = Math.max(0.001, m.depth - m.len);
      const head = meshPointDepth(headD, m.col);
      const tail = meshPointDepth(tailD, m.col);
      const a = Math.max(0, m.life) * (0.35 + headD * 0.75);
      if (a < 0.04) continue;
      const hueT = m.hueT ?? 0;
      const grad = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
      grad.addColorStop(0, synthRainbow(hueT, 0));
      grad.addColorStop(0.4, synthRainbow(hueT + 0.1, a * 0.45));
      grad.addColorStop(0.75, synthRainbow(hueT + 0.18, a * 0.85));
      grad.addColorStop(1, synthRainbow(hueT + 0.28, a));
      ctx.strokeStyle = grad;
      ctx.lineWidth = m.width * (0.7 + headD * 1.4);
      ctx.beginPath();
      ctx.moveTo(tail.x, tail.y);
      ctx.lineTo(head.x, head.y);
      ctx.stroke();
      ctx.fillStyle = synthRainbow(hueT + 0.3, Math.min(1, a * 1.15));
      ctx.beginPath();
      ctx.arc(head.x, head.y, 1.2 + a * 1.8 + headD * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();

  if (fxOn("melodyLines")) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const rib of ribbons) {
      const yBase = H * rib.y + Math.sin(now * 0.0007 * rib.speed + rib.phase) * 8;
      const amp = rib.amp * (0.45 + mid * 1.4 + bass * 0.6);
      ctx.beginPath();
      for (let x = 0; x <= W; x += 8) {
        const n =
          Math.sin(x * 0.0045 + now * 0.0011 * rib.speed + rib.phase) * amp +
          Math.sin(x * 0.011 + now * 0.0018 + rib.phase) * amp * 0.35 * (0.4 + air);
        const y = yBase + n;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      const alpha = 0.22 + mid * 0.5 + FX.solo * 0.35;
      ctx.strokeStyle =
        rib.hue === "cyan"
          ? `rgba(69, 224, 255, ${alpha})`
          : `rgba(255, 110, 168, ${alpha * 0.9})`;
      ctx.lineWidth = rib.width + bass * 1.5 + FX.solo * 2.2;
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawFog(now, bass) {
  ctx.save();
  for (const p of fogPuffs) {
    p.x += p.drift * (0.2 + bass);
    if (p.x < -0.2) p.x = 1.2;
    if (p.x > 1.2) p.x = -0.2;
    const x = p.x * W;
    const y = p.y * H + Math.sin(now * 0.0004 + p.x * 8) * 10;
    const g = ctx.createRadialGradient(x, y, 0, x, y, p.r);
    g.addColorStop(0, `rgba(170, 210, 255, ${p.alpha + bass * 0.05})`);
    g.addColorStop(1, "rgba(170, 210, 255, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawDew(now, air, mid) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const d of dew) {
    d.tw += 0.02 * d.sp;
    const spark = 0.15 + air * 0.85 * (0.5 + 0.5 * Math.sin(d.tw + now * 0.003));
    if (spark < 0.2) continue;
    const x = d.x * W;
    const y = d.y * H;
    ctx.fillStyle = `rgba(200, 240, 255, ${spark * (0.35 + mid * 0.4)})`;
    ctx.beginPath();
    ctx.arc(x, y, d.r * (0.7 + air), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawHeartbeatRing(bass, mid) {
  if (!fxOn("sunHalo")) return;
  // soft ring around center — pulse while listening
  const { x, y } = sunAnchor();
  const pulse = fxOn("sunPulse");
  const r = Math.min(W, H) * (0.2 + (pulse ? bass * 0.12 : 0)) * SUN_SCALE;
  const b = pulse ? bass : 0;
  const m = pulse ? mid : 0;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = `rgba(240, 197, 106, ${0.08 + b * 0.35})`;
  ctx.lineWidth = 1.5 + m * 2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = `rgba(69, 224, 255, ${0.05 + m * 0.2})`;
  ctx.beginPath();
  ctx.arc(x, y, r * 1.35, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** Two soft overlapping rings — your speakers + my sky. */
function drawUsPresence(bass, mid, air) {
  if (sourceMode !== "system") return;
  if (!fxOn("sunHalo")) return;
  const { x, y } = sunAnchor();
  const pulse = fxOn("sunPulse");
  const base = Math.min(W, H) * (0.26 + (pulse ? bass * 0.08 : 0)) * SUN_SCALE;
  const b = pulse ? bass : 0;
  const m = pulse ? mid : 0;
  const a = pulse ? air : 0;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  // Warm ring
  ctx.strokeStyle = `rgba(240, 197, 106, ${0.1 + b * 0.28 + a * 0.1})`;
  ctx.lineWidth = 1.2 + m;
  ctx.beginPath();
  ctx.ellipse(x - base * 0.08, y, base * 1.05, base * 0.92, -0.12, 0, Math.PI * 2);
  ctx.stroke();
  // Cool ring
  ctx.strokeStyle = `rgba(69, 224, 255, ${0.1 + m * 0.28 + a * 0.12})`;
  ctx.beginPath();
  ctx.ellipse(x + base * 0.08, y, base * 1.05, base * 0.92, 0.12, 0, Math.PI * 2);
  ctx.stroke();
  // Soft join glow where they overlap
  const join = ctx.createRadialGradient(x, y, 0, x, y, base * 0.55);
  join.addColorStop(0, `rgba(255, 110, 168, ${0.06 + a * 0.12})`);
  join.addColorStop(1, "rgba(255, 110, 168, 0)");
  ctx.fillStyle = join;
  ctx.beginPath();
  ctx.arc(x, y, base * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawVignette() {
  const v = ctx.createRadialGradient(W * 0.5, H * 0.45, H * 0.2, W * 0.5, H * 0.5, H * 0.85);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
}

function updateMeters(bass, mid, air) {
  if (!bassDot || bassDot.closest(".together-stub") || stage.classList.contains("ui-hidden")) {
    return;
  }
  PERF.meterAcc += PERF.emaDt;
  if (PERF.meterAcc < 66) return;
  PERF.meterAcc = 0;
  const set = (el, v, colorBoost) => {
    const s = 0.85 + v * 1.4;
    el.style.opacity = String(0.25 + v * 0.75);
    el.style.transform = `scale(${s})`;
    el.style.boxShadow = `0 0 ${6 + v * 18}px ${colorBoost}`;
  };
  set(bassDot, bass, "rgba(240,197,106,0.9)");
  set(midDot, mid, "rgba(69,224,255,0.9)");
  set(airDot, air, "rgba(255,110,168,0.9)");
  if (sourceMode === "system") {
    const whisper = (el, color) => {
      el.style.boxShadow = `0 0 0 3px rgba(255,255,255,0.12), 0 0 ${10 + levels.air * 16}px ${color}`;
    };
    whisper(bassDot, "rgba(240,197,106,0.85)");
    whisper(midDot, "rgba(69,224,255,0.85)");
    whisper(airDot, "rgba(255,110,168,0.85)");
  }
}

function syncVizModeUi() {
  const sky = vizMode === "skyline";
  for (const btn of document.querySelectorAll("[data-viz]")) {
    const on = btn.getAttribute("data-viz") === vizMode;
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  }
  if (brandEyebrow) brandEyebrow.textContent = sky ? "skyline" : "night drive";
  if (vizSwitchBtn) {
    vizSwitchBtn.textContent = sky ? "Night Drive" : "Skyline";
    vizSwitchBtn.title = sky ? "Switch to Night Drive" : "Switch to Skyline";
  }
  // Effects panel is Night Drive–oriented; tuck it away in Skyline
  if (sky) {
    setFxPanelHidden(true);
    const peek = document.getElementById("fx-peek");
    if (peek && (started || gate?.classList.contains("gone"))) peek.hidden = true;
  } else if (started || gate?.classList.contains("gone")) {
    const peek = document.getElementById("fx-peek");
    if (peek && !stage.classList.contains("ui-hidden")) {
      const panel = document.getElementById("fx-panel");
      peek.hidden = !panel?.classList.contains("fx-panel-hidden");
    }
  }
}

function setVizMode(mode) {
  if (mode !== "skyline" && mode !== "nightDrive") return;
  if (mode === vizMode) {
    syncVizModeUi();
    return;
  }
  vizMode = mode;
  try {
    localStorage.setItem(VIZ_MODE_KEY, vizMode);
  } catch {
    /* ignore */
  }
  // Drop mode-specific lit cells so they don't linger across switches
  if (vizMode === "skyline") {
    gridCells.length = 0;
    gridTrails.length = 0;
  } else {
    skylineWinLits.length = 0;
    skylineParty.length = 0;
  }
  syncVizModeUi();
  if (statusEl && (started || playing)) {
    statusEl.textContent = vizMode === "skyline" ? "skyline" : "night drive";
  }
}

function skylineWinFill(hue, a) {
  if (Array.isArray(hue)) return `rgba(${hue[0]}, ${hue[1]}, ${hue[2]}, ${a})`;
  if (hue === "gold") return `rgba(240, 197, 106, ${a})`;
  if (hue === "pink") return `rgba(255, 110, 168, ${a})`;
  return `rgba(69, 224, 255, ${a})`;
}

/** Deterministic 0–1 from a seed (fractal city DNA). */
function skylineRand(seed) {
  const x = Math.sin(seed * 127.1 + seed * 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

function skylinePickPalette(seed) {
  const a = SW_RAINBOW[(skylineRand(seed + 0.4) * SW_RAINBOW.length) | 0];
  const g = SW_RAINBOW[(skylineRand(seed + 1.1) * SW_RAINBOW.length) | 0];
  const cool = skylineRand(seed + 2.2);
  return {
    body: [
      (6 + cool * 22 + skylineRand(seed + 3) * 14) | 0,
      (5 + skylineRand(seed + 3.5) * 18) | 0,
      (18 + skylineRand(seed + 4) * 52) | 0,
    ],
    bodyHi: [
      (10 + cool * 28) | 0,
      (8 + skylineRand(seed + 4.5) * 20) | 0,
      (28 + skylineRand(seed + 5) * 48) | 0,
    ],
    accent: a,
    glow: g,
    winHue: skylineRand(seed + 6) * SW_RAINBOW.length,
    stripe: skylineRand(seed + 7) > 0.42,
    stripeDir: skylineRand(seed + 8) > 0.5 ? "h" : "v",
    stripeGap: 2 + ((skylineRand(seed + 9) * 4) | 0),
  };
}

/**
 * Connected silhouette only — stacked setbacks + optional spire.
 * No twin-tower gaps or floating masses; every slab shares an edge with the one below.
 * Masses use u,v in building space: v=0 roof, v=1 street.
 */
function skylineFractalMasses(seed, maxDepth) {
  const masses = [];
  const nTiers = Math.max(
    1,
    Math.min(3, (maxDepth | 0) + (skylineRand(seed) > 0.55 ? 1 : 0)),
  );

  // Horizontal splits from roof (0) → street (1)
  const edges = [0];
  for (let i = 1; i < nTiers; i++) {
    const t = i / nTiers;
    const jitter = (skylineRand(seed + i * 1.7) - 0.5) * 0.14;
    edges.push(Math.min(0.9, Math.max(0.1, t + jitter)));
  }
  edges.push(1);
  edges.sort((a, b) => a - b);
  // Dedupe near-collisions so slabs stay chunky
  for (let i = 1; i < edges.length; i++) {
    if (edges[i] - edges[i - 1] < 0.1) {
      edges[i] = Math.min(1, edges[i - 1] + 0.1);
    }
  }
  if (edges[edges.length - 1] < 1) edges[edges.length - 1] = 1;

  // Build ground → roof: each upper tier is inset and sits on the tier below
  let u0 = 0;
  let u1 = 1;
  for (let i = edges.length - 2; i >= 0; i--) {
    const v0 = edges[i];
    const v1 = edges[i + 1];
    if (v1 - v0 < 0.06 || u1 - u0 < 0.08) continue;
    const parentU0 = u0;
    const parentU1 = u1;
    masses.push({
      u0,
      u1,
      v0,
      v1,
      shade: skylineRand(seed + i * 2.3),
    });
    // Prepare inset footprint for the next tier up (lower v)
    if (i > 0) {
      const bw = parentU1 - parentU0;
      const inset = 0.07 + skylineRand(seed + i + 11) * 0.2;
      let nu0 = parentU0 + inset * bw;
      let nu1 = parentU1 - inset * bw;
      const shift = (skylineRand(seed + i + 21) - 0.5) * inset * bw * 0.7;
      nu0 += shift;
      nu1 += shift;
      // Stay strictly inside parent so the stack never disconnects
      if (nu0 < parentU0) {
        nu1 += parentU0 - nu0;
        nu0 = parentU0;
      }
      if (nu1 > parentU1) {
        nu0 -= nu1 - parentU1;
        nu1 = parentU1;
      }
      if (nu1 - nu0 < 0.12) {
        const cx = (parentU0 + parentU1) * 0.5;
        nu0 = cx - 0.06;
        nu1 = cx + 0.06;
        nu0 = Math.max(parentU0, nu0);
        nu1 = Math.min(parentU1, nu1);
      }
      u0 = nu0;
      u1 = nu1;
    }
  }

  // Spire only on the roof tier, centered and touching its top edge
  const roof = masses[masses.length - 1];
  if (roof && !roof.spire && skylineRand(seed + 50) > 0.42) {
    const cx = (roof.u0 + roof.u1) * 0.5;
    const sw = Math.max(0.03, (roof.u1 - roof.u0) * (0.05 + skylineRand(seed + 51) * 0.1));
    masses.push({
      u0: cx - sw,
      u1: cx + sw,
      v0: Math.max(0, roof.v0 - (0.05 + skylineRand(seed + 52) * 0.1)),
      v1: roof.v0,
      shade: 0.9,
      spire: true,
    });
  }

  // Safety: if somehow empty, one solid block
  if (!masses.length) {
    masses.push({ u0: 0, u1: 1, v0: 0, v1: 1, shade: 0.5 });
  }
  return masses;
}

/** Fractal-ish window occupancy — each building gets its own pattern language. */
function skylineWindowPattern(pattern, r, c, rows, cols, seed) {
  if (pattern === "sierpinski") {
    let rr = r + 1;
    let cc = c + 1;
    while (rr > 0 || cc > 0) {
      if (rr % 2 === 1 && cc % 2 === 1) return false;
      rr = (rr / 2) | 0;
      cc = (cc / 2) | 0;
    }
    return true;
  }
  if (pattern === "stripes") {
    const gap = 1 + ((skylineRand(seed + 20) * 2) | 0);
    return r % (gap + 1) !== gap;
  }
  if (pattern === "columns") {
    const gap = 1 + ((skylineRand(seed + 21) * 2) | 0);
    return c % (gap + 1) !== 0;
  }
  if (pattern === "diagonal") {
    return (r + c) % 3 !== 0;
  }
  if (pattern === "clusters") {
    const cell = skylineRand(seed * 0.1 + r * 12.3 + c * 7.7);
    return cell > 0.28;
  }
  // dense grid with organic dropouts
  return skylineRand(seed + r * 31.7 + c * 17.3) > 0.22;
}

/** Pull analyser bins into a smooth EQ used as building heights. */
function updateSkylineEq(now) {
  const n = freq && freq.length ? freq.length : 0;
  for (let i = 0; i < SKYLINE_EQ_N; i++) {
    let target = 0.12 + 0.06 * Math.sin(now * 0.0011 + i * 0.35);
    if (n > 8 && playing) {
      const t0 = i / SKYLINE_EQ_N;
      const t1 = (i + 1) / SKYLINE_EQ_N;
      // Slight bass emphasis so low end towers punch
      const f0 = Math.floor(1 + Math.pow(t0, 1.35) * (n * 0.72));
      const f1 = Math.max(f0 + 1, Math.floor(1 + Math.pow(t1, 1.35) * (n * 0.72)));
      let sum = 0;
      let count = 0;
      for (let j = f0; j < f1 && j < n; j++) {
        sum += freq[j];
        count++;
      }
      const raw = count ? sum / (count * 255) : 0;
      target = Math.pow(Math.min(1, raw * 1.15), 0.82);
    } else if (!playing) {
      target *= 0.55;
    }
    // Snappy rise, softer fall — classic EQ bar feel
    const rate = target > skylineEq[i] ? 0.42 : 0.16;
    skylineEq[i] += (target - skylineEq[i]) * rate;
  }
}

function sampleSkylineEq(t) {
  const x = Math.max(0, Math.min(0.999, t)) * (SKYLINE_EQ_N - 1);
  const i = x | 0;
  const u = x - i;
  const a = skylineEq[i];
  const b = skylineEq[Math.min(SKYLINE_EQ_N - 1, i + 1)];
  return a + (b - a) * u;
}

function skylineLayerByName(name) {
  if (name === "near") return skylineNear;
  if (name === "mid") return skylineMid;
  return skylineFar;
}

/** Drum flocks for Skyline — windows hop roofward like grid cells hop sunward. */
function spawnSkylineWinFlock(size, { hue, strength, layerName } = {}) {
  if (!fxOn("litFlocks") || size <= 0 || !playing) return;
  const layer = layerName || (Math.random() > 0.35 ? "near" : "mid");
  const buildings = skylineLayerByName(layer);
  if (!buildings.length) return;
  const bi = Math.floor(Math.random() * buildings.length);
  const b = buildings[bi];
  const rows = b.rows || 4;
  const cols = b.cols || 3;
  let r = Math.floor(rows * (0.45 + Math.random() * 0.45)); // start mid/low
  let c = Math.floor(Math.random() * cols);
  const flockHue = hue || (Math.random() > 0.55 ? "cyan" : Math.random() > 0.45 ? "pink" : "gold");
  const base = strength ?? 0.35 + Math.random() * 0.2;
  const centerR = r;
  const centerC = c;

  for (let k = 0; k < size; k++) {
    if (skylineWinLits.length >= SKYLINE_WIN_MAX) {
      skylineWinLits.splice(0, Math.min(12, Math.ceil(size * 0.5)));
    }
    if (k > 0) {
      if (Math.random() < 0.4) {
        r = centerR + Math.round((Math.random() - 0.5) * 2);
        c = centerC + Math.round((Math.random() - 0.5) * 2);
      } else {
        r += Math.random() < 0.7 ? (Math.random() < 0.35 ? -1 : 1) : 0;
        c += Math.random() < 0.8 ? (Math.random() < 0.5 ? -1 : 1) : 0;
      }
      r = Math.max(0, Math.min(rows - 1, r));
      c = Math.max(0, Math.min(cols - 1, c));
    }
    const dist = Math.abs(r - centerR) + Math.abs(c - centerC);
    skylineWinLits.push({
      layer,
      bi,
      r,
      c,
      life: 1 - Math.min(0.25, dist * 0.06),
      decay: 0.004 + Math.random() * 0.004,
      hue: flockHue,
      strength: Math.max(0.22, base * (1 - dist * 0.08)),
      traveling: true,
      stepAcc: Math.random() * SKYLINE_WIN_STEP_MS,
      stepMs: SKYLINE_WIN_STEP_MS * (0.85 + Math.random() * 0.3),
    });
  }
}

function spawnSkylineWinCells(n, opts = {}) {
  if (!fxOn("litFlocks") || n <= 0 || !playing) return;
  const flockSize = Math.max(5, Math.min(14, n));
  spawnSkylineWinFlock(flockSize, opts);
  const extras = 1 + (n >= 6 ? 1 : 0);
  for (let i = 0; i < extras; i++) {
    spawnSkylineWinFlock(4 + Math.floor(Math.random() * 6), {
      ...opts,
      layerName: Math.random() > 0.4 ? "near" : "mid",
    });
  }
}

function stepSkylineWinLit(cell) {
  const buildings = skylineLayerByName(cell.layer);
  const b = buildings[cell.bi];
  if (!b) {
    cell.traveling = false;
    cell.decay = 0.08;
    return;
  }
  const rows = b.rows || 4;
  const cols = b.cols || 3;
  if (cell.r > 0) {
    cell.r -= 1; // climb toward the roof / sun
    if (Math.random() < 0.35) {
      cell.c += Math.random() < 0.5 ? -1 : 1;
      cell.c = Math.max(0, Math.min(cols - 1, cell.c));
    }
    cell.life = Math.min(1, cell.life + 0.06);
  } else {
    cell.traveling = false;
    cell.r = 0;
    cell.decay = 0.06 + Math.random() * 0.04;
    cell.strength *= 1.3;
  }
  cell.r = Math.max(0, Math.min(rows - 1, cell.r));
}

function updateSkylineWinLits(dt) {
  if (vizMode !== "skyline") {
    if (skylineWinLits.length) skylineWinLits.length = 0;
    return;
  }
  for (let i = skylineWinLits.length - 1; i >= 0; i--) {
    const cell = skylineWinLits[i];
    if (cell.traveling) {
      cell.stepAcc = (cell.stepAcc || 0) + dt;
      while (cell.traveling && cell.stepAcc >= cell.stepMs) {
        cell.stepAcc -= cell.stepMs;
        stepSkylineWinLit(cell);
      }
      cell.life -= cell.decay * (dt / 16);
    } else {
      cell.life -= cell.decay * (dt / 16) * 2.2;
    }
    if (cell.life <= 0) skylineWinLits.splice(i, 1);
  }
}

/**
 * Buildings throw a party — kicks/snares/hats burst confetti from rooftops.
 * Particles live on the city strip (same scroll as their layer) so they leave the
 * roof into the world — not stuck to the camera.
 */
function spawnSkylineParty(kind, strength = 0.5) {
  if (vizMode !== "skyline" || !fxOn("sparks") || !playing || !W) return;
  const layerName = kind === "hat" ? (Math.random() > 0.4 ? "near" : "mid") : Math.random() > 0.28 ? "near" : "mid";
  const buildings = skylineLayerByName(layerName);
  if (!buildings.length) return;
  const scrollMul = layerName === "near" ? 1.0 : layerName === "mid" ? 0.5 : 0.18;
  const loopW = buildings.loopW || W * 4;
  const scroll = skylineScrollPx * scrollMul;
  const off = ((scroll % loopW) + loopW) % loopW;
  const groundY = H * 0.62;
  const candidates = [];
  for (let bi = 0; bi < buildings.length; bi++) {
    const b = buildings[bi];
    for (let k = -1; k <= 1; k++) {
      const x = b.x - off + k * loopW;
      if (x + b.w < 8 || x > W - 8) continue;
      candidates.push({ b, x, stripX: b.x + k * loopW });
    }
  }
  if (!candidates.length) return;

  const s = Math.min(1, Math.max(0.2, strength));
  const nRoofs =
    kind === "kick" ? 2 + Math.floor(s * 3) : kind === "snare" ? 1 + Math.floor(s * 2) : 1 + (Math.random() > 0.5 ? 1 : 0);
  for (let r = 0; r < nRoofs; r++) {
    const pick = candidates[(Math.random() * candidates.length) | 0];
    let roofV = 0;
    if (pick.b.masses) {
      for (const m of pick.b.masses) {
        if (!m.spire) roofV = Math.min(roofV, m.v0);
      }
    }
    const top = groundY - pick.b.h;
    const roofY = top + roofV * pick.b.h;
    const palette = pick.b.palette;
    const count =
      kind === "kick"
        ? 12 + Math.floor(s * 16)
        : kind === "snare"
          ? 9 + Math.floor(s * 12)
          : 5 + Math.floor(s * 8);

    for (let i = 0; i < count; i++) {
      if (skylineParty.length >= SKYLINE_PARTY_MAX) {
        skylineParty.splice(0, Math.min(16, count));
      }
      const spread = kind === "hat" ? 0.9 : kind === "snare" ? 1.5 : 2.1;
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * spread;
      const speed =
        (kind === "kick" ? 2.8 : kind === "snare" ? 2.2 : 1.6) + Math.random() * (2.5 + s * 2.5);
      const hue =
        Math.random() > 0.35 && palette
          ? Math.random() > 0.5
            ? palette.accent
            : palette.glow
          : SW_RAINBOW[(Math.random() * SW_RAINBOW.length) | 0];
      const local = pick.b.w * (0.25 + Math.random() * 0.5);
      skylineParty.push({
        // Strip coordinate (same space as building.x) — screen = stripX - scrollOff
        stripX: pick.stripX + local,
        y: roofY + Math.random() * 4,
        vx: Math.cos(ang) * speed + (Math.random() - 0.5) * 1.2,
        vy: Math.sin(ang) * speed - 0.5 - Math.random() * 1.8,
        scrollMul,
        loopW,
        life: 1,
        decay: kind === "hat" ? 0.022 + Math.random() * 0.02 : 0.011 + Math.random() * 0.016,
        r: kind === "kick" ? 1.6 + Math.random() * 3.4 : 1.0 + Math.random() * 2.4,
        hue,
        kind,
        spin: (Math.random() - 0.5) * 0.55,
        rot: Math.random() * Math.PI * 2,
        grav: kind === "kick" ? 0.14 : kind === "snare" ? 0.1 : 0.07,
        confetti: kind === "kick" || (kind === "snare" && Math.random() > 0.55),
      });
    }
  }
}

function skylinePartyScreenX(p) {
  const loopW = p.loopW || W * 4;
  const scroll = skylineScrollPx * (p.scrollMul || 1);
  const off = ((scroll % loopW) + loopW) % loopW;
  return p.stripX - off;
}

function updateSkylineParty(dt) {
  if (vizMode !== "skyline") {
    if (skylineParty.length) skylineParty.length = 0;
    return;
  }
  const t = dt / 16;
  for (let i = skylineParty.length - 1; i >= 0; i--) {
    const p = skylineParty[i];
    p.vy += p.grav * t;
    p.vx *= 0.992;
    // Burst moves in strip space; scroll pulls them across screen with the city
    p.stripX += p.vx * t;
    p.y += p.vy * t;
    p.rot += p.spin * t;
    p.life -= p.decay * t;
    const screenX = skylinePartyScreenX(p);
    if (p.life <= 0 || p.y > H + 30 || screenX < -60 || screenX > W + 60) {
      skylineParty.splice(i, 1);
    }
  }
}

function drawSkylineParty() {
  if (!skylineParty.length || !fxOn("sparks")) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const p of skylineParty) {
    const a = Math.max(0, p.life);
    if (a < 0.04) continue;
    const x = skylinePartyScreenX(p);
    const [cr, cg, cb] = p.hue || [69, 224, 255];
    if (p.confetti) {
      ctx.save();
      ctx.translate(x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${a * 0.9})`;
      const w = p.r * (0.9 + a * 0.5);
      const h = p.r * 0.45;
      ctx.fillRect(-w * 0.5, -h * 0.5, w, h);
      ctx.restore();
    } else {
      ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, ${a})`;
      ctx.lineWidth = Math.max(1, p.r * 0.55);
      ctx.beginPath();
      ctx.moveTo(x, p.y);
      ctx.lineTo(x - p.vx * 1.8, p.y - p.vy * 1.8);
      ctx.stroke();
      ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${a})`;
      ctx.beginPath();
      ctx.arc(x, p.y, Math.max(0.8, p.r * 0.35), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function seedSkylineCity() {
  if (!W || !H) return;
  const PATTERNS = ["grid", "sierpinski", "stripes", "columns", "diagonal", "clusters"];
  // Long seamless strip (~4.5 viewports) so the city rides across before looping.
  const fill = (arr, minH, maxH, minW, maxW, depthBias) => {
    arr.length = 0;
    let x = 0;
    const target = Math.max(W * 4.5, 3200);
    let idx = 0;
    while (x < target) {
      const seed = (idx + 1) * 17.13 + minH * 0.01 + x * 0.003;
      const w = minW + skylineRand(seed) * (maxW - minW);
      // Fractal height jitter — occasional landmark towers
      const landmark = skylineRand(seed + 0.5);
      const hSpan = maxH - minH;
      const h =
        landmark > 0.88
          ? maxH * (0.92 + skylineRand(seed + 0.6) * 0.35)
          : minH + skylineRand(seed + 0.7) * hSpan;
      const gap = 2 + skylineRand(seed + 0.8) * 16;
      const palette = skylinePickPalette(seed + 9);
      const depth = Math.max(1, Math.min(3, depthBias + (skylineRand(seed + 1.2) > 0.55 ? 1 : 0)));
      const masses = skylineFractalMasses(seed + 2.4, depth);
      const pattern = PATTERNS[(skylineRand(seed + 3.3) * PATTERNS.length) | 0];
      const windows = [];
      const cols = Math.max(2, Math.floor(w / (8 + skylineRand(seed + 4) * 4)));
      const rows = Math.max(3, Math.floor(h / (9 + skylineRand(seed + 4.5) * 5)));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (!skylineWindowPattern(pattern, r, c, rows, cols, seed)) continue;
          const v = (r + 0.35) / rows;
          const winT = (palette.winHue + r * 0.07 + c * 0.03) % SW_RAINBOW.length;
          windows.push({
            u: (c + 0.3 + skylineRand(seed + r + c * 0.1) * 0.15) / cols,
            v,
            r,
            c,
            phase: skylineRand(seed + r * 2.1 + c) * Math.PI * 2,
            band: v > 0.62 ? "bass" : v < 0.35 ? "air" : "mid",
            color: SW_RAINBOW[winT | 0],
            colorT: winT,
          });
        }
      }
      arr.push({
        x,
        w,
        h,
        windows,
        hue: skylineRand(seed + 5),
        cols,
        rows,
        eqT: 0,
        seed,
        palette,
        masses,
        pattern,
      });
      x += w + gap;
      idx++;
    }
    // Exact loop period = end of last building (no extra pad — pad caused a dead gap hitch)
    arr.loopW = Math.max(x, W + 1);
    // Stable spectrum slots along the strip — not screen-x (that only woke the left edge)
    const n = arr.length;
    for (let i = 0; i < n; i++) {
      arr[i].eqT = n <= 1 ? 0.5 : i / (n - 1);
    }
  };
  fill(skylineFar, H * 0.08, H * 0.22, 28, 70, 1);
  fill(skylineMid, H * 0.14, H * 0.34, 36, 90, 2);
  fill(skylineNear, H * 0.2, H * 0.42, 44, 110, 2);
  skylineWinLits.length = 0;
}

function drawSkylineLayer(buildings, scroll, groundY, alpha, drawWindows, bass, mid, air, peak, snare, now, layerName) {
  if (!buildings.length) return;
  const loopW = buildings.loopW || W * 4;
  const off = ((scroll % loopW) + loopW) % loopW;
  const musicHot = playing && (bass + mid + air + peak) * 0.25 > 0.06;
  const drive = FX.gridDrive || 0;
  // Near layer is the loud EQ strip; far is a quieter echo
  const eqAmp = layerName === "near" ? 1 : layerName === "mid" ? 0.72 : 0.38;
  ctx.save();
  for (let bi = 0; bi < buildings.length; bi++) {
    const b = buildings[bi];
    // Tile ±1 period so buildings straddling the wrap stay continuous
    for (let k = -1; k <= 1; k++) {
      const x = b.x - off + k * loopW;
      if (x + b.w < -4 || x > W + 4) continue;
      // Fixed silhouette — fractal masses stay put; EQ lights roofs/windows instead of stretching
      const bandEq = sampleSkylineEq(b.eqT != null ? b.eqT : 0.5);
      const shared = Math.min(1, bass * 0.55 + mid * 0.28 + peak * 0.22 + drive * 0.18);
      const eq = Math.min(1, bandEq * 0.5 + shared * 0.58 + bandEq * shared * 0.12);
      const liveH = b.h;
      const top = groundY - liveH;
      const bh = liveH;
      const pal = b.palette || {
        body: [12 + b.hue * 18, 8 + b.hue * 10, 28 + b.hue * 40],
        bodyHi: [18, 12, 40],
        accent: [255, 110, 168],
        glow: [69, 224, 255],
      };
      const masses = b.masses && b.masses.length ? b.masses : [{ u0: 0, u1: 1, v0: 0, v1: 1, shade: 0.5 }];

      ctx.globalCompositeOperation = "source-over";
      let roofY = top + bh;
      let roofX0 = x;
      let roofX1 = x + b.w;
      for (const m of masses) {
        const mx = x + m.u0 * b.w;
        const mw = Math.max(1, (m.u1 - m.u0) * b.w);
        const my = top + m.v0 * bh;
        const mh = Math.max(1, (m.v1 - m.v0) * bh);
        const shade = m.shade != null ? m.shade : 0.5;
        const br = pal.body[0] + (pal.bodyHi[0] - pal.body[0]) * shade;
        const bg = pal.body[1] + (pal.bodyHi[1] - pal.body[1]) * shade;
        const bb = pal.body[2] + (pal.bodyHi[2] - pal.body[2]) * shade;
        if (m.spire) {
          ctx.fillStyle = `rgba(${pal.accent[0]}, ${pal.accent[1]}, ${pal.accent[2]}, ${0.35 + eq * 0.4 * alpha})`;
        } else {
          ctx.fillStyle = `rgba(${br | 0}, ${bg | 0}, ${bb | 0}, ${alpha})`;
        }
        ctx.fillRect(mx, my, mw, mh);
        // Unique facade stripes / neon seams
        if (!m.spire && pal.stripe && mw > 6 && mh > 8) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(mx, my, mw, mh);
          ctx.clip();
          const gap = (pal.stripeGap || 3) * 3;
          ctx.strokeStyle = `rgba(${pal.accent[0]}, ${pal.accent[1]}, ${pal.accent[2]}, ${0.08 + eq * 0.12})`;
          ctx.lineWidth = 1;
          if (pal.stripeDir === "h") {
            for (let yy = my + gap; yy < my + mh; yy += gap) {
              ctx.beginPath();
              ctx.moveTo(mx, yy);
              ctx.lineTo(mx + mw, yy);
              ctx.stroke();
            }
          } else {
            for (let xx = mx + gap; xx < mx + mw; xx += gap) {
              ctx.beginPath();
              ctx.moveTo(xx, my);
              ctx.lineTo(xx, my + mh);
              ctx.stroke();
            }
          }
          ctx.restore();
        }
        if (my < roofY) {
          roofY = my;
          roofX0 = mx;
          roofX1 = mx + mw;
        }
      }

      // Roof lip on the tallest mass tip — building's own glow DNA
      const roofA = (0.12 + eq * 0.55 * eqAmp + air * 0.1) * alpha;
      const roofCol = eq > 0.5 ? pal.glow : pal.accent;
      ctx.fillStyle = `rgba(${roofCol[0]}, ${roofCol[1]}, ${roofCol[2]}, ${roofA})`;
      ctx.fillRect(roofX0, roofY, Math.max(1, roofX1 - roofX0), 2);
      // Soft EQ tip glow on hot bars
      if (eq > 0.28 && eqAmp > 0.5) {
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = `rgba(${pal.glow[0]}, ${pal.glow[1]}, ${pal.glow[2]}, ${eq * 0.16 * eqAmp * alpha})`;
        ctx.fillRect(roofX0, roofY - 6 - eq * 10, Math.max(1, roofX1 - roofX0), 8 + eq * 12);
        ctx.globalCompositeOperation = "source-over";
      }

      if (drawWindows && b.windows) {
        const winW = Math.max(2, (b.w / (b.cols || 4)) * 0.55);
        const winH = Math.max(2, (bh / (b.rows || 4)) * 0.45);
        ctx.globalCompositeOperation = "lighter";

        // Ambient grid — only on solid mass (no floating windows in setback air)
        for (const win of b.windows) {
          let inMass = !masses.length;
          for (const m of masses) {
            if (m.spire) continue;
            if (win.u >= m.u0 && win.u <= m.u1 && win.v >= m.v0 && win.v <= m.v1) {
              inMass = true;
              break;
            }
          }
          if (!inMass) continue;
          const band =
            win.band === "bass"
              ? bass * 1.15 + peak * 0.35
              : win.band === "air"
                ? air * 1.2 + mid * 0.35
                : mid * 1.1 + snare * 0.55;
          const tw =
            0.2 +
            0.8 *
              (0.5 +
                0.5 *
                  Math.sin(now * 0.0022 + win.phase + mid * 2.5 + bass * 1.5));
          const kickFlash = win.band === "bass" ? bass * 0.55 : 0;
          const a =
            (0.06 + band * 0.7 + drive * 0.35 + kickFlash + eq * 0.35) *
            tw *
            (musicHot ? 1 : 0.45) *
            alpha;
          if (a < 0.05) continue;
          const col =
            win.color ||
            (win.band === "bass"
              ? [240, 197, 106]
              : win.band === "air"
                ? [69, 224, 255]
                : [255, 110, 168]);
          const wx = x + win.u * b.w;
          const wy = top + win.v * bh;
          ctx.fillStyle = skylineWinFill(col, Math.min(0.95, a));
          ctx.fillRect(wx, wy, winW, winH);
        }

        // Lit flocks climbing this building
        if (fxOn("litFlocks") && layerName) {
          for (const cell of skylineWinLits) {
            if (cell.layer !== layerName || cell.bi !== bi) continue;
            const a = cell.life * cell.strength * (0.7 + drive * 0.5) * alpha;
            if (a < 0.04) continue;
            const cols = b.cols || 4;
            const rows = b.rows || 4;
            const wx = x + ((cell.c + 0.35) / cols) * b.w;
            const wy = top + ((cell.r + 0.35) / rows) * bh;
            ctx.fillStyle = skylineWinFill(cell.hue, Math.min(1, a));
            ctx.fillRect(wx - 0.5, wy - 0.5, winW + 1, winH + 1);
            // Soft halo so flocks read like lit grid squares
            ctx.fillStyle = skylineWinFill(cell.hue, Math.min(0.45, a * 0.35));
            ctx.fillRect(wx - 2, wy - 2, winW + 4, winH + 4);
          }
        }
      }
    }
  }
  ctx.restore();
}

/**
 * Skyline sun — wake, rays, kick rings, flare, music-reactive corona.
 */
function drawSkylineSun(now, bass, mid, air, peak, snare, solo, tallRoofY) {
  const pulse = fxOn("sunPulse");
  const sunX = W * 0.22;
  const beat = pulse ? bass * 0.1 + peak * 0.06 + snare * 0.04 : 0;
  const sunR = Math.min(W, H) * (0.085 + beat * 0.85) * SUN_SCALE * 0.78;
  const sunY = tallRoofY + sunR * 0.45;
  const breath = 0.5 + 0.5 * Math.sin(now * 0.0012);
  const heat = Math.min(1, bass * 0.85 + peak * 0.55 + solo * 0.35);

  // Sky cast — sun bruises the atmosphere toward the city
  ctx.save();
  const cast = ctx.createRadialGradient(sunX, sunY, sunR * 0.5, sunX, sunY, Math.max(W, H) * 0.75);
  cast.addColorStop(0, `rgba(180, 40, 55, ${0.08 + heat * 0.12})`);
  cast.addColorStop(0.35, `rgba(90, 20, 50, ${0.05 + mid * 0.06})`);
  cast.addColorStop(1, "rgba(10, 8, 20, 0)");
  ctx.fillStyle = cast;
  ctx.fillRect(0, 0, W, tallRoofY + sunR * 4);
  ctx.restore();

  // Slight cloud cover — soft bands drifting across / around the disk
  ctx.save();
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    const drift = ((now * 0.008 + i * 47 + t * 40) % (sunR * 8)) - sunR * 2;
    const cx = sunX - sunR * 1.2 + drift * 0.35 + (i - 2) * sunR * 0.55;
    const cy = sunY + Math.sin(now * 0.0004 + i * 1.3) * sunR * 0.35 + (i % 2 ? 1 : -1) * sunR * 0.15;
    const cw = sunR * (1.8 + t * 1.4 + Math.sin(now * 0.0006 + i) * 0.3);
    const ch = sunR * (0.35 + (i % 3) * 0.12);
    const cloud = ctx.createRadialGradient(cx, cy, 0, cx, cy, cw);
    const a0 = (0.1 + t * 0.04) * (0.65 + mid * 0.25 + breath * 0.1);
    cloud.addColorStop(0, `rgba(50, 28, 55, ${a0})`);
    cloud.addColorStop(0.45, `rgba(35, 20, 48, ${a0 * 0.55})`);
    cloud.addColorStop(1, "rgba(15, 10, 25, 0)");
    ctx.fillStyle = cloud;
    ctx.beginPath();
    ctx.ellipse(cx, cy, cw, ch, -0.05 + i * 0.03, 0, Math.PI * 2);
    ctx.fill();
  }
  // Thin lit undersides where the sun catches cloud edges
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 3; i++) {
    const cx = sunX + (i - 1) * sunR * 0.9 + Math.sin(now * 0.0005 + i) * sunR * 0.4;
    const cy = sunY + sunR * (0.15 + i * 0.12);
    const rim = ctx.createRadialGradient(cx, cy, 0, cx, cy, sunR * 1.4);
    rim.addColorStop(0, `rgba(255, 120, 100, ${0.05 + heat * 0.04})`);
    rim.addColorStop(0.5, `rgba(200, 70, 90, ${0.025})`);
    rim.addColorStop(1, "rgba(80, 30, 50, 0)");
    ctx.fillStyle = rim;
    ctx.beginPath();
    ctx.ellipse(cx, cy, sunR * (1.2 + i * 0.2), sunR * 0.28, 0.08, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Long god-rays — slow spin, thicken on bass
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const rayN = 10;
  const spin = now * 0.00008 + bass * 0.15;
  for (let i = 0; i < rayN; i++) {
    const ang = spin + (i / rayN) * Math.PI * 2;
    const flicker = 0.55 + 0.45 * Math.sin(now * 0.002 + i * 1.7);
    const len = sunR * (3.5 + heat * 2.5 + breath * 0.8) * (0.7 + (i % 3) * 0.2);
    const half = (0.035 + bass * 0.04 + peak * 0.02) * flicker;
    const a = (0.03 + heat * 0.07) * flicker;
    ctx.fillStyle =
      i % 2 === 0 ? `rgba(255, 120, 80, ${a})` : `rgba(255, 70, 110, ${a * 0.85})`;
    ctx.beginPath();
    ctx.moveTo(sunX, sunY);
    ctx.lineTo(sunX + Math.cos(ang - half) * len, sunY + Math.sin(ang - half) * len);
    ctx.lineTo(sunX + Math.cos(ang + half) * len, sunY + Math.sin(ang + half) * len);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Anamorphic flare streak on hits
  if (peak > 0.18 || snare > 0.3 || bass > 0.4) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const fa = 0.08 + peak * 0.22 + snare * 0.12 + bass * 0.08;
    const flare = ctx.createLinearGradient(sunX - sunR * 6, sunY, sunX + sunR * 5, sunY);
    flare.addColorStop(0, "rgba(255, 100, 80, 0)");
    flare.addColorStop(0.45, `rgba(255, 180, 120, ${fa * 0.55})`);
    flare.addColorStop(0.5, `rgba(255, 240, 200, ${fa})`);
    flare.addColorStop(0.55, `rgba(255, 110, 160, ${fa * 0.5})`);
    flare.addColorStop(1, "rgba(120, 40, 80, 0)");
    ctx.fillStyle = flare;
    ctx.fillRect(sunX - sunR * 6, sunY - 1.5 - peak * 2, sunR * 11, 3 + peak * 4);
    ctx.restore();
  }

  // Bruised corona
  const glowR = sunR * (3.8 + heat * 1.2);
  const sunGlow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, glowR);
  sunGlow.addColorStop(0, `rgba(255, 160, 90, ${0.32 + heat * 0.28})`);
  sunGlow.addColorStop(0.22, `rgba(220, 55, 75, ${0.22 + mid * 0.14})`);
  sunGlow.addColorStop(0.5, `rgba(100, 25, 70, ${0.14 + solo * 0.1})`);
  sunGlow.addColorStop(1, "rgba(20, 10, 30, 0)");
  ctx.fillStyle = sunGlow;
  ctx.beginPath();
  ctx.arc(sunX, sunY, glowR, 0, Math.PI * 2);
  ctx.fill();

  // Soft gold halo — quiet breath, not pulsing shock rings
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = `rgba(255, 140, 100, ${0.1 + heat * 0.14 + breath * 0.05})`;
  ctx.lineWidth = 1.5 + bass * 1.5;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR * (1.2 + bass * 0.08), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Disk — deep ember core, blood rim; core brightens on kick
  const coreBoost = 0.15 + bass * 0.35 + peak * 0.2;
  const sunDisk = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR);
  sunDisk.addColorStop(0, `rgb(${255}, ${224 + coreBoost * 30}, ${168 + coreBoost * 40})`);
  sunDisk.addColorStop(0.3, "#ff8a4a");
  sunDisk.addColorStop(0.65, "#e04560");
  sunDisk.addColorStop(1, "#6a1840");
  ctx.fillStyle = sunDisk;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();

  // Hot speckles on the face (subtle turbulence)
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR * 0.92, 0, Math.PI * 2);
  ctx.clip();
  for (let i = 0; i < 14; i++) {
    const a = now * 0.0007 + i * 2.3;
    const pr = sunR * (0.15 + (i % 5) * 0.12);
    const px = sunX + Math.cos(a + i) * pr * (0.4 + 0.5 * Math.sin(now * 0.001 + i));
    const py = sunY + Math.sin(a * 1.3 + i) * pr * 0.55;
    ctx.fillStyle = `rgba(255, 220, 160, ${0.04 + heat * 0.06})`;
    ctx.beginPath();
    ctx.arc(px, py, 1.5 + (i % 3), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Petals after the disk — wedges sit on top and blend the sun into the sky
  if (fxOn("sunPetals")) {
    const energy = Math.max(0, solo * 0.9 + mid * 0.28 - 0.1);
    if (energy >= 0.05) {
      const rInner = sunR * (0.95 + energy * 0.08);
      const rOuter = sunR * (1.55 + energy * 1.35);
      const petals = 8;
      const open = 0.32 + energy * 0.48;
      const rot = now * 0.00012 * (0.35 + energy) + solo * 0.55;
      const alpha = Math.min(0.55, 0.1 + energy * 0.45);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.translate(sunX, sunY);
      ctx.rotate(rot);
      for (let i = 0; i < petals; i++) {
        const slot = (Math.PI * 2) / petals;
        const a0 = i * slot + slot * (1 - open) * 0.5;
        const a1 = a0 + slot * open;
        const hueT = i / petals + solo * 0.08 + now * 0.00002;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a0) * rInner, Math.sin(a0) * rInner);
        ctx.arc(0, 0, rOuter, a0, a1, false);
        ctx.lineTo(Math.cos(a1) * rInner, Math.sin(a1) * rInner);
        ctx.arc(0, 0, rInner, a1, a0, true);
        ctx.closePath();
        const grad = ctx.createRadialGradient(0, 0, rInner * 0.4, 0, 0, rOuter);
        grad.addColorStop(0, synthRainbow(hueT, alpha * 0.35));
        grad.addColorStop(0.45, synthRainbow(hueT + 0.12, alpha * 0.7));
        grad.addColorStop(0.82, synthRainbow(hueT + 0.22, alpha * 0.35));
        grad.addColorStop(1, synthRainbow(hueT + 0.3, 0));
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = synthRainbow(hueT + 0.18, alpha * 0.45);
        ctx.lineWidth = 1 + energy * 1.2;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(0, 0, rInner * (0.92 + energy * 0.08), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 220, 180, ${0.08 + energy * 0.2})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();
    }
  }
}

/**
 * Classic side-view highway + skyline strip — flat parallax, no vanish grid.
 */
function drawSkyline(now, bass, mid, air, peak, snare, hat, solo) {
  updateSkylineEq(now);
  const roadTop = H * 0.62;
  // Buildings plant flush on the highway shoulder (no floating gap)
  const groundY = roadTop;
  // Tallest near-layer roofs (~0.42H) — sun peeks over, not fully above
  const tallRoofY = groundY - H * 0.42;
  // Soft kick bob — road / dashes only (buildings stay fixed height)
  skylineKickBob = smooth(skylineKickBob, bass * 5 + snare * 2, 0.22);
  const bob = skylineKickBob;
  // Faster than the first cruise, calmer than full warp
  const driveTarget = 1.05 + FX.gridDrive * 1.9 + bass * 1.05 + mid * 0.5 + peak * 0.28;
  skylineDriveSmooth = smooth(skylineDriveSmooth, driveTarget, 0.11);
  const dt = Math.min(33, PERF.emaDt || 16.7);
  // Continuous px scroll only — do NOT add FX.gridScroll (it wraps 0→1 and jumps)
  skylineScrollPx += skylineDriveSmooth * (dt / 16.7) * SKYLINE_SCROLL_RATE;
  const scroll = skylineScrollPx;

  // Sky down to the road line
  const g = ctx.createLinearGradient(0, 0, 0, groundY);
  g.addColorStop(0, "#04070f");
  g.addColorStop(0.55, `rgb(${10 + bass * 20}, ${12 + mid * 16}, ${32 + bass * 28})`);
  g.addColorStop(1, "#0a1524");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, groundY + 2);

  // Sparse stars (slow drift vs city — depth cue for speed)
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const nStars = 48;
  for (let i = 0; i < nStars; i++) {
    const sx = ((i * 97 + scroll * 0.055) % W + W) % W;
    const sy = ((i * 53) % Math.max(1, groundY * 0.55));
    const a = 0.15 + air * 0.45 * (0.5 + 0.5 * Math.sin(now * 0.0015 + i));
    ctx.fillStyle = `rgba(200, 230, 255, ${a})`;
    ctx.fillRect(sx, sy, 1.5, 1.5);
  }
  ctx.restore();

  // Sun behind skyline — ominous, music-reactive presence
  drawSkylineSun(now, bass, mid, air, peak, snare, solo, tallRoofY);

  // Horizon haze along the road / building feet
  const haze = ctx.createLinearGradient(0, groundY - 18, 0, groundY + 8);
  haze.addColorStop(0, "rgba(69, 224, 255, 0)");
  haze.addColorStop(0.6, `rgba(255, 110, 168, ${0.15 + solo * 0.2})`);
  haze.addColorStop(1, "rgba(69, 224, 255, 0)");
  ctx.fillStyle = haze;
  ctx.fillRect(0, groundY - 18, W, 28);

  // Parallax — near faster than far, without the warp-speed scream
  drawSkylineLayer(skylineFar, scroll * 0.18, groundY, 0.55, false, bass, mid, air, peak, snare, now, "far");
  drawSkylineLayer(skylineMid, scroll * 0.5, groundY, 0.72, true, bass, mid, air, peak, snare, now, "mid");
  drawSkylineLayer(skylineNear, scroll * 1.0, groundY, 0.92, true, bass, mid, air, peak, snare, now, "near");

  // Highway band
  const roadH = H - roadTop;
  const roadGrad = ctx.createLinearGradient(0, roadTop, 0, H);
  roadGrad.addColorStop(0, "#0a1220");
  roadGrad.addColorStop(0.2, "#121a2c");
  roadGrad.addColorStop(1, "#050814");
  ctx.fillStyle = roadGrad;
  ctx.fillRect(0, roadTop, W, roadH);

  // Shoulder glow
  ctx.fillStyle = `rgba(69, 224, 255, ${0.06 + bass * 0.08})`;
  ctx.fillRect(0, roadTop, W, 3);
  ctx.fillStyle = `rgba(255, 110, 168, ${0.05 + mid * 0.07})`;
  ctx.fillRect(0, roadTop + 3, W, 2);

  // Lane dashes — slightly ahead of near towers (1.0) so the road leads
  const laneY = roadTop + roadH * 0.42;
  const dashW = 32;
  const gap = 30;
  const period = dashW + gap;
  const dashOff = ((scroll * 1.1) % period + period) % period;
  ctx.strokeStyle = `rgba(240, 197, 106, ${0.5 + peak * 0.4})`;
  ctx.lineWidth = 3;
  ctx.setLineDash([dashW, gap]);
  // Positive offset = dashes travel left with the skyline (path is L→R)
  ctx.lineDashOffset = dashOff;
  ctx.beginPath();
  ctx.moveTo(-period, laneY + bob * 0.15);
  ctx.lineTo(W + period, laneY + bob * 0.15);
  ctx.stroke();
  ctx.setLineDash([]);

  // Edge lines
  ctx.strokeStyle = `rgba(159, 217, 255, ${0.25 + hat * 0.3})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, roadTop + roadH * 0.12);
  ctx.lineTo(W, roadTop + roadH * 0.12);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, roadTop + roadH * 0.78);
  ctx.lineTo(W, roadTop + roadH * 0.78);
  ctx.stroke();

  // Kick flash on asphalt
  if (bass > 0.35 || snare > 0.4) {
    ctx.fillStyle = `rgba(255, 110, 168, ${(bass * 0.08 + snare * 0.06) * peak})`;
    ctx.fillRect(0, roadTop, W, roadH * 0.5);
  }

  // Motion streaks — present, not a blizzard
  {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const speedFeel = 0.3 + Math.min(1, skylineDriveSmooth / 4.5);
    const streaksN = 7 + Math.floor(peak * 10 + mid * 4);
    for (let i = 0; i < streaksN; i++) {
      const y = roadTop + 6 + ((i * 37 + now * 0.035) % (roadH * 0.75));
      const len = 55 + peak * 95 + mid * 40 + speedFeel * 28;
      const streakPeriod = W + len;
      const x =
        ((((i * 113 - scroll * 3.2) % streakPeriod) + streakPeriod) % streakPeriod) - len;
      ctx.strokeStyle = `rgba(69, 224, 255, ${0.06 + peak * 0.2 + speedFeel * 0.05})`;
      ctx.lineWidth = 1.25 + peak * 0.8;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + len, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Rooftop party — kicks spill into the night
  drawSkylineParty();
}

function drawNightDrive(now, bass, mid, air, peak, snare, hat, solo) {
  updateCamera(now, bass, mid, air, peak, snare);
  applyWorldTransform();

  drawSky(now, bass, mid);
  drawStars(now, air, mid, solo, bass);
  if (fxOn("harmonyConstellation")) drawHarmonyConstellation(bass, solo);
  if (fxOn("shootingStars")) drawShootingStars(bass, solo);
  if (fxOn("soloAurora")) drawSoloAurora(solo, air);
  if (fxOn("cloudDeck")) drawCloudDeck(now);
  if (fxOn("melodyThread")) drawMelodyThread();
  if (fxOn("sunPetals")) drawSunPetals(now, mid, solo);
  drawSoftSun(bass, mid, solo);
  drawHeartbeatRing(bass, mid);
  drawUsPresence(bass, mid, air);
  if (fxOn("chordHalos")) drawChordHalos();
  if (fxOn("hammerRipples")) drawHammerRipples();
  if (fxOn("shockRings")) drawShocks();
  if (fxOn("horizonRibbons")) drawHorizonRibbons(now, bass, mid, solo);
  drawHorizon(bass);
  if (fxOn("bassMountain")) drawBassMountain(bass);
  if (fxOn("mirrorSea")) drawMirrorSea();
  drawSea(now, bass, mid, air);
  if (fxOn("quasarJets")) drawQuasarJets(now, bass, mid, solo);
  if (fxOn("sunFlares")) drawSunFlares(now, peak, solo, bass);
  if (fxOn("mistSheets")) drawMistSheets(now, mid);
  if (fxOn("rain")) drawRain(mid);
  if (fxOn("fog")) drawFog(now, bass);
  if (fxOn("dew")) drawDew(now, air, mid);
  if (fxOn("sparks")) drawSparks(bass, solo);
  if (fxOn("streaks")) drawStreaks();

  resetScreenTransform();
}

function frame(now) {
  raf = requestAnimationFrame(frame);
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

  if (vizMode === "skyline") {
    resetScreenTransform();
    drawSkyline(now, bass, mid, air, peak, snare, hat, solo);
  } else {
    drawNightDrive(now, bass, mid, air, peak, snare, hat, solo);
  }

  drawVignette();
  updateMeters(bass, mid, air);
}

function onKey(e) {
  if (e.code === "Space") {
    e.preventDefault();
    if (sourceMode === "system") {
      stopSystemListen();
    } else if (!started) {
      start();
    } else {
      toggle();
    }
  } else if (e.code === "Enter" && !started) {
    e.preventDefault();
    start();
  } else if (e.code === "KeyR") {
    e.preventDefault();
    restart();
  } else if (e.code === "KeyO") {
    e.preventDefault();
    filePick.click();
  } else if (e.code === "KeyS" && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    startSystemListen();
  } else if (e.code === "KeyH") {
    e.preventDefault();
    toggleUiHidden();
  } else if (e.code === "KeyF") {
    e.preventDefault();
    toggleFxPanelHidden();
  } else if (e.code === "KeyV") {
    e.preventDefault();
    FX_TOGGLES.whipVerticals = !FX_TOGGLES.whipVerticals;
    WHIP_VERTICALS = FX_TOGGLES.whipVerticals;
    const box = document.querySelector('input[data-fx="whipVerticals"]');
    if (box) box.checked = FX_TOGGLES.whipVerticals;
    statusEl.textContent = FX_TOGGLES.whipVerticals
      ? "whip verticals on (V / Effects panel)"
      : "whip verticals off";
  }
}

function onDragOver(e) {
  e.preventDefault();
  stage.classList.add("dragover");
}

function onDragLeave(e) {
  if (e.target === stage || !stage.contains(e.relatedTarget)) {
    stage.classList.remove("dragover");
  }
}

function onDrop(e) {
  e.preventDefault();
  stage.classList.remove("dragover");
  const file = e.dataTransfer?.files?.[0];
  if (file) loadFile(file);
}

resize();
seedWorld();
setTrackTitle(null);
loadBuildStamp();
window.addEventListener("resize", resize);
playBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  filePick?.click();
});
systemPlayBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  startSystemListen(e);
});
systemChromeBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  startSystemListen(e);
});
toggleBtn.addEventListener("click", toggle);
restartBtn.addEventListener("click", restart);
hideUiBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleUiHidden();
});
uiPeek?.addEventListener("click", (e) => {
  e.stopPropagation();
  setUiHidden(false);
});

const fxPanel = document.getElementById("fx-panel");
const fxPanelCollapse = document.getElementById("fx-panel-collapse");
const fxPanelHide = document.getElementById("fx-panel-hide");
const fxPeek = document.getElementById("fx-peek");
const fxPanelDrag = document.getElementById("fx-panel-drag");

fxPanelCollapse?.addEventListener("click", (e) => {
  e.stopPropagation();
  fxPanel?.classList.toggle("collapsed");
  fxPanelCollapse.textContent = fxPanel?.classList.contains("collapsed") ? "+" : "−";
});
fxPanelHide?.addEventListener("click", (e) => {
  e.stopPropagation();
  setFxPanelHidden(true);
});
fxPeek?.addEventListener("click", (e) => {
  e.stopPropagation();
  setFxPanelHidden(false);
});
fxPanel?.addEventListener("click", (e) => e.stopPropagation());

// Drag FX panel by the title bar
if (fxPanel && fxPanelDrag) {
  let drag = null;
  fxPanelDrag.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button")) return;
    e.preventDefault();
    const rect = fxPanel.getBoundingClientRect();
    drag = {
      id: e.pointerId,
      ox: e.clientX - rect.left,
      oy: e.clientY - rect.top,
    };
    fxPanelDrag.setPointerCapture(e.pointerId);
    fxPanel.classList.add("dragging");
    fxPanel.style.left = `${rect.left}px`;
    fxPanel.style.top = `${rect.top}px`;
    fxPanel.style.bottom = "auto";
    fxPanel.style.right = "auto";
  });
  fxPanelDrag.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const maxX = Math.max(8, window.innerWidth - fxPanel.offsetWidth - 8);
    const maxY = Math.max(8, window.innerHeight - fxPanel.offsetHeight - 8);
    const x = Math.min(maxX, Math.max(8, e.clientX - drag.ox));
    const y = Math.min(maxY, Math.max(8, e.clientY - drag.oy));
    fxPanel.style.left = `${x}px`;
    fxPanel.style.top = `${y}px`;
  });
  const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    fxPanel.classList.remove("dragging");
    try {
      fxPanelDrag.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };
  fxPanelDrag.addEventListener("pointerup", endDrag);
  fxPanelDrag.addEventListener("pointercancel", endDrag);
}

for (const input of document.querySelectorAll("#fx-panel input[data-fx]")) {
  const key = input.dataset.fx;
  if (!key || !(key in FX_TOGGLES)) continue;
  input.checked = !!FX_TOGGLES[key];
  input.addEventListener("change", () => {
    FX_TOGGLES[key] = input.checked;
    if (key === "whipVerticals") WHIP_VERTICALS = input.checked;
    if (key === "litFlocks" && !input.checked) {
      gridCells.length = 0;
      gridTrails.length = 0;
      skylineWinLits.length = 0;
    }
    if (key === "sparks" && !input.checked) {
      sparks.length = 0;
      skylineParty.length = 0;
    }
    if (key === "constellationTrails" && !input.checked) gridTrails.length = 0;
    if (key === "vanishingMeteors" && !input.checked) meteors.length = 0;
    if (key === "mirrorSea" && !input.checked) mirrorCells.length = 0;
    if (key === "gridHeartbeat" && !input.checked) heartbeats.length = 0;
    if (key === "horizonBloom" && !input.checked) bloomRings.length = 0;
    if (key === "blackHole" && !input.checked) {
      // Leave child toggles armed so turning Black hole back on is one click
      infalls.length = 0;
    }
    syncFxDependencies();
  });
}
syncFxDependencies();

const sunScaleSlider = document.getElementById("fx-sun-scale");
const sunScaleVal = document.getElementById("fx-sun-scale-val");
function applySunScale(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return;
  SUN_SCALE = Math.min(SUN_SCALE_MAX, Math.max(SUN_SCALE_MIN, n));
  if (sunScaleSlider) sunScaleSlider.value = String(SUN_SCALE);
  if (sunScaleVal) sunScaleVal.textContent = SUN_SCALE.toFixed(2);
}
if (sunScaleSlider) {
  applySunScale(sunScaleSlider.value);
  sunScaleSlider.addEventListener("input", () => applySunScale(sunScaleSlider.value));
}

filePick.addEventListener("change", () => {
  const file = filePick.files?.[0];
  if (file) loadFile(file);
  filePick.value = "";
});
filePick.addEventListener("click", (e) => e.stopPropagation());

document.querySelectorAll("[data-viz]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const mode = btn.getAttribute("data-viz");
    if (mode === "skyline" || mode === "nightDrive") setVizMode(mode);
  });
});
vizSwitchBtn?.addEventListener("click", () => {
  setVizMode(vizMode === "skyline" ? "nightDrive" : "skyline");
});
syncVizModeUi();

window.addEventListener("keydown", onKey);
window.addEventListener("dragover", onDragOver);
window.addEventListener("dragleave", onDragLeave);
window.addEventListener("drop", onDrop);

raf = requestAnimationFrame(frame);
statusEl.textContent = "waiting…";
