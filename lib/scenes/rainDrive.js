import {
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

function seedStormClouds() {
  stormClouds.length = 0;
  // Dense overcast — overlapping soft masses so the sky reads cloudy, not starry
  for (let i = 0; i < 22; i++) {
    const band = i < 8 ? 0 : i < 15 ? 1 : 2;
    stormClouds.push({
      x: (i * 0.13 + Math.random() * 0.08) % 1.2 - 0.1,
      y: band === 0 ? 0.02 + Math.random() * 0.1 : band === 1 ? 0.1 + Math.random() * 0.12 : 0.2 + Math.random() * 0.14,
      w: 0.34 + Math.random() * 0.48,
      h: 0.09 + Math.random() * 0.12,
      drift: (Math.random() - 0.5) * (0.0001 + band * 0.00003),
      alpha: 0.32 + Math.random() * 0.28 + (2 - band) * 0.08,
      cool: Math.random(),
    });
  }
}

function jaggedBoltPath(x0, y0, x1, y1, segs, jag) {
  const pts = [{ x: x0, y: y0 }];
  for (let i = 1; i < segs; i++) {
    const t = i / segs;
    const nx = x0 + (x1 - x0) * t + (Math.random() - 0.5) * jag * (1 - Math.abs(t - 0.5) * 0.4);
    const ny = y0 + (y1 - y0) * t + (Math.random() - 0.5) * jag * 0.35;
    pts.push({ x: nx, y: ny });
  }
  pts.push({ x: x1, y: y1 });
  return pts;
}

function spawnLightning(strength, kind = "kick") {
  while (lightningBolts.length >= LIGHTNING_MAX) lightningBolts.shift();

  const x0 = 0.12 + Math.random() * 0.76;
  const y0 = 0.06 + Math.random() * 0.16;
  const reach =
    kind === "snare"
      ? 0.38 + Math.random() * 0.18
      : kind === "peak"
        ? 0.42 + Math.random() * 0.2
        : 0.48 + Math.random() * 0.22;
  const x1 = x0 + (Math.random() - 0.5) * 0.28;
  const y1 = Math.min(0.72, y0 + reach);
  const segs = 7 + ((strength * 6) | 0);
  const main = jaggedBoltPath(x0, y0, x1, y1, segs, 0.045 + strength * 0.04);
  const branches = [];
  const branchN = strength > 0.55 ? 1 + ((Math.random() * 2) | 0) : Math.random() > 0.45 ? 1 : 0;
  for (let b = 0; b < branchN; b++) {
    const from = 2 + ((Math.random() * (main.length - 3)) | 0);
    const p = main[from];
    const bx = p.x + (Math.random() > 0.5 ? 1 : -1) * (0.06 + Math.random() * 0.12);
    const by = p.y + 0.08 + Math.random() * 0.16;
    branches.push(jaggedBoltPath(p.x, p.y, bx, by, 4 + ((Math.random() * 3) | 0), 0.03));
  }

  lightningBolts.push({
    main,
    branches,
    life: 1,
    decay: 0.055 + Math.random() * 0.04,
    strength: Math.min(1, strength),
    hue: kind === "snare" ? "pink" : kind === "peak" ? "gold" : "cyan",
  });
  setStormFlash(Math.min
}

function spawnRainSplash(strength) {
  const n = Math.max(3, Math.floor(4 + strength * 10));
  for (let i = 0; i < n; i++) {
    if (rainSplashes.length >= RAIN_SPLASH_MAX) rainSplashes.shift();
    rainSplashes.push({
      x: 0.12 + Math.random() * 0.76,
      y: 0.72 + Math.random() * 0.22,
      vx: (Math.random() - 0.5) * 0.012,
      vy: -0.004 - Math.random() * 0.01 * strength,
      life: 0.7 + Math.random() * 0.4,
      decay: 0.018 + Math.random() * 0.02,
      hue: Math.random() > 0.45 ? "cyan" : Math.random() > 0.5 ? "pink" : "gold",
      r: 1.2 + Math.random() * 2.4,
    });
  }
}

function drawStormSky(now, bass, mid) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#05070c");
  g.addColorStop(0.28, `rgb(${10 + mid * 8}, ${12 + bass * 10}, ${18 + mid * 14})`);
  g.addColorStop(0.55, `rgb(${14 + bass * 6}, ${18 + mid * 12}, ${28 + bass * 10})`);
  g.addColorStop(0.78, `rgb(${8 + mid * 6}, ${22 + bass * 8}, ${32 + mid * 10})`);
  g.addColorStop(1, "#040910");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Soft sun glow trapped under the cloud deck
  const sx = W * 0.5;
  const sy = H * 0.28;
  const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, H * 0.35);
  glow.addColorStop(0, `rgba(255, 160, 110, ${0.07 + bass * 0.08})`);
  glow.addColorStop(0.45, `rgba(180, 100, 90, ${0.04 + mid * 0.04})`);
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H * 0.55);

  if (stormFlash > 0.04) {
    ctx.fillStyle = `rgba(210, 230, 255, ${stormFlash * 0.28})`;
    ctx.fillRect(0, 0, W, H * 0.58);
    ctx.fillStyle = `rgba(160, 190, 230, ${stormFlash * 0.1})`;
    ctx.fillRect(0, H * 0.4, W, H * 0.25);
  }
}

