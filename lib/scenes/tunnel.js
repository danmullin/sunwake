import {
  ctx, W, H, t0, fxOn, FX,
  tunnelScroll, setTunnelScroll, tunnelPulse, setTunnelPulse,
  tunnelSway, setTunnelSway, tunnelPulseRings, TUNNEL_RINGS_MAX,
  levels,
} from "../state.js";

const TUNNEL_FOV = 0.72;
const TUNNEL_RIBS = 28;
const TUNNEL_RIB_SPACING = 0.072;
import { SW_RAINBOW, synthRainbow, smooth } from "../math.js";
import { PERF } from "../perf.js";
import { vanishX, applyWorldTransform, resetScreenTransform } from "../camera.js";
import {
  drawSky, drawSparks, drawSoloAurora, drawStreaks, drawShocks,
  drawMelodyThread, drawHarmonyConstellation,
} from "../simulation.js";
import { VizScene } from "./base.js";

function tunnelProject(depth, ox = 0, oy = 0) {
  const z = Math.max(0.01, depth);
  const s = TUNNEL_FOV / (TUNNEL_FOV + z);
  return {
    x: W * 0.5 + ox * s * W * 0.38,
    y: H * 0.5 + oy * s * H * 0.38,
    s,
  };
}

function updateTunnel(_dt, bass, mid, air, peak, _snare, _hat, _solo) {
  const driveTarget = 0.008 + bass * 0.05 + mid * 0.018 + peak * 0.025;
  setTunnelScroll((tunnelScroll + smooth(0, driveTarget, 0.28) + driveTarget) % 1);
  setTunnelSway(smooth(tunnelSway, (bass - mid) * 0.08, 0.04));
  setTunnelPulse(smooth(tunnelPulse, bass * 0.9 + peak * 0.35, 0.18));
  if (bass > 0.22 || peak > 0.3) {
    const strength = Math.min(1, bass * 1.1 + peak * 0.5);
    if (tunnelPulseRings.length < TUNNEL_RINGS_MAX) {
      tunnelPulseRings.push({
        r: 0.02,
        life: 1,
        decay: 0.022 + Math.random() * 0.018,
        strength,
        hue: bass > mid ? "cyan" : mid > air ? "pink" : "gold",
      });
    }
  }
  for (let i = tunnelPulseRings.length - 1; i >= 0; i--) {
    const ring = tunnelPulseRings[i];
    ring.r += 0.028 + ring.strength * 0.018;
    ring.life -= ring.decay;
    if (ring.life <= 0 || ring.r > 1.4) tunnelPulseRings.splice(i, 1);
  }
}

