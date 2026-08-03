/**
 * Extract camera + sun functions from runtime.js into camera.js + sun.js.
 * Run: node tools/extract-camera-sun.js
 */
const fs = require("fs");
const path = require("path");

const runtimePath = path.join(__dirname, "../lib/runtime.js");
const cameraPath = path.join(__dirname, "../lib/camera.js");
const sunPath = path.join(__dirname, "../lib/sun.js");

let src = fs.readFileSync(runtimePath, "utf8");

// ── Camera functions ──
// updateCamera, vanishX, applyWorldTransform, resetScreenTransform
const cameraBody = `import {
  ctx, W, H, dpr, t0,
  fxOn, CAM, CAM_SWAY_DRAMA, HORIZON_SWAY_BANK, HORIZON_SWAY_VANISH,
} from "./state.js";
import { smooth } from "./math.js";

/** World camera sway + canvas transforms. */
export class Camera {
  get state() { return CAM; }
  update(now, bass, mid, air, peak, snare) { updateCamera(now, bass, mid, air, peak, snare); }
  vanishX() { return vanishX(); }
  applyWorldTransform() { applyWorldTransform(); }
  resetScreenTransform() { resetScreenTransform(); }
}

export { CAM } from "./state.js";

export function updateCamera(now, bass, mid, air, peak, snare) {
  let tx = 0, ty = 0, trot = 0, tzoom = 1, tbank = 0, tvanish = 0;
  if (fxOn("cameraSway")) {
    const t = (now - t0) * 0.001;
    const d = CAM_SWAY_DRAMA;
    tx = (Math.sin(t * 0.21) * 9 + Math.sin(t * 0.47) * 3.5) * d;
    ty = (Math.cos(t * 0.17) * 5.5 + Math.sin(t * 0.31) * 2.5) * d;
    ty += (bass * 12 + peak * 7) * d;
    tx += (Math.sin(t * 0.95) * mid * 5.5 + (snare - 0.15) * 5) * d;
    trot = (Math.sin(t * 0.14) * 0.01 + Math.sin(t * 0.38) * mid * 0.007) * d;
    tzoom = 1.04 + (bass * 0.032 + peak * 0.018 + air * 0.008) * d;
    if (fxOn("horizonSway")) {
      tbank = tx * HORIZON_SWAY_BANK;
      tvanish = tx * HORIZON_SWAY_VANISH;
    }
  }
  CAM.x = smooth(CAM.x, tx, 0.07);
  CAM.y = smooth(CAM.y, ty, 0.08);
  CAM.rot = smooth(CAM.rot, trot, 0.06);
  CAM.zoom = smooth(CAM.zoom, tzoom, 0.06);
  CAM.bank = smooth(CAM.bank, tbank, 0.11);
  CAM.vanish = smooth(CAM.vanish, tvanish, 0.1);
}

/** Perspective vanishing X — drifts with horizon sway. */
export function vanishX() {
  return W * 0.5 + CAM.vanish;
}

export function applyWorldTransform() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cx = W * 0.5;
  const cy = H * 0.55;
  ctx.translate(cx + CAM.x, cy + CAM.y);
  ctx.rotate(CAM.rot + CAM.bank);
  ctx.scale(CAM.zoom, CAM.zoom);
  ctx.translate(-cx, -cy);
}

export function resetScreenTransform() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
`;

// ── Sun functions ──
const sunBody = `import { W, H, SUN_SCALE, SUN_Y_FRAC, SUN_DROP_PER_EXTRA, fxOn } from "./state.js";

/** Sun / black-hole geometry helpers. */
export class SunModel {
  get scale() { return SUN_SCALE; }
  anchor() { return sunAnchor(); }
  diskRadius(bass = 0, solo = 0, pulseEnabled = false) { return sunDiskRadius(bass, solo, pulseEnabled); }
}

export { SUN_SCALE } from "./state.js";

function sunYFrac() {
  return SUN_Y_FRAC + (SUN_SCALE - 1) * SUN_DROP_PER_EXTRA;
}

export function sunAnchor() {
  return { x: W * 0.5, y: H * sunYFrac() };
}

export function sunDiskRadius(bass = 0, solo = 0, pulseEnabled = false) {
  const base = 0.11 + (pulseEnabled ? bass * 0.07 + solo * 0.04 : 0);
  return Math.min(W, H) * base * SUN_SCALE;
}

/** Event-horizon radius used to hide starfield behind the void. */
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
`;

fs.writeFileSync(cameraPath, cameraBody, "utf8");
fs.writeFileSync(sunPath, sunBody, "utf8");
console.log("Wrote camera.js and sun.js");

// Now remove the original function bodies from runtime.js and add imports

// Remove camera functions block
const cameraToRemove = [
  // updateCamera
  { start: /^function updateCamera\(/, end: /^\}$/, maxSearch: 50 },
  // vanishX
  { start: /^\/\*\* Perspective vanishing X/, end: /^\}$/, maxSearch: 5 },
  // applyWorldTransform
  { start: /^function applyWorldTransform\(\)/, end: /^\}$/, maxSearch: 10 },
  // resetScreenTransform
  { start: /^function resetScreenTransform\(\)/, end: /^\}$/, maxSearch: 5 },
];

// Remove sun functions
const sunToRemove = [
  { start: /^function sunYFrac\(\)/, end: /^\}$/, maxSearch: 5 },
  { start: /^function sunAnchor\(\)/, end: /^\}$/, maxSearch: 5 },
  { start: /^function sunDiskRadius\(/, end: /^\}$/, maxSearch: 5 },
  { start: /^\/\*\* Event-horizon radius/, end: /^\}$/, maxSearch: 5 },
  { start: /^function behindBlackHole\(/, end: /^\}$/, maxSearch: 10 },
];

const lines = src.split("\n");
const toDelete = new Set();

function markBlock(patterns) {
  for (const { start, end, maxSearch } of patterns) {
    for (let i = 0; i < lines.length; i++) {
      if (start.test(lines[i])) {
        // Find matching closing brace
        for (let j = i; j < Math.min(i + maxSearch + 1, lines.length); j++) {
          toDelete.add(i); // mark start comment/decl line too
          if (j > i && end.test(lines[j])) {
            toDelete.add(j);
            if (j + 1 < lines.length && lines[j + 1].trim() === "") toDelete.add(j + 1);
            break;
          }
          toDelete.add(j);
        }
        break;
      }
    }
  }
}

markBlock(cameraToRemove);
markBlock(sunToRemove);

// Add import for camera and sun at top (after state.js import)
const newLines = [];
let injectedCamSun = false;
for (let i = 0; i < lines.length; i++) {
  if (toDelete.has(i)) continue;
  newLines.push(lines[i]);
  if (!injectedCamSun && lines[i].includes('from "./state.js"')) {
    injectedCamSun = true;
    newLines.push('import { updateCamera, vanishX, applyWorldTransform, resetScreenTransform } from "./camera.js";');
    newLines.push('import { sunYFrac, sunAnchor, sunDiskRadius, blackHoleOccludeRadius, behindBlackHole } from "./sun.js";');
  }
}

fs.writeFileSync(runtimePath, newLines.join("\n"), "utf8");
console.log("runtime.js updated. Lines:", newLines.length, "(was", lines.length + ")");
