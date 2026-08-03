/**
 * DOM element lookups for Sunwake chrome.
 * Runtime also binds these at module scope; this class is the OOP entry for UI code.
 */
export class DomRefs {
  constructor(root = document) {
    this.canvas = root.getElementById("viz");
    this.stage = root.getElementById("stage");
    this.gate = root.getElementById("gate");
    this.playBtn = root.getElementById("play");
    this.systemPlayBtn = root.getElementById("system-play");
    this.systemChromeBtn = root.getElementById("system-chrome");
    this.toggleBtn = root.getElementById("toggle");
    this.restartBtn = root.getElementById("restart");
    this.pickBtn = root.getElementById("pick-btn");
    this.filePick = root.getElementById("file-pick");
    this.trackTitleEl = root.getElementById("track-title");
    this.statusEl = root.getElementById("status");
    this.bassDot = root.getElementById("bass-dot");
    this.midDot = root.getElementById("mid-dot");
    this.airDot = root.getElementById("air-dot");
    this.chromePresets = root.getElementById("chrome-presets");
    this.hideUiBtn = root.getElementById("hide-ui");
    this.uiPeek = root.getElementById("ui-peek");
    this.brandEyebrow = root.getElementById("brand-eyebrow");
    this.vizSwitchBtn = root.getElementById("viz-switch");
    this.vizPicker = root.getElementById("viz-picker");
    this.fxPanel = root.getElementById("fx-panel");
    this.fxPanelCollapse = root.getElementById("fx-panel-collapse");
    this.fxPanelHide = root.getElementById("fx-panel-hide");
    this.fxPeek = root.getElementById("fx-peek");
    this.fxPanelDrag = root.getElementById("fx-panel-drag");
    this.sunScaleSlider = root.getElementById("fx-sun-scale");
    this.sunScaleVal = root.getElementById("fx-sun-scale-val");
  }

  get ctx() {
    return this.canvas.getContext("2d", { alpha: false });
  }
}
