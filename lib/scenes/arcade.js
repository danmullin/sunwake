import {
  ctx, W, H, t0, fxOn, FX,
  ARCADE_EQ_N, arcadeEq, arcadeWarp, setArcadeWarp, arcadeFlash, setArcadeFlash,
  arcadeStars, ARCADE_STAR_N,
  levels,
} from "../state.js";
import { SW_RAINBOW, synthRainbow, smooth } from "../math.js";
import { PERF } from "../perf.js";
import { vanishX, applyWorldTransform, resetScreenTransform } from "../camera.js";
import { tunnelProject } from "./tunnel.js";
import {
  drawSky, drawSparks, drawSoloAurora, drawStreaks, drawShocks,
  drawMelodyThread, drawHarmonyConstellation,
} from "../simulation.js";

function seedArcadeStars() {
  arcadeStars.length = 0;
  for (let i = 0; i < ARCADE_STAR_N; i++) {
    const a = Math.random() * Math.PI * 2;
    arcadeStars.push({
      a,
      // depth 0 (near / screen edge) → 1 (far / vanish)
      z: Math.random(),
      speed: 0.35 + Math.random() * 0.9,
      bright: 0.35 + Math.random() * 0.65,
    });
  }
  for (let i = 0; i < ARCADE_EQ_N; i++) arcadeEq[i] = 0.08;
}

function updateArcadeEq(now) {
  const n = freq && freq.length ? freq.length : 0;
  for (let i = 0; i < ARCADE_EQ_N; i++) {
    let target = 0.1 + 0.05 * Math.sin(now * 0.0014 + i * 0.4);
    if (n > 8 && playing) {
      const t0 = i / ARCADE_EQ_N;
      const t1 = (i + 1) / ARCADE_EQ_N;
      const f0 = Math.floor(1 + Math.pow(t0, 1.2) * (n * 0.75));
      const f1 = Math.max(f0 + 1, Math.floor(1 + Math.pow(t1, 1.2) * (n * 0.75)));
      let sum = 0;
      let count = 0;
      for (let j = f0; j < f1 && j < n; j++) {
        sum += freq[j];
        count++;
      }
      const raw = count ? sum / (count * 255) : 0;
      target = Math.pow(Math.min(1, raw * 1.2), 0.78);
    } else if (!playing) {
      target *= 0.45;
    }
    const rate = target > arcadeEq[i] ? 0.48 : 0.18;
    arcadeEq[i] += (target - arcadeEq[i]) * rate;
  }
}

