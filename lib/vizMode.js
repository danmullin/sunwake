import {
  vizMode,
  VIZ_MODES,
  VIZ_MODE_LABELS,
  isSeaDrive,
  vizModeLabel,
  setVizMode as _set,
  syncVizModeUi as _sync,
  setVizPickerOpen as _open,
  toggleVizPicker as _toggle,
} from "./runtime.js";

/** Visualizer mode selection + chrome picker. */
export class VizModeController {
  get mode() {
    return vizMode;
  }
  get modes() {
    return VIZ_MODES;
  }
  get labels() {
    return VIZ_MODE_LABELS;
  }
  label(mode) {
    return vizModeLabel(mode);
  }
  isSeaDrive() {
    return isSeaDrive();
  }
  set(mode) {
    _set(mode);
  }
  syncUi() {
    _sync();
  }
  setPickerOpen(open) {
    _open(open);
  }
  togglePicker() {
    _toggle();
  }
}

export {
  vizMode,
  VIZ_MODES,
  VIZ_MODE_LABELS,
  isSeaDrive,
  vizModeLabel,
  setVizMode,
  syncVizModeUi,
  setVizPickerOpen,
  toggleVizPicker,
} from "./runtime.js";
