/**
 * Sky domain — background wash, starfield, shooting stars, solo aurora.
 * Everything here lives "above the horizon" and reads the black hole's
 * lensing geometry from ./sun.js but owns no sun state itself.
 */
import { ctx, W, H, fxOn, stars, shooting } from "../state.js";
import { swapRemove } from "../math.js";
import { sunAnchor, blackHoleOccludeRadius, behindBlackHole } from "./sun.js";

export function drawSky(now, bass, mid) {
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

export function drawStars(now, air, mid, solo, bass = 0) {
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

export function spawnShootingStar() {
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

export function drawShootingStars(bass = 0, solo = 0) {
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

export function drawSoloAurora(solo, air) {
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

/** Age + prune shooting stars. */
export function tickSky() {
  for (let i = shooting.length - 1; i >= 0; i--) {
    const s = shooting[i];
    s.x += s.vx;
    s.y += s.vy;
    s.life -= s.decay;
    if (s.life <= 0 || s.x > 1.2 || s.y > 0.6) swapRemove(shooting, i);
  }
}

export function resetSky() {
  stars.length = 0;
  shooting.length = 0;
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
}
