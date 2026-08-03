import {
  vizMode, setVizModeVar, VIZ_MODES, VIZ_MODE_LABELS, VIZ_MODE_KEY,
  vizSwitchBtn, vizPicker, stage, brandEyebrow, statusEl,
  started, playing,
  skylineWinLits, skylineParty, gridCells, gridTrails,
  rainSplashes, lightningBolts, setStormFlash,
  tunnelPulseRings, setTunnelScroll, setTunnelPulse,
  arcadeStars, setArcadeFlash,
} from "./state.js";
import { getScene } from "./sceneRegistry.js";
import { setFxPanelHidden, syncVizModeUi } from "./ui.js";

// Seed functions are imported lazily to avoid circular deps.
// runtime.js calls setVizModeSeedHooks once scene files are loaded.
let _seedStormClouds = () => {};
let _seedArcadeStars = () => {};
export function setVizModeSeedHooks(rain, arcade) {
  _seedStormClouds = rain;
  _seedArcadeStars = arcade;
}

function isSeaDrive() {
  return vizMode === "nightDrive" || vizMode === "rainDrive";
}

function vizModeLabel(mode = vizMode) {
  if (mode === "skyline") return "skyline";
  if (mode === "rainDrive") return "rain drive";
  if (mode === "tunnel") return "tunnel";
  if (mode === "arcade") return "arcade";
  return "night drive";
}


function setVizPickerOpen(open) {
  if (!vizPicker || !vizSwitchBtn) return;
  const show = !!open && !vizSwitchBtn.hidden && !stage.classList.contains("ui-hidden");
  vizPicker.hidden = !show;
  vizSwitchBtn.setAttribute("aria-expanded", show ? "true" : "false");
}

function toggleVizPicker() {
  if (!vizPicker || vizSwitchBtn?.hidden) return;
  setVizPickerOpen(vizPicker.hidden);
}

function setVizMode(mode) {
  if (!VIZ_MODES.includes(mode)) return;
  if (mode === vizMode) {
    syncVizModeUi();
    setVizPickerOpen(false);
    return;
  }
  const prev = vizMode;
  const prevScene = getScene(prev);
  setVizModeVar(mode);
  try {
    localStorage.setItem(VIZ_MODE_KEY, vizMode);
  } catch {
    /* ignore */
  }
  // Drop mode-specific state so it doesn't linger across switches
  skylineWinLits.length = 0;
  skylineParty.length = 0;
  gridCells.length = 0;
  gridTrails.length = 0;
  if (vizMode !== "rainDrive") {
    rainSplashes.length = 0;
    lightningBolts.length = 0;
    setStormFlash(0);
  } else {
    if (!stormClouds.length) _seedStormClouds();
  }
  if (vizMode !== "tunnel") {
    tunnelPulseRings.length = 0;
    setTunnelScroll(0);
    setTunnelPulse(0);
  }
  if (vizMode === "arcade") {
    if (!arcadeStars.length) _seedArcadeStars();
  } else {
    setArcadeFlash(0);
  }
  syncVizModeUi();
  setVizPickerOpen(false);
  if (statusEl && (started || playing)) {
    statusEl.textContent = vizModeLabel();
  }
  try {
    prevScene?.onExit?.(vizMode);
    getScene(vizMode)?.onEnter?.(prev);
    _prevSceneMode = vizMode;
  } catch {
    /* scene hooks optional during early boot */
  }
}

/** Visualizer mode selection + chrome picker. */
export class VizModeController {
  get mode()   { return vizMode; }
  get modes()  { return VIZ_MODES; }
  get labels() { return VIZ_MODE_LABELS; }
  label(mode)  { return vizModeLabel(mode); }
  isSeaDrive() { return isSeaDrive(); }
  set(mode)    { setVizMode(mode); }
  syncUi()     { syncVizModeUi(); }
  setPickerOpen(open) { setVizPickerOpen(open); }
  togglePicker()      { toggleVizPicker(); }
}

export {
  vizMode, VIZ_MODES, VIZ_MODE_LABELS,
  isSeaDrive, vizModeLabel,
  setVizMode, syncVizModeUi, setVizPickerOpen, toggleVizPicker,
};
