import {
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