function drawStormClouds(now, bass, mid) {
  if (!stormClouds.length) seedStormClouds();
  const horizon = H * 0.52;
  ctx.save();
  for (const c of stormClouds) {
    const x = c.x * W;
    const y = c.y * H;
    const rw = c.w * W;
    const rh = c.h * H;
    const a = Math.min(0.72, c.alpha + mid * 0.08 + bass * 0.04 + stormFlash * 0.12);
    const cool = c.cool;
    const r = (18 + cool * 22) | 0;
    const g = (22 + (1 - cool) * 18 + mid * 10) | 0;
    const b = (32 + cool * 28 + bass * 12) | 0;
    const blob = ctx.createRadialGradient(x, y, 0, x, y, Math.max(rw, rh));
    blob.addColorStop(0, `rgba(${r + 20}, ${g + 18}, ${b + 24}, ${a})`);
    blob.addColorStop(0.45, `rgba(${r}, ${g}, ${b}, ${a * 0.75})`);
    blob.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    ctx.fillStyle = blob;
    ctx.beginPath();
    ctx.ellipse(x, y, rw, rh, 0, 0, Math.PI * 2);
    ctx.fill();
    // Slight underside shadow so the deck reads heavier
    ctx.fillStyle = `rgba(4, 6, 12, ${a * 0.25})`;
    ctx.beginPath();
    ctx.ellipse(x, y + rh * 0.35, rw * 0.85, rh * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Soft haze band where clouds meet the highway sky
  const haze = ctx.createLinearGradient(0, horizon * 0.55, 0, horizon);
  haze.addColorStop(0, "rgba(20, 28, 42, 0)");
  haze.addColorStop(0.6, `rgba(16, 24, 38, ${0.18 + mid * 0.1})`);
  haze.addColorStop(1, `rgba(8, 14, 24, ${0.35 + bass * 0.08})`);
  ctx.fillStyle = haze;
  ctx.fillRect(0, horizon * 0.55, W, horizon * 0.45);
  ctx.restore();
}

function strokeBolt(pts, width, color) {
  if (!pts || pts.length < 2) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(pts[0].x * W, pts[0].y * H);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i].x * W, pts[i].y * H);
  }
  ctx.stroke();
}