function roundRectPath(x, y, w, h, r) {
  const rr = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function updateArcadeCabinet(now, bass, mid, _air, peak, snare, _hat, solo) {
  updateArcadeEq(now);
  if (!arcadeStars.length) seedArcadeStars();
  const drive = 0.004 + bass * 0.035 + mid * 0.012 + peak * 0.02 + solo * 0.01;
  setArcadeWarp(smooth
  setArcadeFlash(smooth
}

function drawArcadeCabinet(now, bass, mid, air, peak, snare, hat, solo) {
  // ── Cabinet body (dark laminate) ─────────────────────────────────────────
  const body = ctx.createLinearGradient(0, 0, 0, H);
  body.addColorStop(0, "#12151c");
  body.addColorStop(0.45, "#0a0c12");
  body.addColorStop(1, "#05060a");
  ctx.fillStyle = body;
  ctx.fillRect(0, 0, W, H);

  // Soft wood-grain-ish side panels
  const sideGlow = ctx.createLinearGradient(0, 0, W * 0.12, 0);
  sideGlow.addColorStop(0, "rgba(40, 28, 18, 0.55)");
  sideGlow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = sideGlow;
  ctx.fillRect(0, 0, W * 0.14, H);
  const sideGlowR = ctx.createLinearGradient(W, 0, W * 0.88, 0);
  sideGlowR.addColorStop(0, "rgba(40, 28, 18, 0.55)");
  sideGlowR.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = sideGlowR;
  ctx.fillRect(W * 0.86, 0, W * 0.14, H);

  // Layout insets
  const mx = W * 0.08;
  const marqueeH = H * 0.11;
  const marqueeY = H * 0.045;
  const bezelPad = Math.min(W, H) * 0.028;
  const screenX = mx + bezelPad;
  const screenY = marqueeY + marqueeH + H * 0.02 + bezelPad;
  const screenW = W - mx * 2 - bezelPad * 2;
  const screenH = H * 0.62;
  const controlY = screenY + screenH + bezelPad * 2 + H * 0.015;
  const controlH = Math.max(H * 0.1, H - controlY - H * 0.04);

  // ── Marquee (backlit acrylic) ────────────────────────────────────────────
  roundRectPath(mx, marqueeY, W - mx * 2, marqueeH, 10);
  const marqGrad = ctx.createLinearGradient(0, marqueeY, 0, marqueeY + marqueeH);
  marqGrad.addColorStop(0, "#1a1028");
  marqGrad.addColorStop(0.5, "#2a1840");
  marqGrad.addColorStop(1, "#140c22");
  ctx.fillStyle = marqGrad;
  ctx.fill();
  ctx.strokeStyle = "rgba(200, 170, 90, 0.55)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Marquee title
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const titleSize = Math.min(marqueeH * 0.42, W * 0.055);
  ctx.font = `700 ${titleSize}px Orbitron, sans-serif`;
  ctx.fillStyle = `rgba(255, 110, 168, ${0.55 + mid * 0.35 + arcadeFlash * 0.25})`;
  ctx.shadowColor = "rgba(255, 110, 168, 0.7)";
  ctx.shadowBlur = 12 + bass * 18;
  ctx.fillText("SUNWAKE", W * 0.5, marqueeY + marqueeH * 0.42);
  ctx.shadowBlur = 0;
  ctx.font = `600 ${Math.max(9, titleSize * 0.32)}px Orbitron, sans-serif`;
  ctx.fillStyle = `rgba(69, 224, 255, ${0.45 + air * 0.4})`;
  ctx.fillText("ARCADE", W * 0.5, marqueeY + marqueeH * 0.72);
  ctx.restore();

  // Marquee EQ chrome — short LED strips under the title
  const ledN = 24;
  const ledPad = (W - mx * 2) * 0.08;
  const ledW = (W - mx * 2 - ledPad * 2) / ledN;
  const ledY = marqueeY + marqueeH - 8;
  for (let i = 0; i < ledN; i++) {
    const v = arcadeEq[Math.floor((i / ledN) * ARCADE_EQ_N)] || 0;
    const a = 0.15 + v * 0.85;
    const hue =
      i < ledN * 0.33
        ? `rgba(69, 224, 255, ${a})`
        : i < ledN * 0.66
          ? `rgba(255, 110, 168, ${a})`
          : `rgba(240, 197, 106, ${a})`;
    ctx.fillStyle = hue;
    ctx.fillRect(mx + ledPad + i * ledW + 1, ledY - v * 10, ledW - 2, 2 + v * 10);
  }

  // ── Outer bezel (plastic/chrome rim) ─────────────────────────────────────
  const outerX = mx;
  const outerY = screenY - bezelPad;
  const outerW = W - mx * 2;
  const outerH = screenH + bezelPad * 2;
  roundRectPath(outerX, outerY, outerW, outerH, 18);
  const bezelGrad = ctx.createLinearGradient(outerX, outerY, outerX + outerW, outerY + outerH);
  bezelGrad.addColorStop(0, "#2a2e38");
  bezelGrad.addColorStop(0.35, "#4a5160");
  bezelGrad.addColorStop(0.5, "#1c1f28");
  bezelGrad.addColorStop(0.65, "#5a6272");
  bezelGrad.addColorStop(1, "#181b22");
  ctx.fillStyle = bezelGrad;
  ctx.fill();

  // Inner CRT lip
  roundRectPath(screenX - 4, screenY - 4, screenW + 8, screenH + 8, 12);
  ctx.fillStyle = "#05060a";
  ctx.fill();

  // ── Screen content (clipped) ─────────────────────────────────────────────
  ctx.save();
  roundRectPath(screenX, screenY, screenW, screenH, 10);
  ctx.clip();

  // Phosphor void
  ctx.fillStyle = "#020308";
  ctx.fillRect(screenX, screenY, screenW, screenH);

  // Sun sits slightly above center so EQ chrome doesn't eat it
  const scx = screenX + screenW * 0.5;
  const scy = screenY + screenH * 0.42;
  const sMax = Math.max(screenW, screenH) * 0.72;
  const breath = 0.5 + 0.5 * Math.sin(now * 0.0013);
  const heat = Math.min(1, bass * 0.9 + peak * 0.5 + solo * 0.4);
  const sunR = Math.min(screenW, screenH) * (0.055 + bass * 0.035 + solo * 0.02 + breath * 0.008);

  // Soft center glow — sun bruises the tube
  const tubeGlow = ctx.createRadialGradient(scx, scy, 0, scx, scy, sMax);
  tubeGlow.addColorStop(0, `rgba(255, 140, 90, ${0.12 + heat * 0.22 + arcadeFlash * 0.12}`);
  tubeGlow.addColorStop(0.25, `rgba(255, 80, 140, ${0.1 + mid * 0.12}`);
  tubeGlow.addColorStop(0.55, `rgba(40, 90, 140, ${0.1 + bass * 0.12}`);
  tubeGlow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = tubeGlow;
  ctx.fillRect(screenX, screenY, screenW, screenH);

  // Vector starfield — warp out from the sun
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  for (const star of arcadeStars) {
    star.z -= arcadeWarp * star.speed;
    if (star.z <= 0.002) {
      star.z = 0.85 + Math.random() * 0.15;
      star.a = Math.random() * Math.PI * 2;
      star.speed = 0.35 + Math.random() * 0.9;
      star.bright = 0.35 + Math.random() * 0.65;
    }
    const inv = 1 / Math.max(0.002, star.z);
    const px = scx + Math.cos(star.a) * inv * sMax * 0.08;
    const py = scy + Math.sin(star.a) * inv * sMax * 0.08;
    if (px < screenX - 20 || px > screenX + screenW + 20 || py < screenY - 20 || py > screenY + screenH + 20) {
      continue;
    }
    const dx = px - scx;
    const dy = py - scy;
    if (dx * dx + dy * dy < sunR * sunR * 1.15) continue;

    const zPrev = Math.min(1, star.z + arcadeWarp * star.speed * 6);
    const invP = 1 / zPrev;
    const qx = scx + Math.cos(star.a) * invP * sMax * 0.08;
    const qy = scy + Math.sin(star.a) * invP * sMax * 0.08;
    const near = 1 - star.z;
    const a = Math.min(1, star.bright * (0.25 + near * 0.9) * (0.55 + air * 0.5));
    const huePick = (star.a * 3 + now * 0.0002) % 1;
    const col =
      huePick < 0.34
        ? `rgba(120, 220, 255, ${a})`
        : huePick < 0.67
          ? `rgba(255, 140, 200, ${a * 0.9})`
          : `rgba(255, 230, 160, ${a * 0.85})`;
    ctx.strokeStyle = col;
    ctx.lineWidth = Math.max(0.6, near * (1.2 + bass * 1.8));
    ctx.beginPath();
    ctx.moveTo(qx, qy);
    ctx.lineTo(px, py);
    ctx.stroke();
    ctx.fillStyle = `rgba(255, 255, 255, ${a * 0.85}`;
    ctx.beginPath();
    ctx.arc(px, py, Math.max(0.5, near * 1.6), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // The sun — vector coin-op heart of Sunwake
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  const halo = ctx.createRadialGradient(scx, scy, sunR * 0.2, scx, scy, sunR * 4.2);
  halo.addColorStop(0, `rgba(255, 230, 180, ${0.35 + heat * 0.35}`);
  halo.addColorStop(0.25, `rgba(255, 140, 90, ${0.22 + mid * 0.2}`);
  halo.addColorStop(0.55, `rgba(255, 80, 140, ${0.12 + bass * 0.12}`);
  halo.addColorStop(1, "rgba(69, 224, 255, 0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(scx, scy, sunR * 4.2, 0, Math.PI * 2);
  ctx.fill();

  const rayN = 12;
  const spin = now * 0.00012 + bass * 0.2;
  for (let i = 0; i < rayN; i++) {
    const ang = spin + (i / rayN) * Math.PI * 2;
    const flicker = 0.5 + 0.5 * Math.sin(now * 0.0022 + i * 1.6);
    const len = sunR * (2.8 + heat * 2.4 + breath * 0.6) * (0.75 + (i % 3) * 0.18);
    const half = (0.028 + bass * 0.035 + peak * 0.02) * flicker;
    const a = (0.05 + heat * 0.1) * flicker;
    ctx.fillStyle =
      i % 2 === 0 ? `rgba(255, 180, 90, ${a})` : `rgba(255, 90, 140, ${a * 0.9})`;
    ctx.beginPath();
    ctx.moveTo(scx, scy);
    ctx.lineTo(scx + Math.cos(ang - half) * len, scy + Math.sin(ang - half) * len);
    ctx.lineTo(scx + Math.cos(ang + half) * len, scy + Math.sin(ang + half) * len);
    ctx.closePath();
    ctx.fill();
  }

  const petalN = 8;
  for (let i = 0; i < petalN; i++) {
    const ang = -spin * 0.7 + (i / petalN) * Math.PI * 2;
    const pr = sunR * (1.55 + mid * 0.35 + Math.sin(now * 0.0018 + i) * 0.12);
    const spread = 0.22 + solo * 0.1;
    ctx.strokeStyle =
      i % 2 === 0
        ? `rgba(240, 197, 106, ${0.25 + mid * 0.35})`
        : `rgba(255, 110, 168, ${0.22 + air * 0.3})`;
    ctx.lineWidth = 1.2 + bass * 1.4;
    ctx.beginPath();
    ctx.arc(scx, scy, pr, ang - spread, ang + spread);
    ctx.stroke();
  }

  for (let k = 0; k < 3; k++) {
    const rr = sunR * (1.15 + k * 0.45 + bass * 0.08);
    ctx.strokeStyle =
      k === 0
        ? `rgba(255, 230, 180, ${0.35 + heat * 0.3})`
        : k === 1
          ? `rgba(255, 110, 168, ${0.2 + mid * 0.25})`
          : `rgba(69, 224, 255, ${0.15 + air * 0.25})`;
    ctx.lineWidth = 1 + (2 - k) * 0.6;
    ctx.beginPath();
    ctx.arc(scx, scy, rr, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (bass > 0.18 || peak > 0.25) {
    const pulseR = sunR * (1.8 + bass * 1.4 + arcadeFlash * 0.8);
    ctx.strokeStyle = `rgba(255, 200, 120, ${0.15 + bass * 0.35 + arcadeFlash * 0.25}`;
    ctx.lineWidth = 1.5 + bass * 2;
    ctx.beginPath();
    ctx.arc(scx, scy, pulseR, 0, Math.PI * 2);
    ctx.stroke();
  }

  const disk = ctx.createRadialGradient(scx - sunR * 0.25, scy - sunR * 0.3, 0, scx, scy, sunR);
  disk.addColorStop(0, `rgba(255, 250, 230, ${0.95}`);
  disk.addColorStop(0.35, `rgba(255, 200, 120, ${0.9}`);
  disk.addColorStop(0.7, `rgba(255, 120, 90, ${0.85}`);
  disk.addColorStop(1, `rgba(255, 70, 130, ${0.55 + solo * 0.25}`);
  ctx.fillStyle = disk;
  ctx.beginPath();
  ctx.arc(scx, scy, sunR, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = `rgba(255, 255, 255, ${0.45 + peak * 0.4}`;
  ctx.lineWidth = 1.5 + bass * 1.5;
  ctx.beginPath();
  ctx.arc(scx, scy, sunR, 0, Math.PI * 2);
  ctx.stroke();

  const ret = sunR * (0.35 + hat * 0.25);
  ctx.strokeStyle = `rgba(20, 10, 30, ${0.35 + hat * 0.25}`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(scx - ret, scy);
  ctx.lineTo(scx + ret, scy);
  ctx.moveTo(scx, scy - ret);
  ctx.lineTo(scx, scy + ret);
  ctx.stroke();

  ctx.restore();

  // Orbit rings around the sun
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const rings = 3;
  for (let r = 0; r < rings; r++) {
    const t = (now * 0.00028 + r * 0.28) % 1;
    const rad = sunR * (2.4 + t * 5.5) * (0.9 + bass * 0.2);
    const a = (1 - t) * (0.1 + mid * 0.22 + solo * 0.15);
    if (a < 0.04) continue;
    ctx.strokeStyle =
      r % 2 === 0 ? `rgba(69, 224, 255, ${a})` : `rgba(255, 110, 168, ${a})`;
    ctx.lineWidth = 1 + (1 - t) * 1.4;
    ctx.beginPath();
    ctx.arc(scx, scy, rad, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // Bottom-of-screen EQ as vector bars (inside CRT)
  const barMaxH = screenH * 0.28;
  const barBaseY = screenY + screenH - 8;
  const barPad = screenW * 0.06;
  const barSlot = (screenW - barPad * 2) / ARCADE_EQ_N;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < ARCADE_EQ_N; i++) {
    const v = arcadeEq[i];
    const h = Math.max(2, v * barMaxH);
    const x = screenX + barPad + i * barSlot + 1;
    const col =
      i < ARCADE_EQ_N * 0.33
        ? `rgba(69, 224, 255, ${0.35 + v * 0.55})`
        : i < ARCADE_EQ_N * 0.66
          ? `rgba(255, 110, 168, ${0.3 + v * 0.55})`
          : `rgba(240, 197, 106, ${0.28 + v * 0.55})`;
    ctx.fillStyle = col;
    ctx.fillRect(x, barBaseY - h, barSlot - 2, h);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.2 + v * 0.55}`;
    ctx.fillRect(x, barBaseY - h - 1, barSlot - 2, 2);
  }
  ctx.restore();

  // Scanlines
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  const scanStep = 3;
  ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
  for (let y = screenY; y < screenY + screenH; y += scanStep) {
    ctx.fillRect(screenX, y, screenW, 1);
  }
  const rollY = screenY + ((now * 0.04) % screenH);
  const roll = ctx.createLinearGradient(0, rollY - 40, 0, rollY + 40);
  roll.addColorStop(0, "rgba(120, 200, 255, 0)");
  roll.addColorStop(0.5, `rgba(120, 200, 255, ${0.04 + air * 0.05}`);
  roll.addColorStop(1, "rgba(120, 200, 255, 0)");
  ctx.fillStyle = roll;
  ctx.fillRect(screenX, screenY, screenW, screenH);
  ctx.restore();

  const glass = ctx.createLinearGradient(screenX, screenY, screenX + screenW, screenY + screenH);
  glass.addColorStop(0, "rgba(255,255,255,0.06)");
  glass.addColorStop(0.35, "rgba(255,255,255,0)");
  glass.addColorStop(0.7, "rgba(0,0,0,0)");
  glass.addColorStop(1, "rgba(0,0,0,0.25)");
  ctx.fillStyle = glass;
  ctx.fillRect(screenX, screenY, screenW, screenH);

  const screenVig = ctx.createRadialGradient(scx, scy, screenH * 0.15, scx, scy, Math.max(screenW, screenH) * 0.65);
  screenVig.addColorStop(0, "rgba(0,0,0,0)");
  screenVig.addColorStop(0.7, "rgba(0,0,0,0)");
  screenVig.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = screenVig;
  ctx.fillRect(screenX, screenY, screenW, screenH);

  if (arcadeFlash > 0.05) {
    ctx.fillStyle = `rgba(255, 200, 160, ${arcadeFlash * 0.1}`;
    ctx.fillRect(screenX, screenY, screenW, screenH);
  }

  ctx.restore(); // end screen clip

  // Bezel highlight ring
  roundRectPath(screenX - 2, screenY - 2, screenW + 4, screenH + 4, 11);
  ctx.strokeStyle = "rgba(180, 190, 210, 0.25)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // ── Side rail EQ chrome (coin-op attract lights) ──────────────────────────
  const railW = Math.max(8, mx * 0.35);
  const railPad = H * 0.02;
  function drawSideRail(x) {
    const slots = 16;
    const slotH = (screenH - railPad) / slots;
    for (let i = 0; i < slots; i++) {
      // Map low→high from bottom
      const eqI = Math.floor(((slots - 1 - i) / slots) * ARCADE_EQ_N);
      const v = arcadeEq[eqI] || 0;
      const on = v > 0.12 + (i % 3) * 0.05;
      const a = on ? 0.25 + v * 0.75 : 0.08;
      const y = screenY + i * slotH + 2;
      ctx.fillStyle =
        i % 3 === 0
          ? `rgba(69, 224, 255, ${a})`
          : i % 3 === 1
            ? `rgba(255, 110, 168, ${a})`
            : `rgba(240, 197, 106, ${a})`;
      ctx.fillRect(x, y, railW, slotH - 3);
    }
  }
  drawSideRail(mx * 0.35);
  drawSideRail(W - mx * 0.35 - railW);

  // ── Control panel (chrome strip + EQ) ────────────────────────────────────
  roundRectPath(mx, controlY, W - mx * 2, controlH, 12);
  const panelGrad = ctx.createLinearGradient(0, controlY, 0, controlY + controlH);
  panelGrad.addColorStop(0, "#2c303a");
  panelGrad.addColorStop(0.4, "#1a1d26");
  panelGrad.addColorStop(1, "#0e1016");
  ctx.fillStyle = panelGrad;
  ctx.fill();
  ctx.strokeStyle = "rgba(160, 170, 190, 0.35)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Fake joystick + buttons
  const joyX = mx + (W - mx * 2) * 0.18;
  const joyY = controlY + controlH * 0.55;
  const joyR = Math.min(controlH * 0.28, 22);
  ctx.beginPath();
  ctx.arc(joyX, joyY, joyR, 0, Math.PI * 2);
  ctx.fillStyle = "#11141c";
  ctx.fill();
  ctx.strokeStyle = "rgba(200, 200, 210, 0.4)";
  ctx.stroke();
  // Stick tip reacts to mid
  ctx.beginPath();
  ctx.arc(joyX + (mid - 0.5) * 8, joyY - joyR * 0.55 - bass * 4, joyR * 0.35, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(220, 60, 70, ${0.7 + bass * 0.3})`;
  ctx.fill();

  // Action buttons
  const btnColors = ["#e04070", "#45e0ff", "#f0c56a"];
  for (let b = 0; b < 3; b++) {
    const bx = mx + (W - mx * 2) * (0.72 + b * 0.08);
    const by = controlY + controlH * 0.48;
    const br = Math.min(controlH * 0.18, 14);
    const pulse = b === 0 ? bass : b === 1 ? mid : air;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fillStyle = btnColors[b];
    ctx.globalAlpha = 0.45 + pulse * 0.55;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.stroke();
  }

  // Panel EQ chrome strip
  const pEqN = 20;
  const pEqX0 = mx + (W - mx * 2) * 0.32;
  const pEqW = (W - mx * 2) * 0.32;
  const pEqSlot = pEqW / pEqN;
  const pEqBase = controlY + controlH * 0.78;
  const pEqMax = controlH * 0.45;
  for (let i = 0; i < pEqN; i++) {
    const v = arcadeEq[Math.floor((i / pEqN) * ARCADE_EQ_N)] || 0;
    const h = 3 + v * pEqMax;
    ctx.fillStyle =
      v > 0.7
        ? `rgba(255, 110, 168, ${0.5 + v * 0.5})`
        : v > 0.4
          ? `rgba(240, 197, 106, ${0.45 + v * 0.5})`
          : `rgba(69, 224, 255, ${0.35 + v * 0.55})`;
    ctx.fillRect(pEqX0 + i * pEqSlot + 1, pEqBase - h, pEqSlot - 2, h);
  }

  // Coin slot wink
  ctx.fillStyle = "rgba(20, 22, 28, 0.95)";
  ctx.fillRect(mx + (W - mx * 2) * 0.9, controlY + controlH * 0.25, 18, 8);
  ctx.fillStyle = `rgba(240, 197, 106, ${0.25 + hat * 0.5})`;
  ctx.fillRect(mx + (W - mx * 2) * 0.9 + 2, controlY + controlH * 0.25 + 2, 14, 4);
}

export {
  seedArcadeStars, updateArcadeEq, roundRectPath,
  updateArcadeCabinet, drawArcadeCabinet,
};
