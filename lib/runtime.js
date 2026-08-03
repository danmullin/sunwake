/**
 * Sunwake runtime — core implementation (migrated from the listen.js monolith).
 * Boot is deferred to {@link startRuntime} so {@link SunwakeApp} can compose OOP facades first.
 */

import { getScene } from "./sceneRegistry.js";
import { PERF, updatePerf, sparkCap } from "./perf.js";
import { SW_RAINBOW, synthRainbow, swapRemove, ecgShape, bandEnergy, smooth, midCentroid } from "./math.js";
import {
  // DOM
  canvas, ctx, stage, gate, playBtn, systemPlayBtn, systemChromeBtn,
  toggleBtn, restartBtn, pickBtn, filePick, trackTitleEl, statusEl,
  bassDot, midDot, airDot, chromePresets, hideUiBtn, uiPeek, brandEyebrow,
  vizSwitchBtn, vizPicker,
  // dimensions
  W, H, dpr, setDimensions,
  // viz mode
  VIZ_MODE_LABELS, VIZ_MODE_KEY, VIZ_MODES, vizMode, setVizModeVar,
  // audio
  audioCtx, setAudioCtx, analyser, setAnalyser, freq, setFreq, time, setTime,
  source, setSource, audio, setAudio, objectUrl, setObjectUrl,
  displayStream, setDisplayStream, sourceMode, setSourceMode,
  currentTrack, setCurrentTrack, playing, setPlaying, started, setStarted,
  raf, setRaf, t0, setT0,
  // levels
  levels,
  // FX
  FX_TOGGLES, fxOn, FX_REQUIRES, FX_LABELS, FX,
  // sun
  SUN_SCALE, setSunScale, SUN_SCALE_MIN, SUN_SCALE_MAX, SUN_Y_FRAC,
  SUN_DROP_PER_EXTRA, BH_DISK_TILT,
  // whip + grid
  WHIP_VERTICALS, setWhipVerticals, WHIP_SAMPLE_MS, WHIP_TRAVEL_MS,
  WHIP_CREST_WIDTH, WHIP_STACK,
  GRID_ROWS, GRID_COLS, GRID_CELL_MAX, GRID_TRAIL_MAX, METEOR_MAX, MIRROR_MAX,
  MIRROR_GAP_MS, HEARTBEAT_MAX, BLOOM_MAX, DOORWAY_GAP_MS, DOORWAY_OPEN_MS,
  DOORWAY_HOLD_MS, DOORWAY_CLOSE_MS, KEY_GAP_MS, CHORD_GAP_MS, HAMMER_GAP_MS,
  DRUM_VETO_MS, KEYS_ARM, CHORD_HALO_MAX, MELODY_MAX, HARMONY_LINK_MAX,
  GRID_SUN_COL, BASS_MOUNTAIN_N, DRUM_GAP_KICK_MS, DRUM_GAP_SNARE_MS,
  DRUM_GAP_HAT_MS, GRID_CELL_STEP_MS, GRID_RAINBOW, INFALL_MAX,
  // arrays
  ribbons, dew, fogPuffs, sparks, streaks, shocks, chordHalos, hammerRipples,
  melodyThread, harmonyLinks, stars, rain, mistSheets, cloudDeck, shooting,
  horizonBands, gridCells, gridTrails, meteors, mirrorCells, heartbeats,
  bloomRings, infalls, bassMountain,
  // camera
  CAM, CAM_SWAY_DRAMA, HORIZON_SWAY_BANK, HORIZON_SWAY_VANISH,
  // tunnel
  tunnelScroll, setTunnelScroll, tunnelPulse, setTunnelPulse,
  tunnelSway, setTunnelSway, tunnelPulseRings, TUNNEL_RINGS_MAX,
  // arcade
  ARCADE_EQ_N, arcadeEq, arcadeWarp, setArcadeWarp, arcadeFlash, setArcadeFlash,
  arcadeStars, ARCADE_STAR_N,
  // rain
  stormClouds, lightningBolts, LIGHTNING_MAX, rainSplashes, RAIN_SPLASH_MAX,
  stormFlash, setStormFlash, lastLightningAt, setLastLightningAt,
  // skyline
  skylineFar, skylineMid, skylineNear,
  skylineKickBob, setSkylineKickBob, skylineScrollPx, setSkylineScrollPx,
  skylineDriveSmooth, setSkylineDriveSmooth, SKYLINE_SCROLL_RATE,
  skylineWinLits, SKYLINE_WIN_MAX, SKYLINE_WIN_STEP_MS,
  skylineParty, SKYLINE_PARTY_MAX, SKYLINE_EQ_N, skylineEq,
} from "./state.js";
import { updateCamera, vanishX, applyWorldTransform, resetScreenTransform } from "./camera.js";
import { sunYFrac, sunAnchor, sunDiskRadius, blackHoleOccludeRadius, behindBlackHole } from "./sun.js";
import { syncFxDependencies, applySunScale } from "./fxConfig.js";
import {
  isSeaDrive, vizModeLabel, setVizMode, syncVizModeUi,
  setVizPickerOpen, toggleVizPicker, setVizModeSeedHooks,
} from "./vizMode.js";
import {
  setUiHidden, toggleUiHidden,
  setFxPanelHidden, toggleFxPanelHidden,
  showFileChrome, showSystemChrome,
} from "./ui.js";
import {
  ensureGraph, start, toggle, restart, loadFile,
  startSystemListen, stopSystemListen,
  setTrackTitle, loadBuildStamp,
} from "./audio.js";
import { onKey, onDragOver, onDragLeave, onDrop } from "./input.js";
import {
  spawnGridFlock, stepGridCell, spawnGridCells,
  spawnVanishingMeteor, spawnVanishingMeteors,
  spawnGridHeartbeat, spawnHorizonBloom, spawnMirrorSea, mirrorMeshPoint, drawMirrorSea,
  bassMountainProfile, updateBassMountain, drawBassMountain,
  gridMusicEnergy, gridMusicHot,
  spawnKeySparks, spawnChordHalo, spawnHammerRipple, spawnHarmonyConstellation,
  updateMelodyThread, spawnInfall, spawnSpark, spawnStreak, spawnShock, spawnShootingStar,
  updateFx,
  drawSoloAurora, drawSparks, drawInfallSparks, drawStreaks, drawShocks,
  drawChordHalos, drawMelodyThread, drawHammerRipples, drawHarmonyConstellation,
  drawSky, drawStars, drawShootingStars, drawHorizonRibbons, drawMistSheets,
  drawCloudDeck, drawRain, drawSunPetals, drawQuasarJets, drawSunFlares,
  drawSoftSun, drawHorizon, drawSea,
  drawFog, drawDew, drawHeartbeatRing, drawUsPresence, drawVignette,
  updateMeters, setRainSpawnHooks,
} from "./simulation.js";
import { seedSkylineCity, drawSkyline, updateSkylineEq } from "./scenes/skyline.js";
import { seedStormClouds, spawnLightning, spawnRainSplash } from "./storm.js";
import {
  seedArcadeStars, updateArcadeCabinet, drawArcadeCabinet, updateArcadeEq,
} from "./scenes/arcade.js";
import { updateTunnel, drawTunnel } from "./scenes/tunnel.js";
import { drawNightDrive } from "./scenes/nightDrive.js";
import { frame } from "./renderer.js";

