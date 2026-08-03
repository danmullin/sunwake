/**
 * Particles + atmosphere draw helpers + world seed.
 */
import {
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

import { seedStormClouds } from "./storm.js";
import {
  setStormFlash, setLastLightningAt, setArcadeFlash, setArcadeWarp,
  rainSplashes, lightningBolts,
} from "./state.js";

// Arcade seed registered from boot — avoids particles ↔ arcade cycle
let _seedArcadeStars = () => {};
export function setParticleSeedHooks(arcadeSeed) {
  _seedArcadeStars = arcadeSeed || (() => {});
}

let streakDir = 0;
function isSeaDrive() { return vizMode === "nightDrive" || vizMode === "rainDrive"; }

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

function updateMelodyThread(now, leadPitch, mid, solo) {
  if (!fxOn("melodyThread")) {
    if (melodyThread.length) melodyThread.length = 0;
    FX.melodyPresence = 0;
    return;
  }

  const energy = Math.max(mid * 1.05, solo * 0.95, FX.sustain * 0.7, FX.chord * 0.45);
  const want = playing && energy > 0.035 ? Math.min(1, energy * 1.35) : 0;
  // Rise fast, fall slow ΓÇö so the ribbon doesn't blink out between notes
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

  // Steady leftward crawl ΓÇö trail lasts ~2s across the sky
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

function spawnInfall(strength = 0.5) {
  if (!fxOn("infallSparks") || !fxOn("blackHole")) return;
  if (infalls.length >= INFALL_MAX) return;
  const n = Math.min(5, 1 + Math.floor(strength * 4));
  for (let i = 0; i < n; i++) {
    if (infalls.length >= INFALL_MAX) break;
    infalls.push({
      ang: Math.random() * Math.PI * 2,
      // Multiples of event-horizon radius ΓÇö spiral in from the disc zone
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
    // Start outside the silhouette ΓÇö close enough that the dive reads quickly
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
  // Soft underglow ΓÇö whole path
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
  // Leading tip ΓÇö always readable when the thread is alive
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
  // Always opaque replace — a leaked "lighter" here blooms the whole frame white
  ctx.globalCompositeOperation = "source-over";
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
  if (density < 0.1 && vizMode !== "rainDrive") return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  const storm = vizMode === "rainDrive";
  const visible = storm ? 0.55 + density * 0.85 : 0.25 + density * 0.9;
  for (const d of rain) {
    const a = d.a * visible * (storm ? 1.15 : 1);
    if (a < 0.04) continue;
    const x = d.x * W;
    const y = d.y * H;
    const len = d.len * H * (storm ? 1.35 : 1);
    ctx.strokeStyle = storm
      ? `rgba(160, 210, 255, ${Math.min(0.85, a)})`
      : `rgba(180, 220, 255, ${a})`;
    ctx.lineWidth = storm ? 1.15 : 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len * (storm ? 0.55 : 0.35), y + len);
    ctx.stroke();
  }
  // Extra sheet of fine drizzle in Rain Drive
  if (storm) {
    for (let i = 0; i < 40; i++) {
      const x = ((i * 97 + density * 40) % 100) / 100 * W;
      const y = ((i * 53 + performance.now() * 0.08) % 100) / 100 * H;
      const len = H * (0.008 + (i % 5) * 0.003);
      ctx.strokeStyle = `rgba(140, 190, 230, ${0.08 + density * 0.12})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + len * 0.6, y + len);
      ctx.stroke();
    }
  }
  ctx.restore();
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
  // soft ring around center ΓÇö pulse while listening
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


function seedWorld() {
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
  rainSplashes.length = 0;
  setStormFlash(0);
  setLastLightningAt(0);
  lightningBolts.length = 0;
  seedStormClouds();
  _seedArcadeStars();
  setArcadeFlash(0);
  setArcadeWarp(0);
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

  for (let i = 0; i < 160; i++) {
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
