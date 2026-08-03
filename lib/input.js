import {
  sourceMode, playing, started, filePick, stage, statusEl,
  vizSwitchBtn, vizPicker, FX_TOGGLES, setWhipVerticals,
} from "./state.js";
import {
  stopSystemListen, startSystemListen, toggle, start, restart, loadFile,
} from "./audio.js";
import { setVizMode, toggleVizPicker, setVizPickerOpen } from "./vizMode.js";
import { setUiHidden, toggleUiHidden, toggleFxPanelHidden } from "./ui.js";

function onKey(e) {
  if (e.code === "Space") {
    e.preventDefault();
    if (sourceMode === "system") {
      stopSystemListen();
    } else if (!started) {
      start();
    } else {
      toggle();
    }
  } else if (e.code === "Enter" && !started) {
    e.preventDefault();
    start();
  } else if (e.code === "KeyR") {
    e.preventDefault();
    restart();
  } else if (e.code === "KeyO") {
    e.preventDefault();
    filePick.click();
  } else if (e.code === "KeyS" && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    startSystemListen();
  } else if (e.code === "KeyH") {
    e.preventDefault();
    toggleUiHidden();
  } else if (e.code === "KeyF") {
    e.preventDefault();
    toggleFxPanelHidden();
  } else if (e.code === "KeyV") {
    e.preventDefault();
    FX_TOGGLES.whipVerticals = !FX_TOGGLES.whipVerticals;
    setWhipVerticals(FX_TOGGLES.whipVerticals);
    const box = document.querySelector('input[data-fx="whipVerticals"]');
    if (box) box.checked = FX_TOGGLES.whipVerticals;
    statusEl.textContent = FX_TOGGLES.whipVerticals
      ? "whip verticals on (V / Effects panel)"
      : "whip verticals off";
  } else if (e.code === "KeyN") {
    e.preventDefault();
    if (vizSwitchBtn && !vizSwitchBtn.hidden) {
      if (stage.classList.contains("ui-hidden")) setUiHidden(false);
      toggleVizPicker();
    }
  } else if (e.code === "Escape") {
    if (vizPicker && !vizPicker.hidden) {
      e.preventDefault();
      setVizPickerOpen(false);
    }
  }
}

function onDragOver(e) {
  e.preventDefault();
  stage.classList.add("dragover");
}

function onDragLeave(e) {
  if (e.target === stage || !stage.contains(e.relatedTarget)) {
    stage.classList.remove("dragover");
  }
}

function onDrop(e) {
  e.preventDefault();
  stage.classList.remove("dragover");
  const file = e.dataTransfer?.files?.[0];
  if (file) loadFile(file);
}

/** Keyboard + drag/drop bindings. */
export class InputBindings {
  onKey(e) { onKey(e); }
  onDragOver(e) { onDragOver(e); }
  onDragLeave(e) { onDragLeave(e); }
  onDrop(e) { onDrop(e); }
  bind() {
    window.addEventListener("keydown", onKey);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
  }
}

export { onKey, onDragOver, onDragLeave, onDrop };