setVizModeSeedHooks(seedStormClouds, seedArcadeStars);
setRainSpawnHooks(spawnLightning, spawnRainSplash);

function resize() {
  setDimensions(window.innerWidth, window.innerHeight, Math.min(window.devicePixelRatio || 1, PERF.dprCap));
  canvas.width = Math.floor(W * dpr);
  canvas.height = Math.floor(H * dpr);
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  seedSkylineCity();
  try {
    getScene(vizMode)?.onResize?.(W, H);
  } catch {
    /* scenes may not be registered yet during first resize inside startRuntime */
  }
}

function seedWorld() {
  dew.length = 0;
  fogPuffs.length = 0;
  sparks.length = 0;
  streaks.length = 0;
  shocks.length = 0;
  chordHalos.length = 0;
  hammerRipples.length = 0;
  melodyThread.length = 0;
  harmonyLinks.length = 0;
  stars.length = 0;
  rain.length = 0;
  mistSheets.length = 0;
  cloudDeck.length = 0;
  shooting.length = 0;
  rainSplashes.length = 0;
  setStormFlash(0);
  setLastLightningAt(0);
  lightningBolts.length = 0;
  seedStormClouds();
  seedArcadeStars();
  setArcadeFlash(0);
  setArcadeWarp(0);
  horizonBands.length = 0;
  meteors.length = 0;
  mirrorCells.length = 0;
  heartbeats.length = 0;
  bloomRings.length = 0;
  infalls.length = 0;
  bassMountain.fill(0);
  FX.solo = 0;
  FX.keys = 0;
  FX.sustain = 0;
  FX.chord = 0;
  FX.prevChord = 0;
  FX.lastDrumAt = 0;
  FX.prevBass = 0;
  FX.prevAir = 0;
  FX.sparkBudget = 0;
  FX.doorway = 0;
  FX.lastDoorwayAt = 0;
  FX.mist = 0;
  FX.flare = 0;
  FX.jet = 0;
  FX.photon = 0;

  for (let i = 0; i < 5; i++) {
    ribbons.push({
      phase: Math.random() * Math.PI * 2,
      speed: 0.35 + i * 0.08,
      amp: 28 + i * 10,
      y: 0.42 + i * 0.055,
      hue: i % 2 === 0 ? "cyan" : "rose",
      width: 1.4 + i * 0.35,
    });
  }

  for (let i = 0; i < 90; i++) {
    dew.push({
      x: Math.random(),
      y: Math.random() * 0.72,
      r: 0.6 + Math.random() * 1.8,
      tw: Math.random() * Math.PI * 2,
      sp: 0.2 + Math.random() * 0.7,
    });
  }

  for (let i = 0; i < 18; i++) {
    fogPuffs.push({
      x: Math.random(),
      y: 0.55 + Math.random() * 0.35,
      r: 120 + Math.random() * 220,
      drift: (Math.random() - 0.5) * 0.03,
      alpha: 0.04 + Math.random() * 0.06,
    });
  }

  for (let i = 0; i < 220; i++) {
    stars.push({
      x: Math.random(),
      y: Math.random() * 0.48,
      r: Math.random() < 0.12 ? 1.4 + Math.random() * 1.6 : 0.5 + Math.random() * 1.1,
      tw: Math.random() * Math.PI * 2,
      sp: 0.35 + Math.random() * 1.2,
      bright: 0.25 + Math.random() * 0.75,
      flare: Math.random() < 0.08,
    });
  }

  for (let i = 0; i < 160; i++) {
    rain.push({
      x: Math.random(),
      y: Math.random(),
      len: 0.012 + Math.random() * 0.028,
      sp: 0.004 + Math.random() * 0.009,
      drift: 0.0015 + Math.random() * 0.003,
      a: 0.12 + Math.random() * 0.28,
    });
  }

  for (let i = 0; i < 5; i++) {
    mistSheets.push({
      x: Math.random(),
      y: 0.15 + Math.random() * 0.55,
      w: 0.35 + Math.random() * 0.55,
      h: 0.08 + Math.random() * 0.14,
      angle: -0.55 - Math.random() * 0.35,
      drift: (Math.random() - 0.5) * 0.00025,
      phase: Math.random() * Math.PI * 2,
      hue: i % 2 === 0 ? "cyan" : "rose",
    });
  }

  // Slow parallax cloud bands — live above the horizon, bloom on pads
  for (let i = 0; i < 5; i++) {
    const depth = i / 4; // 0 far → 1 near
    const puffs = [];
    const n = 4 + (i % 3);
    for (let p = 0; p < n; p++) {
      puffs.push({
        u: p / n + (Math.random() - 0.5) * 0.08,
        w: 0.14 + Math.random() * 0.18,
        h: 0.55 + Math.random() * 0.55,
        lift: (Math.random() - 0.5) * 0.35,
      });
    }
    cloudDeck.push({
      y: 0.26 + depth * 0.2,
      h: 0.028 + depth * 0.022,
      // nearer bands drift a little faster
      speed: 0.000028 + depth * 0.000055,
      offset: Math.random(),
      phase: Math.random() * Math.PI * 2,
      depth,
      hue: i % 3 === 0 ? "cyan" : i % 3 === 1 ? "rose" : "violet",
      puffs,
    });
  }

  for (let i = 0; i < 4; i++) {
    horizonBands.push({
      y: 0.44 + i * 0.018,
      amp: 6 + i * 3,
      speed: 0.4 + i * 0.12,
      phase: Math.random() * Math.PI * 2,
      hue: i % 3 === 0 ? "cyan" : i % 3 === 1 ? "rose" : "gold",
      width: 1.2 + i * 0.35,
    });
  }
}



