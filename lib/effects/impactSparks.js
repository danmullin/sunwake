/**
 * Impact-spark domain — the music-reactive burst effects that flicker around
 * the sun on keys/chords/hits: sparks, streaks, shock rings, chord halos,
 * hammer ripples. Grouped together because they're triggered from the same
 * place in simulation.js and share the same "spawn → age → fade" shape.
 */
import { ctx, W, H, FX, levels, fxOn, SUN_SCALE, CHORD_HALO_MAX, sparks, streaks, shocks, chordHalos, hammerRipples } from "../state.js";
import { synthRainbow, swapRemove } from "../math.js";
import { sparkCap } from "../perf.js";
import { sunYFrac, sunAnchor, sunDiskRadius, blackHoleOccludeRadius } from "./sun.js";

let streakDir = 0;

// ─── Sparks ──────────────────────────────────────────────────────────────────

export function spawnKeySparks(strength = 0.5) {
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

export function spawnSpark(kind = "ember") {
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

export function drawSparks(bass = 0, solo = 0) {
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

// ─── Streaks ─────────────────────────────────────────────────────────────────

export function spawnStreak() {
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

export function drawStreaks() {
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

// ─── Shock rings ─────────────────────────────────────────────────────────────

export function spawnShock(strength) {
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

export function drawShocks() {
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

// ─── Chord halos ─────────────────────────────────────────────────────────────

export function spawnChordHalo(strength = 0.5) {
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

export function drawChordHalos() {
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

// ─── Hammer ripples ──────────────────────────────────────────────────────────

export function spawnHammerRipple(strength = 0.5) {
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

export function drawHammerRipples() {
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

// ─── Aging ───────────────────────────────────────────────────────────────────

/** Age + prune all five pools. Called once per frame regardless of play state. */
export function tickImpactSparks() {
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
}

export function resetImpactSparks() {
  sparks.length = 0;
  streaks.length = 0;
  shocks.length = 0;
  chordHalos.length = 0;
  hammerRipples.length = 0;
}
