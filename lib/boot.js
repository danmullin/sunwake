/**
 * Boot — wire DOM, seed world, start the renderer loop.
 */
import {
  canvas, ctx, W, H, dpr, setDimensions, setRaf,
  playBtn, systemPlayBtn, systemChromeBtn, toggleBtn, restartBtn,
  hideUiBtn, uiPeek, filePick, statusEl, vizSwitchBtn, vizPicker,
  FX_TOGGLES, setWhipVerticals,
  gridCells, gridTrails, sparks, meteors, mirrorCells, heartbeats,
  bloomRings, infalls, skylineWinLits, skylineParty, VIZ_MODES,
} from "./state.js";
import { PERF } from "./perf.js";
import { syncFxDependencies, applySunScale } from "./fxConfig.js";
import {
  setUiHidden, toggleUiHidden, setFxPanelHidden, syncVizModeUi,
} from "./ui.js";
import {
  ensureGraph, start, toggle, restart, loadFile,
  startSystemListen, setTrackTitle, loadBuildStamp,
} from "./audio.js";
import { onKey, onDragOver, onDragLeave, onDrop } from "./input.js";
import { setVizMode, setVizPickerOpen, toggleVizPicker, setVizModeSeedHooks } from "./vizMode.js";
import { setRainSpawnHooks, setSkylineSimHooks, resetWorld, setWorldSeedHooks } from "./simulation.js";
import { seedStormClouds, spawnLightning, spawnRainSplash } from "./storm.js";
import { seedArcadeStars } from "./scenes/arcade.js";
import {
  seedSkylineCity,
  spawnSkylineWinFlock,
  spawnSkylineWinCells,
  spawnSkylineParty,
  updateSkylineWinLits,
  updateSkylineParty,
  updateSkylineEq,
} from "./scenes/skyline.js";
import { getScene } from "./sceneRegistry.js";
import { vizMode } from "./state.js";
import { frame } from "./renderer.js";

setVizModeSeedHooks(seedStormClouds, seedArcadeStars);
setRainSpawnHooks(spawnLightning, spawnRainSplash);
setWorldSeedHooks(seedArcadeStars);
setSkylineSimHooks({
  spawnSkylineWinFlock,
  spawnSkylineWinCells,
  spawnSkylineParty,
  updateSkylineWinLits,
  updateSkylineParty,
  updateSkylineEq,
});

export function resize() {
  setDimensions(
    window.innerWidth,
    window.innerHeight,
    Math.min(window.devicePixelRatio || 1, PERF.dprCap)
  );
  canvas.width = Math.floor(W * dpr);
  canvas.height = Math.floor(H * dpr);
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  seedSkylineCity();
  try {
    getScene(vizMode)?.onResize?.(W, H);
  } catch {
    /* scenes may not be registered yet during first resize */
  }
}

