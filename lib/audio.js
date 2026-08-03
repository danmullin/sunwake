import {
  stage, toggleBtn, restartBtn, pickBtn, filePick, trackTitleEl, statusEl,
  chromePresets, vizSwitchBtn,
  audioCtx, setAudioCtx, analyser, setAnalyser, freq, setFreq,
  time, setTime, source, setSource, audio, setAudio,
  objectUrl, setObjectUrl, displayStream, setDisplayStream,
  sourceMode, setSourceMode, currentTrack, setCurrentTrack,
  playing, setPlaying, started, setStarted, raf, setRaf,
  levels,
} from "./state.js";
import {
  showFileChrome, showSystemChrome, setUsMode,
} from "./ui.js";
// setUsMode lives in ui.js (stage class toggle)

/** frame() proxy set by renderer.js to avoid a circular dependency. */
let _frameFn = null;
export function setFrameRef(fn) { _frameFn = fn; }
function frame() { if (_frameFn) return _frameFn(...arguments); }

function prettyName(filename) {
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function setTrackTitle(title) {
  if (trackTitleEl) {
    if (title) {
      trackTitleEl.hidden = false;
      trackTitleEl.textContent = title;
    } else {
      trackTitleEl.textContent = "";
      trackTitleEl.hidden = true;
    }
  }
  document.title = title ? `Sunwake — ${title}` : "Sunwake";
}

async function loadBuildStamp() {
  const el = document.getElementById("build-stamp");
  try {
    // runtime lives in lib/ — version.json is at the site root
    const res = await fetch(new URL("../version.json", import.meta.url), {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const v = await res.json();
    const codename = v.codename || "Quasar";
    const sha = v.sha || "local";
    const date = v.date || "dev";
    const name = v.name || "Sunwake";
    const short = `${codename} · ${sha}`;
    const full = `${name} “${codename}” — ${date} · ${sha}`;
    if (el) {
      el.hidden = false;
      el.textContent = short;
      el.title = full;
    }
    console.log(`%c${full}`, "color:#45e0ff;font-weight:600");
  } catch (err) {
    if (el) el.hidden = true;
    console.warn("Sunwake build stamp missing", err);
  }
}

function ensureGraph() {
  if (!audioCtx) {
    setAudioCtx(new AudioContext());
    setAnalyser(audioCtx.createAnalyser());
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.82;
    setFreq(new Uint8Array(analyser.frequencyBinCount));
    setTime(new Uint8Array(analyser.fftSize));
    // Analyser stays analyse-only. File sources connect to destination separately
    // so system capture never double-plays through the speakers.
  }
}

function stopDisplayStream() {
  if (!displayStream) return;
  for (const track of displayStream.getTracks()) {
    try {
      track.stop();
    } catch {
      /* ignore */
    }
  }
  setDisplayStream(null);
}

function detachAudio() {
  if (audio) {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  }
  if (source) {
    try {
      source.disconnect();
    } catch {
      /* already disconnected */
    }
    setSource(null);
  }
  stopDisplayStream();
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    setObjectUrl(null);
  }
  setAudio(null);
}

function wireAudioElement(url) {
  ensureGraph();
  detachAudio();

  setAudio(new Audio(url));
  audio.crossOrigin = "anonymous";
  audio.loop = false;
  audio.preload = "auto";

  setSource(audioCtx.createMediaElementSource(audio));
  source.connect(analyser);
  source.connect(audioCtx.destination);

  audio.addEventListener("ended", () => {
    setPlaying(false);
    toggleBtn.textContent = "Play";
    statusEl.textContent = "ended — hit Restart";
  });
}

async function loadTrack({ url, title, autoplay = false }) {
  setCurrentTrack({ url, title });
  setSourceMode("file");
  setTrackTitle(title);
  wireAudioElement(url);

  if (autoplay || started) {
    if (audioCtx.state === "suspended") await audioCtx.resume();
    await audio.play();
    setPlaying(true);
    setStarted(true);
    showFileChrome();
    statusEl.textContent = "listening";
    if (!raf) setRaf(requestAnimationFrame(frame));
  } else {
    statusEl.textContent = `loaded — ${title}`;
  }
}

async function loadFile(file) {
  if (!file) return;
  if (!file.type.startsWith("audio/")) {
    const ok = /\.(mp3|wav|flac|m4a|aac|ogg|opus|webm)$/i.test(file.name || "");
    if (!ok) {
      statusEl.textContent = "need an audio file";
      return;
    }
  }
  const url = URL.createObjectURL(file);
  const prev = objectUrl;
  setObjectUrl(null);
  if (prev) URL.revokeObjectURL(prev);
  await loadTrack({
    url,
    title: prettyName(file.name),
    autoplay: true,
  });
  setObjectUrl(url);
}

function onSystemShareEnded() {
  if (sourceMode !== "system") return;
  setPlaying(false);
  setSourceMode("idle");
  if (source) {
    try {
      source.disconnect();
    } catch {
      /* ignore */
    }
    setSource(null);
  }
  setDisplayStream(null);
  setUsMode(false);
  toggleBtn.textContent = "System audio";
  restartBtn.hidden = true;
  systemChromeBtn.hidden = false;
  statusEl.textContent = "share ended";
}

async function startSystemListen(e) {
  e?.stopPropagation?.();
  ensureGraph();
  if (audioCtx.state === "suspended") await audioCtx.resume();

  statusEl.textContent = "pick Entire screen + system audio…";

  let stream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
      systemAudio: "include",
    });
  } catch {
    statusEl.textContent = "share cancelled";
    return;
  }

  const audioTracks = stream.getAudioTracks();
  if (!audioTracks.length) {
    for (const track of stream.getTracks()) track.stop();
    statusEl.textContent = "enable Share system audio";
    return;
  }

  detachAudio();
  setDisplayStream(stream);

  setSource(audioCtx.createMediaStreamSource(displayStream));
  // Analyse only — never connect to destination (you'd hear a second copy).
  source.connect(analyser);

  for (const track of displayStream.getAudioTracks()) {
    track.addEventListener("ended", onSystemShareEnded);
  }

  setSourceMode("system");
  setPlaying(true);
  setStarted(true);
  setTrackTitle("system audio");
  showSystemChrome();
  statusEl.textContent = "listening to system audio";
  if (!raf) setRaf(requestAnimationFrame(frame));
}

