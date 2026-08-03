import {
  stage, gate, toggleBtn, restartBtn, pickBtn, systemChromeBtn,
  chromePresets, vizSwitchBtn, vizPicker, hideUiBtn, uiPeek, statusEl,
  vizMode, VIZ_MODE_LABELS, brandEyebrow, started,
} from "./state.js";

function setUiHidden(hidden) {
  stage.classList.toggle("ui-hidden", hidden);
  if (uiPeek) uiPeek.hidden = !hidden;
  if (hideUiBtn) hideUiBtn.textContent = hidden ? "Show UI" : "Hide UI";
  if (hidden) {
    // Inline picker close — avoids circular dep with vizMode.js
    const vp = vizPicker; const vsb = vizSwitchBtn;
    if (vp) vp.hidden = true;
    if (vsb) vsb.setAttribute("aria-expanded", "false");
  }
}

function toggleUiHidden() {
  setUiHidden(!stage.classList.contains("ui-hidden"));
}

function setFxPanelHidden(hidden) {
  const panel = document.getElementById("fx-panel");
  const peek = document.getElementById("fx-peek");
  panel?.classList.toggle("fx-panel-hidden", hidden);
  if (peek) peek.hidden = !hidden;
}

function toggleFxPanelHidden() {
  const panel = document.getElementById("fx-panel");
  setFxPanelHidden(!panel?.classList.contains("fx-panel-hidden"));
}

/** System-audio chrome polish (no personal track title vibe). */
function setUsMode(on) {
  stage.classList.toggle("us-mode", on);
}

function showFileChrome() {
  gate.classList.add("gone");
  toggleBtn.hidden = false;
  restartBtn.hidden = false;
  pickBtn.hidden = false;
  if (chromePresets) chromePresets.hidden = true;
  systemChromeBtn.hidden = false;
  if (vizSwitchBtn) vizSwitchBtn.hidden = false;
  toggleBtn.textContent = "Pause";
  setUsMode(false);
  syncVizModeUi();
}

function showSystemChrome() {
  gate.classList.add("gone");
  toggleBtn.hidden = false;
  restartBtn.hidden = true;
  pickBtn.hidden = false;
  if (chromePresets) chromePresets.hidden = true;
  systemChromeBtn.hidden = true;
  if (vizSwitchBtn) vizSwitchBtn.hidden = false;
  toggleBtn.textContent = "Stop share";
  setUsMode(true);
  syncVizModeUi();
}


// Local helper — avoids importing from vizMode.js (would create circular dep)
function vizModeLabel(mode) {
  mode = mode ?? vizMode;
  if (mode === "skyline")   return "skyline";
  if (mode === "rainDrive") return "rain drive";
  if (mode === "tunnel")    return "tunnel";
  if (mode === "arcade")    return "arcade";
  return "night drive";
}

function syncVizModeUi() {
  const sky = vizMode === "skyline";
  const tun = vizMode === "tunnel";
  const arc = vizMode === "arcade";
  for (const btn of document.querySelectorAll("[data-viz]")) {
    const on = btn.getAttribute("data-viz") === vizMode;
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    if (btn.getAttribute("role") === "menuitemradio") {
      btn.setAttribute("aria-checked", on ? "true" : "false");
    }
  }
  if (brandEyebrow) brandEyebrow.textContent = vizModeLabel();
  if (vizSwitchBtn) {
    const label = VIZ_MODE_LABELS[vizMode] ?? "Scenes";
    vizSwitchBtn.textContent = label;
    vizSwitchBtn.title = "Choose scene (N)";
  }
  // Arcade cabinet marquee is the title bar — fade HUD SUNWAKE out/in
  stage.classList.toggle("cabinet-title", arc);
  // Tuck Effects panel in non–Night Drive modes (Skyline, Tunnel, Arcade)
  if (sky || tun || arc) {
    setFxPanelHidden(true);
    const peek = document.getElementById("fx-peek");
    if (peek && (started || gate?.classList.contains("gone"))) peek.hidden = true;
  } else if (started || gate?.classList.contains("gone")) {
    const peek = document.getElementById("fx-peek");
    if (peek && !stage.classList.contains("ui-hidden")) {
      const panel = document.getElementById("fx-panel");
      peek.hidden = !panel?.classList.contains("fx-panel-hidden");
    }
  }
}

/** Gate / chrome / FX panel visibility. */
export class ChromeUi {
  setUiHidden(hidden)      { setUiHidden(hidden); }
  toggleUiHidden()         { toggleUiHidden(); }
  setFxPanelHidden(hidden) { setFxPanelHidden(hidden); }
  toggleFxPanelHidden()    { toggleFxPanelHidden(); }
  showFileChrome()         { showFileChrome(); }
  showSystemChrome()       { showSystemChrome(); }
}

export {
  setUiHidden, toggleUiHidden,
  setFxPanelHidden, toggleFxPanelHidden,
  showFileChrome, showSystemChrome,
  setUsMode,
  syncVizModeUi,
};
