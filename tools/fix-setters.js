/**
 * Replace raw primitive assignments in runtime.js with setter calls.
 * Run: node tools/fix-setters.js
 */
const fs = require("fs");
const path = require("path");

const runtimePath = path.join(__dirname, "../lib/runtime.js");
let src = fs.readFileSync(runtimePath, "utf8");

// Simple line-by-line replacements.
// Each entry: [exactLineContent, replacement]
// We match on trimmed content and preserve indentation.

const replacements = [
  // audioCtx
  ["audioCtx = new AudioContext();", "setAudioCtx(new AudioContext());"],
  ["analyser = audioCtx.createAnalyser();", "setAnalyser(audioCtx.createAnalyser());"],
  ["freq = new Uint8Array(analyser.frequencyBinCount);", "setFreq(new Uint8Array(analyser.frequencyBinCount));"],
  ["time = new Uint8Array(analyser.fftSize);", "setTime(new Uint8Array(analyser.fftSize));"],
  // displayStream
  ["displayStream = null;", "setDisplayStream(null);"],
  ["displayStream = stream;", "setDisplayStream(stream);"],
  // source
  ["source = null;", "setSource(null);"],
  ["source = audioCtx.createMediaElementSource(audio);", "setSource(audioCtx.createMediaElementSource(audio));"],
  ["source = audioCtx.createMediaStreamSource(displayStream);", "setSource(audioCtx.createMediaStreamSource(displayStream));"],
  // objectUrl
  ["objectUrl = null;", "setObjectUrl(null);"],
  ["objectUrl = url;", "setObjectUrl(url);"],
  // audio element
  ["audio = new Audio(url);", "setAudio(new Audio(url));"],
  ["audio = null;", "setAudio(null);"],
  // playing / started
  ["playing = false;", "setPlaying(false);"],
  ["playing = true;", "setPlaying(true);"],
  ["started = true;", "setStarted(true);"],
  ["started = false;", "setStarted(false);"],
  // sourceMode
  ['sourceMode = "file";', 'setSourceMode("file");'],
  ['sourceMode = "idle";', 'setSourceMode("idle");'],
  ['sourceMode = "system";', 'setSourceMode("system");'],
  // currentTrack
  ["currentTrack = { url, title };", "setCurrentTrack({ url, title });"],
  // vizMode
  ["vizMode = mode;", "setVizModeVar(mode);"],
  // dimensions  
  ["W = window.innerWidth;", "setDimensions(window.innerWidth, window.innerHeight, Math.min(window.devicePixelRatio || 1, PERF.dprCap));"],
  ["H = window.innerHeight;", "// H+dpr set by setDimensions above"],
  // raf
  ["raf = requestAnimationFrame(frame);", "setRaf(requestAnimationFrame(frame));"],
  // storm / arcade / tunnel — these have multiple occurrences so handle by presence
  ["stormFlash = 0;", "setStormFlash(0);"],
  ["lastLightningAt = 0;", "setLastLightningAt(0);"],
  ["lastLightningAt = now;", "setLastLightningAt(now);"],
  ["arcadeFlash = 0;", "setArcadeFlash(0);"],
  ["arcadeWarp = 0;", "setArcadeWarp(0);"],
  ["tunnelScroll = 0;", "setTunnelScroll(0);"],
  ["tunnelPulse = 0;", "setTunnelPulse(0);"],
  ["WHIP_VERTICALS = FX_TOGGLES.whipVerticals;", "setWhipVerticals(FX_TOGGLES.whipVerticals);"],
];

// Also handle the dpr line that was a match for the setDimensions  
const lines = src.split("\n");
const out = [];
let changedCount = 0;

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  const trimmed = line.trim();
  
  // Skip comment lines
  if (trimmed.startsWith("//")) { out.push(line); continue; }
  
  let replaced = false;
  for (const [from, to] of replacements) {
    if (trimmed === from) {
      const indent = line.match(/^(\s*)/)[1];
      out.push(indent + to);
      replaced = true;
      changedCount++;
      break;
    }
  }
  if (!replaced) {
    // Handle the dpr assignment that follows the W assignment
    if (trimmed.startsWith("dpr = Math.min(")) {
      const indent = line.match(/^(\s*)/)[1];
      out.push(indent + "// dpr set by setDimensions above");
      changedCount++;
    } else if (trimmed.startsWith("stormFlash = Math.min(") || trimmed.startsWith("stormFlash = ")) {
      const indent = line.match(/^(\s*)/)[1];
      out.push(indent + "set" + trimmed[0].toUpperCase() + trimmed.slice(1, -1) + ");");
      changedCount++;
    } else if (trimmed.startsWith("arcadeWarp = smooth(") || trimmed.startsWith("arcadeFlash = smooth(")) {
      const indent = line.match(/^(\s*)/)[1];
      const varName = trimmed.split(" = ")[0].trim();
      const setter = "set" + varName[0].toUpperCase() + varName.slice(1);
      const val = trimmed.split(" = ").slice(1).join(" = ");
      out.push(indent + setter + "(" + val.slice(0, -1) + ");");
      changedCount++;
    } else if (trimmed.startsWith("tunnelScroll = (") || trimmed.startsWith("tunnelSway = smooth(") || trimmed.startsWith("tunnelPulse = smooth(")) {
      const indent = line.match(/^(\s*)/)[1];
      const varName = trimmed.split(" = ")[0].trim();
      const setter = "set" + varName[0].toUpperCase() + varName.slice(1);
      const val = trimmed.split(" = ").slice(1).join(" = ");
      out.push(indent + setter + "(" + val.slice(0, -1) + ");");
      changedCount++;
    } else if (trimmed.startsWith("skylineKickBob = smooth(") || trimmed.startsWith("skylineDriveSmooth = smooth(") || trimmed.startsWith("skylineScrollPx = ")) {
      const indent = line.match(/^(\s*)/)[1];
      const varName = trimmed.split(" = ")[0].trim();
      const setter = "set" + varName[0].toUpperCase() + varName.slice(1);
      const val = trimmed.split(" = ").slice(1).join(" = ");
      out.push(indent + setter + "(" + val.slice(0, -1) + ");");
      changedCount++;
    } else if (trimmed.startsWith("SUN_SCALE = Math.min(")) {
      const indent = line.match(/^(\s*)/)[1];
      out.push(indent + "setSunScale(Math.min(SUN_SCALE_MAX, Math.max(SUN_SCALE_MIN, n)));");
      changedCount++;
    } else {
      out.push(line);
    }
  }
}

fs.writeFileSync(runtimePath, out.join("\n"), "utf8");
console.log("Changed", changedCount, "lines. Total:", out.length);