function stopSystemListen() {
  if (sourceMode !== "system") return;
  detachAudio();
  setSourceMode("idle");
  setPlaying(false);
  setUsMode(false);
  toggleBtn.textContent = "System audio";
  restartBtn.hidden = true;
  systemChromeBtn.hidden = false;
  pickBtn.hidden = false;
  if (chromePresets) chromePresets.hidden = true;
  setTrackTitle(currentTrack.title || null);
  statusEl.textContent = "share ended";
}

async function start() {
  if (sourceMode === "system") return;
  if (!audio) {
    filePick?.click();
    return;
  }
  if (audioCtx.state === "suspended") await audioCtx.resume();
  await audio.play();
  setPlaying(true);
  setStarted(true);
  setSourceMode("file");
  showFileChrome();
  statusEl.textContent = "listening";
  if (!raf) setRaf(requestAnimationFrame(frame));
}

function toggle() {
  if (sourceMode === "system") {
    stopSystemListen();
    return;
  }
  if (!started) return start();
  if (!audio) {
    if (toggleBtn.textContent.toLowerCase().includes("system")) {
      startSystemListen();
    }
    return;
  }
  if (playing) {
    audio.pause();
    setPlaying(false);
    toggleBtn.textContent = "Play";
    statusEl.textContent = "paused";
  } else {
    if (audio.ended || (audio.duration && audio.currentTime >= audio.duration - 0.05)) {
      audio.currentTime = 0;
    }
    audio.play();
    setPlaying(true);
    toggleBtn.textContent = "Pause";
    statusEl.textContent = "listening";
  }
}

async function restart() {
  if (sourceMode === "system") {
    statusEl.textContent = "system mode — stop share to switch songs";
    return;
  }
  if (!started) return start();
  if (!audio) return;
  if (audioCtx?.state === "suspended") await audioCtx.resume();
  audio.currentTime = 0;
  await audio.play();
  setPlaying(true);
  toggleBtn.textContent = "Pause";
  statusEl.textContent = "restarted";
}

/** Web Audio graph, file + system capture, level meters. */
export class AudioEngine {
  get levels()     { return levels; }
  get playing()    { return playing; }
  get started()    { return started; }
  get sourceMode() { return sourceMode; }
  ensureGraph()    { return ensureGraph(); }
  start()          { return start(); }
  toggle()         { return toggle(); }
  restart()        { return restart(); }
  loadFile(file)   { return loadFile(file); }
  startSystemListen(e) { return startSystemListen(e); }
  stopSystemListen()   { return stopSystemListen(); }
}

export {
  ensureGraph, start, toggle, restart, loadFile,
  startSystemListen, stopSystemListen,
  playing, started, sourceMode, levels,
  setTrackTitle, loadBuildStamp, prettyName,
  wireAudioElement, loadTrack, detachAudio, stopDisplayStream,
};
