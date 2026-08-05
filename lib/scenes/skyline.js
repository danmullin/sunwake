import {
  ctx, W, H, t0, fxOn, FX,
  skylineFar, skylineMid, skylineNear,
  skylineKickBob, setSkylineKickBob, skylineScrollPx, setSkylineScrollPx,
  skylineDriveSmooth, setSkylineDriveSmooth, SKYLINE_SCROLL_RATE,
  skylineWinLits, SKYLINE_WIN_MAX, SKYLINE_WIN_STEP_MS,
  skylineParty, SKYLINE_PARTY_MAX, SKYLINE_EQ_N, skylineEq,
  gridCells, gridTrails, stars, stormClouds, rainSplashes, lightningBolts, stormFlash,
  levels, playing, freq, SUN_SCALE, vizMode,
} from "../state.js";
import { SW_RAINBOW, synthRainbow, smooth, swapRemove } from "../math.js";
import { PERF, sparkCap } from "../perf.js";
import { vanishX, applyWorldTransform, resetScreenTransform } from "../camera.js";
import { sunAnchor, sunDiskRadius, sunYFrac, drawInfallSparks } from "../effects/sun.js";
import { drawSky, drawStars, drawSoloAurora, drawShootingStars, spawnShootingStar } from "../effects/sky.js";
import {
  drawSparks, drawStreaks, drawShocks, drawChordHalos, drawHammerRipples,
  spawnSpark, spawnStreak, spawnShock,
} from "../effects/impactSparks.js";
import { drawMelodyThread, drawHarmonyConstellation } from "../effects/melody.js";
import {
  drawBassMountain, drawMirrorSea, spawnGridCells,
  spawnVanishingMeteors, spawnGridHeartbeat, spawnHorizonBloom, spawnMirrorSea,
} from "../effects/gridSea.js";
import { updateMeters } from "../simulation.js";
import { VizScene } from "./base.js";