function drawTunnel(now, bass, mid, air, peak, snare, hat, solo) {
  const cx = W * 0.5;
  const cy = H * 0.5;

  // ── Background — void into the dark ──────────────────────────────────────
  ctx.fillStyle = "#01030a";
  ctx.fillRect(0, 0, W, H);

  // Deep glow at the vanishing point
  const vpGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, H * 0.38);
  vpGlow.addColorStop(0, `rgba(40, 80, 140, ${0.35 + bass * 0.25})`);
  vpGlow.addColorStop(0.5, `rgba(20, 40, 80, ${0.15 + mid * 0.12})`);
  vpGlow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = vpGlow;
  ctx.fillRect(0, 0, W, H);

  // ── Helper — draw one octagon at given depth ──────────────────────────────
  const SIDES = 8;
  function ribPoints(depth, radiusMul = 1) {
    const p = tunnelProject(depth, tunnelSway, 0);
    const r = Math.min(W, H) * 0.46 * p.s * radiusMul;
    const pts = [];
    for (let k = 0; k < SIDES; k++) {
      const a = (Math.PI * 2 * k) / SIDES - Math.PI / 8;
      pts.push({ x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r });
    }
    return pts;
  }

  function drawRib(pts, color, lw) {
    if (!pts.length) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y);
    ctx.closePath();
    ctx.stroke();
  }

  // ── Rail lines — long strips down the tunnel walls ───────────────────────
  const farPts = ribPoints(TUNNEL_RIBS * TUNNEL_RIB_SPACING, 1);
  const nearPts = ribPoints(0.02, 1);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "butt";
  for (let k = 0; k < SIDES; k++) {
    const fx = farPts[k].x;
    const fy = farPts[k].y;
    const nx = nearPts[k].x;
    const ny = nearPts[k].y;
    const aRail = 0.06 + air * 0.07 + mid * 0.05;
    const railHue =
      k % 3 === 0
        ? `rgba(69, 224, 255, ${aRail})`
        : k % 3 === 1
          ? `rgba(255, 110, 168, ${aRail * 0.8})`
          : `rgba(240, 197, 106, ${aRail * 0.65})`;
    ctx.strokeStyle = railHue;
    ctx.lineWidth = 1 + tunnelPulse * 1.2;
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(nx, ny);
    ctx.stroke();
  }
  ctx.restore();

  // ── Ribs — racing toward camera ──────────────────────────────────────────
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";

  for (let i = 0; i < TUNNEL_RIBS; i++) {
    const rawDepth = ((i * TUNNEL_RIB_SPACING - (tunnelScroll * TUNNEL_RIB_SPACING)) % (TUNNEL_RIBS * TUNNEL_RIB_SPACING) + TUNNEL_RIBS * TUNNEL_RIB_SPACING) % (TUNNEL_RIBS * TUNNEL_RIB_SPACING);
    if (rawDepth < 0.005) continue;
    const p = tunnelProject(rawDepth, tunnelSway, 0);
    if (p.s < 0.01) continue;

    // Colour cycles: far=deep blue, mid=cyan/pink, near=bright
    const t = 1 - rawDepth / (TUNNEL_RIBS * TUNNEL_RIB_SPACING);
    const hueCycle = (i * 0.37 + tunnelScroll * 0.5) % 1;
    const ribCol =
      hueCycle < 0.33
        ? `rgba(69, 224, 255, ${0.15 + t * 0.65})`
        : hueCycle < 0.66
          ? `rgba(255, 110, 168, ${0.12 + t * 0.55})`
          : `rgba(240, 197, 106, ${0.10 + t * 0.5})`;

    const pts = ribPoints(rawDepth);
    const lw = Math.max(0.5, (1.2 + tunnelPulse * 2.2) * p.s * 3.5);
    drawRib(pts, ribCol, lw);

    // Bright inner glow on nearest ribs
    if (t > 0.72) {
      drawRib(ribPoints(rawDepth, 0.92), `rgba(255, 255, 255, ${(t - 0.72) * 0.55})`, Math.max(0.4, lw * 0.28));
    }
  }
  ctx.restore();

  // ── Pulse rings emanating from vanishing point ────────────────────────────
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const ring of tunnelPulseRings) {
    const a = Math.min(0.9, ring.life * ring.strength * 0.85);
    if (a < 0.05) continue;
    const screenR = ring.r * Math.min(W, H) * 0.5;
    const pts = [];
    for (let k = 0; k < SIDES; k++) {
      const ang = (Math.PI * 2 * k) / SIDES - Math.PI / 8;
      const px = cx + tunnelSway * W * 0.05 * (1 - ring.r) + Math.cos(ang) * screenR;
      const py = cy + Math.sin(ang) * screenR;
      pts.push({ x: px, y: py });
    }
    const col =
      ring.hue === "cyan"
        ? `rgba(69, 224, 255, ${a})`
        : ring.hue === "pink"
          ? `rgba(255, 110, 168, ${a})`
          : `rgba(240, 197, 106, ${a})`;
    ctx.strokeStyle = col;
    ctx.lineWidth = 2 + ring.strength * 3 * ring.life;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y);
    ctx.closePath();
    ctx.stroke();
    // Soft outer bloom
    ctx.strokeStyle = col.replace(/[\d.]+\)$/, `${a * 0.28})`);
    ctx.lineWidth = 6 + ring.strength * 10 * ring.life;
    ctx.stroke();
  }
  ctx.restore();

  // ── Particle motes drifting toward camera (air reactive) ─────────────────
  if (air > 0.08) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const moteCount = Math.min(28, Math.floor(air * 60));
    for (let m = 0; m < moteCount; m++) {
      const seed = m * 3.71 + tunnelScroll * 0.2;
      const depth = ((Math.sin(seed) * 0.5 + 0.5) * TUNNEL_RIBS * TUNNEL_RIB_SPACING * 0.9) + 0.05;
      const ox = Math.sin(seed * 2.13) * 0.85;
      const oy = Math.cos(seed * 1.77) * 0.85;
      const p = tunnelProject(depth, ox + tunnelSway * 0.5, oy);
      const mr = Math.max(1, p.s * (3 + air * 4));
      ctx.fillStyle = `rgba(200, 230, 255, ${air * 0.45 * (1 - depth / (TUNNEL_RIBS * TUNNEL_RIB_SPACING))})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, mr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ── Vignette — darken edges so ribs feel enclosing ───────────────────────
  const vig = ctx.createRadialGradient(cx, cy, H * 0.22, cx, cy, H * 0.82);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(0.6, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.72)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
}

/** Infinite octagonal tunnel — warp-speed depth-of-field. */
export class TunnelScene extends VizScene {
  update(_now, dt, levels, fx) {
    const { bass, mid, air, peak, snare, hat } = levels;
    updateTunnel(dt, bass, mid, air, peak, snare, hat, fx.solo ?? 0);
  }
  draw(now, levels, fx) {
    const { bass, mid, air, peak, snare, hat } = levels;
    drawTunnel(now, bass, mid, air, peak, snare, hat, fx.solo ?? 0);
  }
}

export { tunnelProject, updateTunnel, drawTunnel };
