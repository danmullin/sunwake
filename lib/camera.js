import {
  CAM,
  updateCamera as _update,
  vanishX as _vanishX,
  applyWorldTransform as _apply,
  resetScreenTransform as _reset,
} from "./runtime.js";

/** World camera sway + canvas transforms. */
export class Camera {
  get state() {
    return CAM;
  }
  update(now, bass, mid, air, peak, snare) {
    _update(now, bass, mid, air, peak, snare);
  }
  vanishX() {
    return _vanishX();
  }
  applyWorldTransform() {
    _apply();
  }
  resetScreenTransform() {
    _reset();
  }
}

export { CAM, updateCamera, vanishX, applyWorldTransform, resetScreenTransform } from "./runtime.js";