/** Start the viz loop and wire DOM — call once from SunwakeApp. */
export function startRuntime() {
  resize();
  resetWorld();
  setTrackTitle(null);
  loadBuildStamp();
  window.addEventListener("resize", resize);
  playBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    filePick?.click();
  });
  systemPlayBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    startSystemListen(e);
  });
  systemChromeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    startSystemListen(e);
  });
  toggleBtn.addEventListener("click", toggle);
  restartBtn.addEventListener("click", restart);
  hideUiBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleUiHidden();
  });
  uiPeek?.addEventListener("click", (e) => {
    e.stopPropagation();
    setUiHidden(false);
  });

  const fxPanel = document.getElementById("fx-panel");
  const fxPanelCollapse = document.getElementById("fx-panel-collapse");
  const fxPanelHide = document.getElementById("fx-panel-hide");
  const fxPeek = document.getElementById("fx-peek");
  const fxPanelDrag = document.getElementById("fx-panel-drag");

  fxPanelCollapse?.addEventListener("click", (e) => {
    e.stopPropagation();
    fxPanel?.classList.toggle("collapsed");
    fxPanelCollapse.textContent = fxPanel?.classList.contains("collapsed") ? "+" : "−";
  });
  fxPanelHide?.addEventListener("click", (e) => {
    e.stopPropagation();
    setFxPanelHidden(true);
  });
  fxPeek?.addEventListener("click", (e) => {
    e.stopPropagation();
    setFxPanelHidden(false);
  });
  fxPanel?.addEventListener("click", (e) => e.stopPropagation());

  if (fxPanel && fxPanelDrag) {
    let drag = null;
    fxPanelDrag.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button")) return;
      e.preventDefault();
      const rect = fxPanel.getBoundingClientRect();
      drag = {
        id: e.pointerId,
        ox: e.clientX - rect.left,
        oy: e.clientY - rect.top,
      };
      fxPanelDrag.setPointerCapture(e.pointerId);
      fxPanel.classList.add("dragging");
      fxPanel.style.left = `${rect.left}px`;
      fxPanel.style.top = `${rect.top}px`;
      fxPanel.style.bottom = "auto";
      fxPanel.style.right = "auto";
    });
    fxPanelDrag.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const maxX = Math.max(8, window.innerWidth - fxPanel.offsetWidth - 8);
      const maxY = Math.max(8, window.innerHeight - fxPanel.offsetHeight - 8);
      const x = Math.min(maxX, Math.max(8, e.clientX - drag.ox));
      const y = Math.min(maxY, Math.max(8, e.clientY - drag.oy));
      fxPanel.style.left = `${x}px`;
      fxPanel.style.top = `${y}px`;
    });
    const endDrag = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      drag = null;
      fxPanel.classList.remove("dragging");
      try {
        fxPanelDrag.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    };
    fxPanelDrag.addEventListener("pointerup", endDrag);
    fxPanelDrag.addEventListener("pointercancel", endDrag);
  }

  for (const input of document.querySelectorAll("#fx-panel input[data-fx]")) {
    const key = input.dataset.fx;
    if (!key || !(key in FX_TOGGLES)) continue;
    input.checked = !!FX_TOGGLES[key];
    input.addEventListener("change", () => {
      FX_TOGGLES[key] = input.checked;
      if (key === "whipVerticals") setWhipVerticals(input.checked);
      if (key === "litFlocks" && !input.checked) {
        gridCells.length = 0;
        gridTrails.length = 0;
        skylineWinLits.length = 0;
      }
      if (key === "sparks" && !input.checked) {
        sparks.length = 0;
        skylineParty.length = 0;
      }
      if (key === "constellationTrails" && !input.checked) gridTrails.length = 0;
      if (key === "vanishingMeteors" && !input.checked) meteors.length = 0;
      if (key === "mirrorSea" && !input.checked) mirrorCells.length = 0;
      if (key === "gridHeartbeat" && !input.checked) heartbeats.length = 0;
      if (key === "horizonBloom" && !input.checked) bloomRings.length = 0;
      if (key === "blackHole" && !input.checked) {
        infalls.length = 0;
      }
      syncFxDependencies();
    });
  }
  syncFxDependencies();

  const sunScaleSlider = document.getElementById("fx-sun-scale");
  if (sunScaleSlider) {
    applySunScale(sunScaleSlider.value);
    sunScaleSlider.addEventListener("input", () => applySunScale(sunScaleSlider.value));
  }

  filePick.addEventListener("change", () => {
    const file = filePick.files?.[0];
    if (file) loadFile(file);
    filePick.value = "";
  });
  filePick.addEventListener("click", (e) => e.stopPropagation());

  document.querySelectorAll("[data-viz]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const mode = btn.getAttribute("data-viz");
      if (VIZ_MODES.includes(mode)) setVizMode(mode);
    });
  });
  vizSwitchBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleVizPicker();
  });
  document.addEventListener("click", (e) => {
    if (!vizPicker || vizPicker.hidden) return;
    const wrap = vizSwitchBtn?.closest(".viz-switch-wrap");
    if (wrap && wrap.contains(e.target)) return;
    setVizPickerOpen(false);
  });
  syncVizModeUi();

  window.addEventListener("keydown", onKey);
  window.addEventListener("dragover", onDragOver);
  window.addEventListener("dragleave", onDragLeave);
  window.addEventListener("drop", onDrop);

  setRaf(requestAnimationFrame(frame));
  statusEl.textContent = "waiting…";
}
