import {
  FX_TOGGLES,
  FX_REQUIRES,
  FX_LABELS,
  fxOn as _fxOn,
  syncFxDependencies as _sync,
  applySunScale as _applySunScale,
  WHIP_VERTICALS,
} from "./runtime.js";

/** Effects panel toggles + dependency rules. */
export class FxConfig {
  get toggles() {
    return FX_TOGGLES;
  }
  get requires() {
    return FX_REQUIRES;
  }
  get labels() {
    return FX_LABELS;
  }
  on(key) {
    return _fxOn(key);
  }
  syncDependencies() {
    _sync();
  }
  applySunScale(raw) {
    _applySunScale(raw);
  }
  get whipVerticals() {
    return WHIP_VERTICALS;
  }
}

export { FX_TOGGLES, FX_REQUIRES, FX_LABELS, fxOn, syncFxDependencies, applySunScale } from "./runtime.js";
