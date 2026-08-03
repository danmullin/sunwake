/**
 * Grid / sea — flocks, meteors, mirror sea, bass mountain, drawSea.
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


let streakDir = 0;
function isSeaDrive() { return vizMode === "nightDrive" || vizMode === "rainDrive"; }

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
    // Dense snare rolls fill the cap ΓÇö recycle oldest so the grid never goes dark
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

function spawnGridCells(n, opts = {}) {
  if (!fxOn("litFlocks") || n <= 0 || !playing) return;
  const flockSize = Math.max(5, Math.min(12, n));
  spawnGridFlock(flockSize, opts);
  // Always fan out 1ΓÇô2 more flocks across the grid on a hit
  const extras = 1 + (n >= 6 ? 1 : 0);
  for (let i = 0; i < extras; i++) {
    spawnGridFlock(4 + Math.floor(Math.random() * 5), {
      ...opts,
      row: Math.floor(4 + Math.random() * (GRID_ROWS - 7)),
      col: Math.floor(1 + Math.random() * (GRID_COLS - 3)),
    });
  }
}

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
    // Night-drive palette: violet ΓåÆ pink ΓåÆ coral ΓåÆ gold ΓåÆ cyan ΓåÆ electric blue
    hueT: opts.hueT != null ? opts.hueT : Math.random(),
    width: 1.1 + Math.random() * 1.6,
  });
}

function spawnVanishingMeteors(n, opts = {}) {
  const count = Math.max(1, Math.min(n, 6));
  for (let i = 0; i < count; i++) spawnVanishingMeteor(opts);
}

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
  // Invert across the horizon ΓÇö reflection that shouldn't exist
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

  // 0 near the sun disk ΓåÆ 1 out on the flanks (lets the sun shine through center)
  const sunWindow = (x, y) => {
    const d = Math.hypot(x - sunX, y - sunY) / (sunR * 1.85);
    if (d <= 0.45) return 0.42;
    if (d >= 1.15) return 1;
    return 0.42 + ((d - 0.45) / 0.7) * 0.58;
  };

  ctx.save();

  // Neon EQ bars ΓÇö full night-drive palette, tips soft so the sun still bleeds through
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

    // Tip ΓåÆ body ΓåÆ footing, all synthwave hues (violetΓåÆpinkΓåÆcoralΓåÆgoldΓåÆcyanΓåÆblue)
    const fill = ctx.createLinearGradient(0, yTop, 0, yBot);
    fill.addColorStop(0, synthRainbow(hue + 0.22, (0.12 + h * 0.18) * win));
    fill.addColorStop(0.28, synthRainbow(hue + 0.08, (0.28 + h * 0.32) * win));
    fill.addColorStop(0.62, synthRainbow(hue, (0.38 + h * 0.35) * win));
    fill.addColorStop(1, synthRainbow(hue - 0.12, (0.22 + h * 0.2) * win));
    ctx.fillStyle = fill;
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";

  // Neon crest ΓÇö rainbow skim along the skyline
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
    // Water mirror of the sun ΓÇö pinned just under the horizon (not chasing sun scale down the sea)
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

  // Waving perspective grid ΓÇö ribbon energy falling into the distance
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

  // Doorway starfield ΓÇö deeper night through the parted shutters
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

  // Curved quads ΓÇö sample edges so fills ride the same waves as the strokes.
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

  // Horizon bloom rings ΓÇö snare trapezoids hopping row-by-row toward the camera
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
    // One polyline per row ΓÇö avoids thousands of stroke() calls
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

  // Soft fog banks between grid rows ΓÇö continuous ribbons (no hard skip pops)
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

  // Grid heartbeat ECG ΓÇö QRS crawls a mid-row on kicks
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
          // Twin stroke ΓÇö classic pink/cyan grid language
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

  // Vanishing-point meteors ΓÇö race down the verticals from the sun
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


export {
  spawnGridFlock, stepGridCell, spawnGridCells,
  spawnVanishingMeteor, spawnVanishingMeteors,
  spawnGridHeartbeat, spawnHorizonBloom, spawnMirrorSea,
  mirrorMeshPoint, drawMirrorSea,
  bassMountainProfile, updateBassMountain, drawBassMountain,
  gridMusicEnergy, gridMusicHot,
  drawHorizon, drawSea,
};