function drawLightningBolts() {
  if (!lightningBolts.length) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const bolt of lightningBolts) {
    const a = Math.min(1, bolt.life * 1.2);
    if (a < 0.05) continue;
    const core =
      bolt.hue === "pink"
        ? `rgba(255, 160, 210, ${a})`
        : bolt.hue === "gold"
          ? `rgba(255, 230, 180, ${a})`
          : `rgba(210, 235, 255, ${a})`;
    const glow =
      bolt.hue === "pink"
        ? `rgba(255, 110, 168, ${a * 0.45})`
        : bolt.hue === "gold"
          ? `rgba(240, 197, 106, ${a * 0.4})`
          : `rgba(69, 224, 255, ${a * 0.4})`;
    const w = 1.2 + bolt.strength * 2.2;
    strokeBolt(bolt.main, w * 3.2, glow);
    strokeBolt(bolt.main, w, core);
    strokeBolt(bolt.main, Math.max(0.8, w * 0.35), `rgba(255, 255, 255, ${a * 0.9})`);
    for (const br of bolt.branches) {
      strokeBolt(br, w * 1.6, glow);
      strokeBolt(br, w * 0.55, core);
    }
  }
  ctx.restore();
}

function drawWetAsphalt(now, bass, mid, air) {
  const horizon = H * 0.52;
  const seaH = H - horizon;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, horizon, W, seaH);
  ctx.clip();

  // Darker wet film over the grid sea
  const wet = ctx.createLinearGradient(0, horizon, 0, H);
  wet.addColorStop(0, `rgba(2, 8, 16, ${0.18 + mid * 0.12})`);
  wet.addColorStop(0.4, `rgba(0, 4, 10, ${0.28 + bass * 0.1})`);
  wet.addColorStop(1, "rgba(0, 0, 0, 0.45)");
  ctx.fillStyle = wet;
  ctx.fillRect(0, horizon, W, seaH);

  // Neon road reflections — stretched vertical glows
  ctx.globalCompositeOperation = "lighter";
  const vanish = typeof vanishX === "function" ? vanishX() : W * 0.5;
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const x = vanish + (t - 0.5) * W * (0.55 + bass * 0.15);
    const a = 0.04 + mid * 0.08 + air * 0.05;
    const col =
      i % 3 === 0
        ? `rgba(69, 224, 255, ${a})`
        : i % 3 === 1
          ? `rgba(255, 110, 168, ${a * 0.85})`
          : `rgba(240, 197, 106, ${a * 0.7})`;
    const streak = ctx.createLinearGradient(x, horizon, x, H);
    streak.addColorStop(0, col);
    streak.addColorStop(0.35, col.replace(/[\d.]+\)$/, `${a * 0.45})`));
    streak.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = streak;
    const half = (6 + t * 18 + bass * 10) * (0.4 + t);
    ctx.fillRect(x - half, horizon, half * 2, seaH);
  }

  // Horizontal sheen bands — wet asphalt catching headlights
  const scroll = (now * 0.00015 + FX.gridScroll * 0.8) % 1;
  for (let i = 0; i < 6; i++) {
    const u = (scroll + i / 6) % 1;
    const y = horizon + Math.pow(u, 1.35) * seaH;
    const a = (0.04 + mid * 0.06) * (1 - u * 0.5);
    ctx.strokeStyle = `rgba(180, 220, 255, ${a})`;
    ctx.lineWidth = 1 + (1 - u) * 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // Splash sparks on the wet road
  for (const s of rainSplashes) {
    if (s.life < 0.05) continue;
    const x = s.x * W;
    const y = s.y * H;
    const col =
      s.hue === "gold"
        ? `rgba(240, 197, 106, ${s.life * 0.7})`
        : s.hue === "pink"
          ? `rgba(255, 110, 168, ${s.life * 0.65})`
          : `rgba(69, 224, 255, ${s.life * 0.7})`;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x, y, s.r * s.life, 0, Math.PI * 2);
    ctx.fill();
  }

  // Lightning reflection flicker on the wet road
  if (stormFlash > 0.08) {
    ctx.fillStyle = `rgba(200, 220, 255, ${stormFlash * 0.12})`;
    ctx.fillRect(0, horizon, W, seaH * 0.35);
  }

  ctx.restore();
}

export {
  seedStormClouds, spawnLightning, spawnRainSplash,
  drawStormSky, drawStormClouds, strokeBolt, drawLightningBolts, drawWetAsphalt,
  jaggedBoltPath,
};
