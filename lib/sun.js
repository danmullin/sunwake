import {
  W, H, SUN_SCALE, SUN_Y_FRAC, SUN_DROP_PER_EXTRA, fxOn, BH_DISK_TILT,
  t0, FX, infalls, canvas, ctx,
} from "./state.js";
import { PERF } from "./perf.js";
import { vanishX } from "./camera.js";
import { synthRainbow, smooth } from "./math.js";

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

  // Inner iris ring ΓÇö breathes with solo
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
      // Straight polar axis ΓÇö softness lives in width + glow, not bend
      spine.push({
        x: 0,
        y: dir * along,
        // Width blooms then tapers ΓÇö plume, not a ruler triangle
        w:
          baseW *
          widthBias *
          (0.55 + Math.sin(u * Math.PI) * 0.85 + u * 0.25) *
          (1.05 - u * 0.35) *
          (1 + Math.sin(t * 1.6 + phase + u * 1.2) * 0.06),
      });
    }

    // Feathered passes: wide soft sheath ΓåÆ mid glow ΓåÆ thin core
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

  // Bright thin core streak ΓÇö always screen-horizontal
  const core = ctx.createLinearGradient(-half * 0.95, 0, half * 0.95, 0);
  core.addColorStop(0, "rgba(255, 255, 255, 0)");
  core.addColorStop(0.45, `rgba(255, 230, 200, ${alpha * 0.55})`);
  core.addColorStop(0.5, `rgba(255, 255, 255, ${Math.min(1, alpha * 1.1)})`);
  core.addColorStop(0.55, `rgba(200, 240, 255, ${alpha * 0.55})`);
  core.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = core;
  ctx.fillRect(-half * 0.95, -coreH * 0.5, half * 1.9, coreH);

  // Subtle vertical cross ΓÇö always screen-vertical
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
      // Doppler: hot approaching limb ΓåÆ cooler receding
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

    // 4) Front of disk ΓÇö near side + far side wrapping over the silhouette
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

    // Far side over the top ΓÇö same ring geometry, slightly softer so it reads continuous
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


export {
  drawSunPetals, drawQuasarJets, drawSunFlares, drawSoftSun,
};