/**
 * Skyline sun — wake, rays, kick rings, flare, music-reactive corona.
 */
// ─── Tunnel ───────────────────────────────────────────────────────────────────


/**
 * Classic side-view highway + skyline strip — flat parallax, no vanish grid.
 */

// lifted from boot wiring: applySunScale
// Looks up DOM by id — must not close over startRuntime locals.

/** Start the viz loop and wire DOM — call once from SunwakeApp. */
export function startRuntime() {
  resize();
  seedWorld();
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

  // Drag FX panel by the title bar
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
        // Leave child toggles armed so turning Black hole back on is one click
        infalls.length = 0;
      }
      syncFxDependencies();
    });
  }
  syncFxDependencies();

  const sunScaleSlider = document.getElementById("fx-sun-scale");
  const sunScaleVal = document.getElementById("fx-sun-scale-val");
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



export {
  // mode / UI
  vizMode, VIZ_MODES, VIZ_MODE_LABELS,
  isSeaDrive, vizModeLabel,
  setVizMode, syncVizModeUi, setVizPickerOpen, toggleVizPicker,
  // fx
  FX, FX_TOGGLES, FX_REQUIRES, FX_LABELS, fxOn,
  syncFxDependencies, applySunScale,
  // audio / playback
  ensureGraph, start, toggle, restart, loadFile,
  startSystemListen, stopSystemListen,
  playing, started, sourceMode, levels,
  // canvas
  canvas, ctx, stage, W, H, dpr,
  resize, PERF, updatePerf, sparkCap,
  // camera / sun
  CAM, updateCamera, vanishX, applyWorldTransform, resetScreenTransform,
  SUN_SCALE, sunAnchor, sunDiskRadius,
  // world seeds + update
  seedWorld, seedSkylineCity, seedArcadeStars, seedStormClouds, updateFx,
  // scene draws
  drawNightDrive, drawTunnel, drawArcadeCabinet, drawSkyline,
  updateTunnel, updateArcadeCabinet, updateArcadeEq, updateSkylineEq,
  // frame loop
  frame,
  // input
  onKey, onDragOver, onDragLeave, onDrop,
  setUiHidden, toggleUiHidden, setFxPanelHidden, toggleFxPanelHidden,
  showFileChrome, showSystemChrome,
  // math (re-export for compatibility)
  smooth, bandEnergy, swapRemove, synthRainbow, midCentroid, WHIP_VERTICALS,
};
