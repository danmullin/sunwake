/**
 * Melody domain — the lead-line ribbon crawling across the sky, and the
 * constellation links chords draw between bright stars. Both are "quiet
 * lead" reads on the mix, distinct from the drum-driven impact sparks.
 */
import { ctx, W, H, FX, fxOn, playing, stars, melodyThread, harmonyLinks, MELODY_MAX, HARMONY_LINK_MAX } from "../state.js";
import { synthRainbow, smooth, swapRemove } from "../math.js";
import { behindBlackHole } from "./sun.js";

// ─── Melody thread ───────────────────────────────────────────────────────────

export function updateMelodyThread(now, leadPitch, mid, solo) {
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

export function drawMelodyThread() {
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

// ─── Harmony constellation ───────────────────────────────────────────────────

export function spawnHarmonyConstellation(strength = 0.5) {
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

export function drawHarmonyConstellation(bass = 0, solo = 0) {
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

/** Age + prune harmony links. Melody thread ages inline in updateMelodyThread. */
export function tickMelody() {
  for (let i = harmonyLinks.length - 1; i >= 0; i--) {
    const link = harmonyLinks[i];
    link.life -= link.decay;
    if (link.life <= 0) swapRemove(harmonyLinks, i);
  }
}

export function resetMelody() {
  melodyThread.length = 0;
  harmonyLinks.length = 0;
}
