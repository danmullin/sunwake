/**
 * Weather / atmosphere domain — haze sheets, cloud deck, fog, dew, horizon
 * ribbons, and rain. All Night Drive-only ambience that drifts and fades
 * independent of any music trigger (no spawn functions — just seeded pools
 * that age and recycle).
 */
import { ctx, W, H, fxOn, FX, vizMode, mistSheets, cloudDeck, fogPuffs, dew, horizonBands, rain } from "../state.js";

export function drawMistSheets(now, mid) {
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

export function drawCloudDeck(now) {
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

export function drawRain(mid) {
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

export function drawFog(now, bass) {
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

export function drawDew(now, air, mid) {
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

export function drawHorizonRibbons(now, bass, mid, solo) {
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

/** Drift mist sheets, crawl the cloud deck offset, and blow the rain along. */
export function tickWeather() {
  for (const sheet of mistSheets) {
    sheet.x += sheet.drift;
    if (sheet.x < -0.4) sheet.x = 1.2;
    if (sheet.x > 1.2) sheet.x = -0.4;
  }

  if (fxOn("cloudDeck") && cloudDeck.length) {
    const pad = Math.max(0, FX.sustain * 0.9 + FX.chord * 0.55);
    const crawl = 0.35 + pad * 1.4;
    for (const band of cloudDeck) {
      band.offset = (band.offset + band.speed * crawl) % 1;
    }
  }

  for (const d of rain) {
    const rainBoost = vizMode === "rainDrive" ? 1.45 + FX.mist * 0.35 : 0.7 + FX.mist;
    d.y += d.sp * rainBoost;
    d.x += d.drift * rainBoost * (vizMode === "rainDrive" ? 1.25 : 1);
    if (d.y > 1.05) {
      d.y = -0.05;
      d.x = Math.random();
    }
    if (d.x > 1.05) d.x = -0.05;
  }
}

export function resetWeather() {
  dew.length = 0;
  fogPuffs.length = 0;
  rain.length = 0;
  mistSheets.length = 0;
  cloudDeck.length = 0;
  horizonBands.length = 0;

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
