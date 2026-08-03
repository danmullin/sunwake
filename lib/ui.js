import {
  setUiHidden,
  toggleUiHidden,
  setFxPanelHidden,
  toggleFxPanelHidden,
  showFileChrome,
  showSystemChrome,
  syncFxDependencies,
} from "./runtime.js";

/** Gate / chrome / FX panel visibility. */
export class ChromeUi {
  setUiHidden(hidden) {
    setUiHidden(hidden);
  }
  toggleUiHidden() {
    toggleUiHidden();
  }
  setFxPanelHidden(hidden) {
    setFxPanelHidden(hidden);
  }
  toggleFxPanelHidden() {
    toggleFxPanelHidden();
  }
  showFileChrome() {
    showFileChrome();
  }
  showSystemChrome() {
    showSystemChrome();
  }
  syncFxDependencies() {
    syncFxDependencies();
  }
}

export {
  setUiHidden,
  toggleUiHidden,
  setFxPanelHidden,
  toggleFxPanelHidden,
  showFileChrome,
  showSystemChrome,
} from "./runtime.js";
