/**
 * Post-extraction fixes:
 * 1. Move syncVizModeUi to ui.js (breaks circular dep with vizMode.js)
 * 2. Add TUNNEL constants to tunnel.js
 * 3. Add `let streakDir = 0` to simulation.js
 * 4. Update vizMode.js to import syncVizModeUi from ui.js
 * 5. Syntax-check everything
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const ROOT = path.resolve(__dirname, "..");

function read(rel) { return fs.readFileSync(path.join(ROOT, rel), "utf8"); }
function write(rel, content) {
  fs.writeFileSync(path.join(ROOT, rel), content, "utf8");
  console.log(`  Wrote ${rel} (${content.split("\n").length} lines)`);
}
function check(rel) {
  try {
    execSync(`node --check "${path.join(ROOT, rel)}"`, { stdio: "pipe" });
    return true;
  } catch(e) {
    console.error(`  ERR ${rel}: ${e.stderr?.toString().split("\n")[0]}`);
    return false;
  }
}

// ── 1. Extract syncVizModeUi from vizMode.js ─────────────────────────────
let vmSrc = read("lib/vizMode.js");

// Find and extract the syncVizModeUi function body
const vmLines = vmSrc.split("\n");
let syncStart = -1;
for (let i = 0; i < vmLines.length; i++) {
  if (/^function syncVizModeUi\(/.test(vmLines[i])) { syncStart = i; break; }
}
if (syncStart === -1) {
  console.log("syncVizModeUi not found in vizMode.js — already moved?");
} else {
  // Find end of function
  let depth = 0, opened = false, syncEnd = -1;
  for (let i = syncStart; i < vmLines.length; i++) {
    for (const c of vmLines[i]) {
      if (c === "{") { depth++; opened = true; }
      else if (c === "}") depth--;
    }
    if (opened && depth === 0) { syncEnd = i; break; }
  }
  const syncFn = vmLines.slice(syncStart, syncEnd + 1).join("\n");
  console.log(`  syncVizModeUi: lines ${syncStart+1}-${syncEnd+1}`);

  // ── 2. Add syncVizModeUi to ui.js ──────────────────────────────────────
  let uiSrc = read("lib/ui.js");

  // Add vizMode-related state imports and the function
  const vizModeImports = `import {
  vizMode, VIZ_MODE_LABELS, brandEyebrow, vizSwitchBtn, vizPicker,
  started, gate,
} from "./state.js";`;

  const localVizModeLabel = `
// Local helper — avoids importing from vizMode.js (would create circular dep)
function vizModeLabel(mode) {
  mode = mode ?? vizMode;
  if (mode === "skyline")   return "skyline";
  if (mode === "rainDrive") return "rain drive";
  if (mode === "tunnel")    return "tunnel";
  if (mode === "arcade")    return "arcade";
  return "night drive";
}
`;

  // Insert before the export class
  const exportClassPos = uiSrc.indexOf("\n/** Gate / chrome");
  if (exportClassPos === -1) {
    console.error("  Could not find insertion point in ui.js");
  } else {
    const before = uiSrc.slice(0, exportClassPos);
    const after = uiSrc.slice(exportClassPos);

    // Extend the state import to include the new vars
    let newUiSrc = before + "\n" + localVizModeLabel + "\n" + syncFn + "\n" + after;

    // Also extend the first state.js import line to include the new vars needed by syncVizModeUi
    newUiSrc = newUiSrc.replace(
      `import {
  stage, gate, toggleBtn, restartBtn, pickBtn, systemChromeBtn,
  chromePresets, vizSwitchBtn, vizPicker, hideUiBtn, uiPeek, statusEl,
} from "./state.js";`,
      `import {
  stage, gate, toggleBtn, restartBtn, pickBtn, systemChromeBtn,
  chromePresets, vizSwitchBtn, vizPicker, hideUiBtn, uiPeek, statusEl,
  vizMode, VIZ_MODE_LABELS, brandEyebrow, started,
} from "./state.js";`
    );

    // Update exports to include syncVizModeUi
    newUiSrc = newUiSrc.replace(
      `export {
  setUiHidden, toggleUiHidden,
  setFxPanelHidden, toggleFxPanelHidden,
  showFileChrome, showSystemChrome,
};`,
      `export {
  setUiHidden, toggleUiHidden,
  setFxPanelHidden, toggleFxPanelHidden,
  showFileChrome, showSystemChrome,
  syncVizModeUi,
};`
    );

    write("lib/ui.js", newUiSrc);
  }

  // ── 3. Update vizMode.js ─────────────────────────────────────────────────
  // Remove syncVizModeUi definition, import it from ui.js instead
  const vmWithoutSync = vmLines.filter((_, i) => i < syncStart || i > syncEnd).join("\n");

  // Replace the setFxPanelHidden import with syncVizModeUi import from ui.js
  let newVmSrc = vmWithoutSync.replace(
    `import { setFxPanelHidden } from "./ui.js";`,
    `import { setFxPanelHidden, syncVizModeUi } from "./ui.js";`
  );

  // Update the export block: syncVizModeUi is now re-exported via ui.js, keep it in export
  // (it's already re-exported since we import it at module scope)
  write("lib/vizMode.js", newVmSrc);
}

// ── 4. Add TUNNEL constants to tunnel.js ────────────────────────────────
let tunnelSrc = read("lib/scenes/tunnel.js");
if (!tunnelSrc.includes("TUNNEL_RIBS")) {
  const tunnelConsts = `
const TUNNEL_RIBS = 28;
const TUNNEL_RIB_SPACING = 0.072;
const TUNNEL_FOV = 0.72;
`;
  // Insert after the last import line
  const lastImportEnd = (() => {
    const lines = tunnelSrc.split("\n");
    let last = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith("import ") || lines[i].startsWith("} from ")) last = i;
      else if (last !== -1 && lines[i].trim() !== "") break;
    }
    return last;
  })();
  const lines = tunnelSrc.split("\n");
  lines.splice(lastImportEnd + 1, 0, tunnelConsts);
  tunnelSrc = lines.join("\n");
  write("lib/scenes/tunnel.js", tunnelSrc);
} else {
  console.log("  tunnel.js already has TUNNEL_RIBS");
}

// ── 5. Add streakDir to simulation.js ────────────────────────────────────
let simSrc = read("lib/simulation.js");
if (!simSrc.includes("let streakDir")) {
  // Insert before the first function definition
  simSrc = simSrc.replace(
    "\nfunction isSeaDrive()",
    "\nlet streakDir = 0;\n\nfunction isSeaDrive()"
  );
  write("lib/simulation.js", simSrc);
} else {
  console.log("  simulation.js already has streakDir");
}

// ── 6. Syntax check all ──────────────────────────────────────────────────
console.log("\nSyntax checking…");
const filesToCheck = [
  "lib/fxConfig.js", "lib/ui.js", "lib/vizMode.js",
  "lib/audio.js", "lib/input.js", "lib/simulation.js",
  "lib/scenes/nightDrive.js", "lib/scenes/rainDrive.js",
  "lib/scenes/tunnel.js", "lib/scenes/arcade.js", "lib/scenes/skyline.js",
  "lib/renderer.js", "lib/runtime.js",
  "lib/camera.js", "lib/sun.js", "lib/math.js", "lib/perf.js", "lib/state.js",
];
let allOk = true;
for (const f of filesToCheck) {
  const ok = check(f);
  console.log(`  ${ok ? "✓" : "✗"} ${f}`);
  if (!ok) allOk = false;
}
if (allOk) console.log("\nAll files syntax-OK ✓");