function skylineWinFill(hue, a) {
  if (Array.isArray(hue)) return `rgba(${hue[0]}, ${hue[1]}, ${hue[2]}, ${a})`;
  if (hue === "gold") return `rgba(240, 197, 106, ${a})`;
  if (hue === "pink") return `rgba(255, 110, 168, ${a})`;
  return `rgba(69, 224, 255, ${a})`;
}

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

  // Diffused body — layered soft glows, no hard yolk edge
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  // Wide atmospheric bloom
  const bloomR = sunR * (5.2 + heat * 1.6);
  const bloom = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, bloomR);
  bloom.addColorStop(0, `rgba(255, 170, 110, ${0.22 + heat * 0.2})`);
  bloom.addColorStop(0.2, `rgba(230, 80, 90, ${0.14 + mid * 0.1})`);
  bloom.addColorStop(0.45, `rgba(120, 40, 80, ${0.08 + solo * 0.06})`);
  bloom.addColorStop(1, "rgba(30, 12, 28, 0)");
  ctx.fillStyle = bloom;
  ctx.beginPath();
  ctx.arc(sunX, sunY, bloomR, 0, Math.PI * 2);
  ctx.fill();

  // Mid haze shell
  const hazeR = sunR * (2.4 + heat * 0.5);
  const hazeG = ctx.createRadialGradient(sunX, sunY, sunR * 0.15, sunX, sunY, hazeR);
  hazeG.addColorStop(0, `rgba(255, 200, 140, ${0.35 + heat * 0.25})`);
  hazeG.addColorStop(0.35, `rgba(255, 120, 90, ${0.22 + bass * 0.12})`);
  hazeG.addColorStop(0.7, `rgba(200, 60, 90, ${0.1})`);
  hazeG.addColorStop(1, "rgba(80, 20, 50, 0)");
  ctx.fillStyle = hazeG;
  ctx.beginPath();
  ctx.arc(sunX, sunY, hazeR, 0, Math.PI * 2);
  ctx.fill();

  // Soft core — feathered to transparent (not a solid disk)
  const coreBoost = 0.15 + bass * 0.35 + peak * 0.2;
  const coreR = sunR * 1.35;
  const core = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, coreR);
  core.addColorStop(0, `rgba(255, ${230 + coreBoost * 20}, ${190 + coreBoost * 25}, ${0.85 + coreBoost * 0.1})`);
  core.addColorStop(0.25, `rgba(255, 180, 100, ${0.55 + heat * 0.15})`);
  core.addColorStop(0.5, `rgba(240, 90, 90, ${0.28 + heat * 0.1})`);
  core.addColorStop(0.75, `rgba(180, 50, 80, ${0.1})`);
  core.addColorStop(1, "rgba(80, 20, 40, 0)");
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(sunX, sunY, coreR, 0, Math.PI * 2);
  ctx.fill();

  // Quiet outer breath ring (very soft)
  ctx.strokeStyle = `rgba(255, 150, 110, ${0.06 + heat * 0.1 + breath * 0.04})`;
  ctx.lineWidth = 6 + bass * 4;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR * (1.55 + bass * 0.1), 0, Math.PI * 2);
  ctx.stroke();

  // Soft face shimmer inside the glow (no hard clip)
  for (let i = 0; i < 10; i++) {
    const a = now * 0.0007 + i * 2.3;
    const pr = sunR * (0.2 + (i % 4) * 0.1);
    const px = sunX + Math.cos(a + i) * pr * (0.35 + 0.4 * Math.sin(now * 0.001 + i));
    const py = sunY + Math.sin(a * 1.3 + i) * pr * 0.45;
    ctx.fillStyle = `rgba(255, 230, 180, ${0.03 + heat * 0.04})`;
    ctx.beginPath();
    ctx.arc(px, py, 2 + (i % 3), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Petals after the glow — wedges sit on the diffused light
  if (fxOn("sunPetals")) {
    const energy = Math.max(0, solo * 0.9 + mid * 0.28 - 0.1);
    if (energy >= 0.05) {
      const rInner = sunR * (0.55 + energy * 0.15);
      const rOuter = sunR * (1.85 + energy * 1.45);
      const petals = 8;
      const open = 0.32 + energy * 0.48;
      const rot = now * 0.00012 * (0.35 + energy) + solo * 0.55;
      const alpha = Math.min(0.5, 0.08 + energy * 0.4);
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
        const grad = ctx.createRadialGradient(0, 0, rInner * 0.2, 0, 0, rOuter);
        grad.addColorStop(0, synthRainbow(hueT, alpha * 0.25));
        grad.addColorStop(0.4, synthRainbow(hueT + 0.12, alpha * 0.55));
        grad.addColorStop(0.8, synthRainbow(hueT + 0.22, alpha * 0.28));
        grad.addColorStop(1, synthRainbow(hueT + 0.3, 0));
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = synthRainbow(hueT + 0.18, alpha * 0.3);
        ctx.lineWidth = 1 + energy;
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}

function drawSkyline(now, bass, mid, air, peak, snare, hat, solo) {
  updateSkylineEq(now);
  const roadTop = H * 0.62;
  // Buildings plant flush on the highway shoulder (no floating gap)
  const groundY = roadTop;
  // Tallest near-layer roofs (~0.42H) — sun peeks over, not fully above
  const tallRoofY = groundY - H * 0.42;
  // Soft kick bob — road / dashes only (buildings stay fixed height)
  setSkylineKickBob(smooth(skylineKickBob, bass * 5 + snare * 2, 0.22));
  const bob = skylineKickBob;
  // Faster than the first cruise, calmer than full warp
  const driveTarget = 1.05 + FX.gridDrive * 1.9 + bass * 1.05 + mid * 0.5 + peak * 0.28;
  setSkylineDriveSmooth(smooth(skylineDriveSmooth, driveTarget, 0.11));
  const dt = Math.min(33, PERF.emaDt || 16.7);
  // Continuous px scroll only — do NOT add FX.gridScroll (it wraps 0→1 and jumps)
   setSkylineScrollPx(skylineScrollPx + skylineDriveSmooth * (dt / 16.7) * SKYLINE_SCROLL_RATE); 
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

/** Side-scrolling city skyline — flat parallax, no vanish grid. */
export class SkylineScene extends VizScene {
  draw(now, levels, fx) {
    const { bass, mid, air, peak, snare, hat } = levels;
    drawSkyline(now, bass, mid, air, peak, snare, hat, fx.solo ?? 0);
  }
}

export {
  seedSkylineCity,
  skylineLayerByName,
  updateSkylineEq, sampleSkylineEq,
  spawnSkylineWinFlock, spawnSkylineWinCells,
  updateSkylineWinLits, spawnSkylineParty, updateSkylineParty,
  drawSkylineParty, drawSkylineLayer, drawSkylineSun, drawSkyline,
};
