import {
  FX_TOGGLES, FX_REQUIRES, FX_LABELS, fxOn,
  SUN_SCALE, setSunScale, SUN_SCALE_MIN, SUN_SCALE_MAX,
  SUN_Y_FRAC, SUN_DROP_PER_EXTRA,
} from "./state.js";

function syncFxDependencies() {
  for (const input of document.querySelectorAll("#fx-panel input[data-fx]")) {
    const key = input.dataset.fx;
    if (!key) continue;
    const label = input.closest(".fx-toggle");
    const parentKey = label?.dataset.requires || FX_REQUIRES[key];
    if (!parentKey) {
      input.disabled = false;
      label?.classList.remove("fx-toggle-disabled");
      if (label && label.dataset.baseTitle != null) {
        label.title = label.dataset.baseTitle;
      }
      continue;
    }
    const parentOn = !!FX_TOGGLES[parentKey];
    input.disabled = !parentOn;
    label?.classList.toggle("fx-toggle-disabled", !parentOn);
    if (label) {
      if (label.dataset.baseTitle == null) {
        label.dataset.baseTitle = label.title || "";
      }
      label.title = parentOn
        ? label.dataset.baseTitle
        : `Needs ${FX_LABELS[parentKey] || parentKey} on`;
    }
  }
}

function applySunScale(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return;
  setSunScale(Math.min(SUN_SCALE_MAX, Math.max(SUN_SCALE_MIN, n)));
  const sunScaleSlider = document.getElementById("fx-sun-scale");
  const sunScaleVal = document.getElementById("fx-sun-scale-val");
  if (sunScaleSlider) sunScaleSlider.value = String(SUN_SCALE);
  if (sunScaleVal) sunScaleVal.textContent = SUN_SCALE.toFixed(2);
}

/** Effects panel toggles + dependency rules. */
export class FxConfig {
  get toggles()  { return FX_TOGGLES; }
  get requires() { return FX_REQUIRES; }
  get labels()   { return FX_LABELS; }
  on(key)        { return fxOn(key); }
  syncDependencies() { syncFxDependencies(); }
  applySunScale(raw) { applySunScale(raw); }
}

export { FX_TOGGLES, FX_REQUIRES, FX_LABELS, fxOn, syncFxDependencies, applySunScale };
