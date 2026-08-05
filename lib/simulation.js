/**
 * Simulation — the audio-reactive orchestrator. Reads the frame's frequency
 * bands, decides which drum lane fired, and calls into the effect modules
 * (lib/effects/*.js + storm.js) to spawn and age their own particles.
 *
 * This file owns no particle arrays itself — only the FX clocks/gates
 * (FX.solo, FX.keys, FX.chord, drum-gap timestamps, etc.) that decide *when*
 * something fires. The *what happens* lives in the effect module it calls.
 */
import {
  vizMode, playing, sourceMode, levels, fxOn, FX,
  WHIP_VERTICALS, WHIP_SAMPLE_MS, WHIP_TRAVEL_MS,
  GRID_COLS, GRID_SUN_COL, MIRROR_GAP_MS,
  DOORWAY_GAP_MS, DOORWAY_OPEN_MS, DOORWAY_HOLD_MS, DOORWAY_CLOSE_MS,
  KEY_GAP_MS, CHORD_GAP_MS, HAMMER_GAP_MS, DRUM_VETO_MS, KEYS_ARM,
  DRUM_GAP_KICK_MS, DRUM_GAP_SNARE_MS, DRUM_GAP_HAT_MS,
  gridCells, skylineWinLits, skylineParty,
  setArcadeFlash, setArcadeWarp,
  lastLightningAt, setLastLightningAt,
  bassDot, midDot, airDot, stage,
} from "./state.js";
import { PERF } from "./perf.js";
import { smooth } from "./math.js";
import {
  spawnGridCells, spawnVanishingMeteor, spawnGridHeartbeat, spawnHorizonBloom,
  spawnMirrorSea, updateBassMountain, gridMusicEnergy, tickGridSea, clearGridSea,
  resetGridSea,
} from "./effects/gridSea.js";
import {
  spawnKeySparks, spawnChordHalo, spawnHammerRipple, spawnSpark, spawnStreak,
  spawnShock, tickImpactSparks, resetImpactSparks,
} from "./effects/impactSparks.js";
import {
  updateMelodyThread, spawnHarmonyConstellation, tickMelody, resetMelody,
} from "./effects/melody.js";
import { spawnShootingStar, tickSky, resetSky } from "./effects/sky.js";
import { spawnInfall, tickInfallSparks, resetSun } from "./effects/sun.js";
import { tickWeather, resetWeather } from "./effects/weather.js";
import { tickStorm, resetStorm } from "./storm.js";

// Late-bound rain / skyline / arcade hooks — boot registers these to avoid
// import cycles (simulation ↔ scenes, simulation ↔ arcade).
let spawnLightning = () => {};
let spawnRainSplash = () => {};
export function setRainSpawnHooks(lightning, splash) {
  spawnLightning = lightning;
  spawnRainSplash = splash;
}

let spawnSkylineWinFlock = () => {};
let spawnSkylineWinCells = () => {};
let spawnSkylineParty = () => {};
let updateSkylineWinLits = () => {};
let updateSkylineParty = () => {};
let updateSkylineEq = () => {};
export function setSkylineSimHooks(hooks) {
  spawnSkylineWinFlock = hooks.spawnSkylineWinFlock || spawnSkylineWinFlock;
  spawnSkylineWinCells = hooks.spawnSkylineWinCells || spawnSkylineWinCells;
  spawnSkylineParty = hooks.spawnSkylineParty || spawnSkylineParty;
  updateSkylineWinLits = hooks.updateSkylineWinLits || updateSkylineWinLits;
  updateSkylineParty = hooks.updateSkylineParty || updateSkylineParty;
  updateSkylineEq = hooks.updateSkylineEq || updateSkylineEq;
}

let _seedArcadeStars = () => {};
export function setWorldSeedHooks(arcadeSeed) {
  _seedArcadeStars = arcadeSeed || (() => {});
}

/** (Re)seed every effect domain's particle pools — call once at boot. */
export function resetWorld() {
  resetSky();
  resetWeather();
  resetImpactSparks();
  resetMelody();
  resetSun();
  resetGridSea();
  resetStorm();
  _seedArcadeStars();
  setArcadeFlash(0);
  setArcadeWarp(0);

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
}

function updateFx(bass, mid, air, now, peak = 0, snare = 0, hat = 0, leadPitch = 0.5) {
  // "Solo" = bright mid/air presence with enough energy to feel like a lead line
  const lead = Math.max(0, mid * 0.55 + air * 1.15 - bass * 0.25);
  const soloTarget = Math.pow(Math.min(1, lead * 1.35), 1.4);
  FX.solo = smooth(FX.solo, soloTarget, 0.12);
  // Rain Drive keeps a wetter floor so streaks never thin out between phrases
  const mistFloor = vizMode === "rainDrive" ? 0.42 + mid * 0.55 + air * 0.25 : 0.12 + mid * 0.75 + air * 0.2;
  FX.mist = smooth(FX.mist, mistFloor, vizMode === "rainDrive" ? 0.14 : 0.1);

  if (fxOn("blackHole") && fxOn("photonPulse")) {
    const hit = Math.max(0, peak * 1.15 + Math.max(0, bass - 0.12) * 0.85 - 0.05);
    FX.photon = smooth(FX.photon, hit, hit > FX.photon ? 0.32 : 0.1);
  } else {
    FX.photon = smooth(FX.photon, 0, 0.14);
  }

  const bassOnset = bass - FX.prevBass;
  const airOnset = air - FX.prevAir;
  const midOnset = mid - (FX.prevMid || 0);
  FX.prevBass = bass;
  FX.prevAir = air;
  FX.prevMid = mid;

  // Slow floors for kick/hat; snare uses a peak-hold floor so rolls keep cracking
  FX.bassSlow = smooth(FX.bassSlow, bass, 0.03);
  FX.peakSlow = smooth(FX.peakSlow, peak, 0.04);
  FX.hatSlow = smooth(FX.hatSlow, hat, 0.04);
  const bassKick = bass - FX.bassSlow;
  const peakKick = peak - FX.peakSlow;
  const hatKick = hat - FX.hatSlow;
  // Peak-hold: rides up with the crack, leaks down so machine-gun snares still onset
  const prevSnareFloor = FX.snareFloor || 0;
  FX.snareFloor =
    snare > prevSnareFloor ? snare : prevSnareFloor * 0.84 + snare * 0.16;
  const snareKick = Math.max(0, snare - prevSnareFloor * 0.62);
  const snareFlux = snare - (FX.prevSnareHot || snare);
  FX.prevSnareHot = snare;
  FX.snareSlow = FX.snareFloor; // keep old name warm for any readers

  // Drum lanes first — piano FX need the veto before they fire
  const shockHit = bassOnset > 0.035 && bass > 0.16;
  const kickFire =
    shockHit || (bassKick > 0.02 && bass > 0.14) || (peakKick > 0.05 && peak > 0.22);
  const snareHot = snare > 0.2 && snare >= bass * 0.7;
  const snareFire =
    (snareKick > 0.01 && snare > 0.07) ||
    (snareFlux > 0.016 && snare > 0.06) ||
    (midOnset > 0.025 && mid > 0.16 && mid > bass * 0.7);
  const hatFire =
    (hatKick > 0.015 && hat > 0.08) || (airOnset > 0.03 && air > 0.16 && air > bass * 0.75);
  if (kickFire || snareFire || hatFire) FX.lastDrumAt = now;
  const drumVeto =
    now - (FX.lastDrumAt || 0) < DRUM_VETO_MS ||
    (bass > 0.26 && bassKick > 0.012) ||
    (snare > 0.14 && snareKick > 0.008);

  // Keys likeness — mid-led, drums quiet, softer attacks
  const midLead = mid / Math.max(0.1, bass * 1.1 + snare * 0.9 + hat * 0.55);
  const softAttack = Math.max(0, 1 - Math.min(1, peakKick * 7 + bassKick * 9 + snareFlux * 6));
  const drumQuiet = Math.max(
    0,
    1 - Math.min(1, bass * 1.15 + snare * 1.35 + hat * 1.05 + (drumVeto ? 0.55 : 0)),
  );
  const keysRaw = Math.min(
    1,
    mid * 0.5 +
      Math.min(1, midLead / 2.4) * 0.42 +
      softAttack * 0.18 +
      drumQuiet * 0.4 +
      Math.max(0, mid - bass) * 0.25 -
      Math.max(0, snare - 0.1) * 0.85 -
      Math.max(0, bass - 0.2) * 0.7 -
      Math.max(0, hat - 0.12) * 0.45,
  );
  FX.keys = smooth(FX.keys, Math.max(0, keysRaw), keysRaw > FX.keys ? 0.14 : 0.07);
  const keysArmed = playing && FX.keys >= KEYS_ARM && !drumVeto;

  // Grid scroll hitch — kick surge + soft mid crawl so piano moves the river too
  const driveTarget =
    0.012 +
    bass * 0.085 +
    Math.max(0, bassOnset) * 0.55 +
    mid * 0.028 +
    FX.sustain * 0.018;
  FX.gridDrive = smooth(FX.gridDrive, driveTarget, 0.22);
  FX.gridScroll = (FX.gridScroll + FX.gridDrive) % 1;

  // Piano / keys path — only when keys-armed (mid-led + no recent drums)
  FX.midSlow = smooth(FX.midSlow, mid, 0.045);
  const noteKick = mid - FX.midSlow;
  const sustainTarget = Math.pow(Math.min(1, mid * 0.9 + air * 0.4), 1.08);
  FX.sustain = smooth(FX.sustain, sustainTarget, 0.07);
  const chordTarget =
    FX.sustain > 0.26 && mid > 0.12
      ? Math.min(1, FX.sustain * 0.75 + mid * 0.45 + air * 0.2 - bass * 0.12)
      : FX.sustain * 0.35;
  FX.chord = smooth(FX.chord, Math.max(0, chordTarget), 0.09);

  const noteFire =
    keysArmed &&
    ((noteKick > 0.018 && mid > 0.1) || (midOnset > 0.022 && mid > 0.12));
  if (noteFire && now - (FX.lastKeyAt || 0) > KEY_GAP_MS) {
    FX.lastKeyAt = now;
    const strength = Math.min(1, noteKick * 9 + midOnset * 7 + mid * 0.5) * FX.keys;
    spawnKeySparks(strength);
    FX.gridScroll = (FX.gridScroll + 0.006 + strength * 0.018) % 1;
    // Forte accents — quiet hammer ripples (not full kick shocks)
    if (
      strength > 0.52 &&
      (noteKick > 0.028 || peak > 0.2) &&
      now - (FX.lastHammerAt || 0) > HAMMER_GAP_MS
    ) {
      FX.lastHammerAt = now;
      spawnHammerRipple(Math.min(1, strength * 0.9 + peak * 0.25));
    }
  }

  const chordRise = FX.chord - (FX.prevChord || 0);
  FX.prevChord = FX.chord;
  const chordFire =
    keysArmed &&
    FX.chord > 0.38 &&
    FX.keys > 0.5 &&
    (chordRise > 0.04 || (FX.sustain > 0.45 && midOnset > 0.01 && mid > 0.17));
  if (chordFire && now - (FX.lastChordAt || 0) > CHORD_GAP_MS) {
    FX.lastChordAt = now;
    const chordStr = Math.min(1, (FX.chord * 0.85 + mid * 0.25) * FX.keys);
    spawnChordHalo(chordStr);
    spawnHarmonyConstellation(chordStr);
  }

  updateMelodyThread(now, leadPitch, mid, FX.solo);

  if (shockHit) {
    FX.gridScroll = (FX.gridScroll + 0.045 + bassOnset * 0.12) % 1;
    spawnShock(Math.min(1, bassOnset * 4 + bass));
    for (let i = 0; i < 4 + Math.floor(bass * 8); i++) spawnSpark("spray");
  }

  // Independent drum lanes — kick/snare/hat each keep their own clock.

  // Bass mountain — ride the same kick lane, plus soft onset / peak nudges
  let mountainBoost = 0;
  if (kickFire) {
    mountainBoost = Math.min(
      1,
      Math.max(0.5, bassOnset * 5.5 + bassKick * 5 + peakKick * 3 + bass * 0.55),
    );
  } else if (bassOnset > 0.01 && bass > 0.07) {
    mountainBoost = Math.min(0.65, bassOnset * 10 + bass * 0.3);
  } else if (peakKick > 0.025 && peak > 0.1) {
    mountainBoost = Math.min(0.45, peakKick * 6 + peak * 0.2);
  } else if (bass > 0.18) {
    // Steady low end still breathes the skyline between hits
    mountainBoost = Math.min(0.28, (bass - 0.12) * 1.4);
  }
  updateBassMountain(bass, mountainBoost, now);

  const spawnDrum = (kind, gapMs) => {
    if (!playing) return;
    const gap =
      gapMs ??
      (kind === "snare" ? DRUM_GAP_SNARE_MS : kind === "hat" ? DRUM_GAP_HAT_MS : DRUM_GAP_KICK_MS);
    const stamp =
      kind === "snare" ? "lastSnareAt" : kind === "hat" ? "lastHatAt" : "lastKickAt";
    if (now - FX[stamp] < gap) return;
    FX[stamp] = now;
    const energy = Math.max(
      gridMusicEnergy(bass, mid, air, snare),
      peak * 0.85,
      snare * 0.95,
      hat * 0.8,
      0.28,
    );
    const flockN =
      kind === "hat"
        ? Math.max(4, Math.floor(4 + energy * 6))
        : Math.max(6, Math.floor(6 + energy * 9));
    const flockOpts = {
      strength: kind === "hat" ? 0.3 + energy * 0.35 : 0.42 + energy * 0.4,
      hue:
        kind === "hat"
          ? Math.random() > 0.5
            ? "cyan"
            : "gold"
          : kind === "snare"
            ? Math.random() > 0.4
              ? "pink"
              : "cyan"
            : Math.random() > 0.4
              ? "gold"
              : Math.random() > 0.5
                ? "pink"
                : "cyan",
    };
    // Skyline: light building windows like Night Drive lights the sea grid
    if (vizMode === "skyline") {
      spawnSkylineWinCells(flockN, flockOpts);
      spawnSkylineParty(kind, flockOpts.strength);
    } else spawnGridCells(flockN, flockOpts);
  };

  if (kickFire) {
    spawnDrum("kick");
    if (
      playing &&
      fxOn("gridHeartbeat") &&
      now - (FX.lastHeartbeatAt || 0) >= DRUM_GAP_KICK_MS
    ) {
      FX.lastHeartbeatAt = now;
      spawnGridHeartbeat(Math.min(1, bassOnset * 5 + bassKick * 4 + bass * 0.55 + peakKick * 2));
    }
  }
  if (snareFire) {
    spawnDrum("snare");
    if (
      playing &&
      fxOn("horizonBloom") &&
      now - (FX.lastBloomAt || 0) >= DRUM_GAP_SNARE_MS
    ) {
      FX.lastBloomAt = now;
      spawnHorizonBloom(
        Math.min(1, snareKick * 6 + snareFlux * 5 + snare * 0.7 + midOnset * 3),
      );
    }
  } else if (snareHot) {
    // Machine-gun / roll: keep flocks dripping when onsets flatten out
    spawnDrum("snare", 55);
  }
  if (hatFire) {
    spawnDrum("hat");
    if (fxOn("infallSparks") && fxOn("blackHole")) {
      spawnInfall(0.35 + hat * 0.65);
    }
    // Hats answer flocks with meteors racing *away* from the sun down the verticals
    if (playing && fxOn("vanishingMeteors") && vizMode !== "rainDrive") {
      const burst = 1 + (hat > 0.2 ? 1 : 0) + (Math.random() > 0.55 ? 1 : 0);
      for (let i = 0; i < burst; i++) {
        const side = Math.random() > 0.5 ? 1 : -1;
        const spread = 1 + Math.floor(Math.random() * 8);
        spawnVanishingMeteor({
          col: Math.max(1, Math.min(GRID_COLS - 1, GRID_SUN_COL + side * spread)),
          hueT: (i / Math.max(1, burst - 1)) * 0.55 + Math.random() * 0.2 + now * 0.00008,
        });
      }
    }
  }

  if (vizMode === "rainDrive" && playing) {
    if (kickFire || (peakKick > 0.06 && peak > 0.2)) {
      spawnRainSplash(0.55 + bass * 0.5 + peak * 0.35);
    }
    // Lightning bolts — kicks / snares / hard peaks crack the cloudy sky
    const boltHit =
      kickFire ||
      (snareFire && snare > 0.18) ||
      (peakKick > 0.09 && peak > 0.3);
    if (boltHit && now - lastLightningAt > 90) {
      const power = Math.min(
        1,
        (kickFire ? 0.55 + bass * 0.5 : 0) +
          (snareFire ? 0.4 + snare * 0.45 : 0) +
          peak * 0.35,
      );
      spawnLightning(power, kickFire ? "kick" : snareFire ? "snare" : "peak");
      setLastLightningAt(now);
    }
  }

  // Mirror sea — after drum spawns so the drop's flocks are in the reflection
  const bigDrop =
    (shockHit && bass > 0.2 && (bassOnset > 0.045 || peakKick > 0.06)) ||
    (peakKick > 0.09 && peak > 0.32 && bass > 0.18) ||
    (bassOnset > 0.07 && bass > 0.28);
  if (
    bigDrop &&
    playing &&
    fxOn("mirrorSea") &&
    gridCells.length > 0 &&
    now - (FX.lastMirrorAt || 0) > MIRROR_GAP_MS
  ) {
    FX.lastMirrorAt = now;
    spawnMirrorSea();
  }

  // Doorway — rare: huge peak parts the center verticals onto deeper starfield
  const hugePeak =
    playing &&
    ((peak > 0.52 && peakKick > 0.11 && bass > 0.22) ||
      (bassOnset > 0.095 && bass > 0.32 && peak > 0.35) ||
      (shockHit && bassOnset > 0.08 && peak > 0.42));
  if (
    hugePeak &&
    fxOn("doorway") &&
    now - (FX.lastDoorwayAt || 0) > DOORWAY_GAP_MS
  ) {
    FX.lastDoorwayAt = now;
  }
  if (fxOn("doorway") && FX.lastDoorwayAt) {
    const age = now - FX.lastDoorwayAt;
    if (age < DOORWAY_OPEN_MS) {
      FX.doorway = age / DOORWAY_OPEN_MS;
    } else if (age < DOORWAY_OPEN_MS + DOORWAY_HOLD_MS) {
      FX.doorway = 1;
    } else if (age < DOORWAY_OPEN_MS + DOORWAY_HOLD_MS + DOORWAY_CLOSE_MS) {
      FX.doorway =
        1 -
        (age - DOORWAY_OPEN_MS - DOORWAY_HOLD_MS) / DOORWAY_CLOSE_MS;
    } else {
      FX.doorway = 0;
    }
  } else {
    FX.doorway = 0;
  }

  if (airOnset > 0.05 && air > 0.22) {
    for (let i = 0; i < 2 + Math.floor(air * 6); i++) spawnSpark("ember");
    if (airOnset > 0.07 && Math.random() < 0.55 + air * 0.35) spawnShootingStar();
    if (fxOn("infallSparks") && fxOn("blackHole")) spawnInfall(0.25 + air * 0.5);
  }

  // Launch a new slow crest every WHIP_SAMPLE_MS (they travel independently).
  const dt = FX.prevNow ? Math.min(64, Math.max(0, now - FX.prevNow)) : 16;
  if (WHIP_VERTICALS && fxOn("whipVerticals")) {
    if (now >= FX.whipNextAt) {
      FX.whipNextAt = now + WHIP_SAMPLE_MS;
      FX.whips.push({
        amp: 10 + mid * 28 + FX.solo * 18 + bass * 10,
        air,
        side: Math.random() > 0.5 ? 1 : -1,
        travel: 0,
        lastBand: -1,
      });
    }
    for (let i = FX.whips.length - 1; i >= 0; i--) {
      const w = FX.whips[i];
      w.travel += dt / WHIP_TRAVEL_MS;
      if (w.travel >= 1) FX.whips.splice(i, 1);
    }
  } else if (FX.whips.length) {
    FX.whips.length = 0;
  }

  // Spawn on kicks; then hop sunward on a steady clock. No music = no squares.
  if (!playing) {
    clearGridSea();
    if (skylineWinLits.length) skylineWinLits.length = 0;
    if (skylineParty.length) skylineParty.length = 0;
  } else {
    updateSkylineWinLits(dt);
    updateSkylineParty(dt);
    tickGridSea(dt);
  }

  FX.prevNow = now;

  // Sustained solo rain
  FX.sparkBudget += FX.solo * 2.8 + air * 0.6 + FX.sustain * 1.2;
  while (FX.sparkBudget >= 1) {
    FX.sparkBudget -= 1;
    spawnSpark(FX.solo > 0.45 ? "solo" : "ember");
    if (FX.solo > 0.55 && Math.random() < FX.solo) spawnStreak();
  }

  if (FX.solo > 0.62 && Math.random() < FX.solo * 0.08) spawnStreak();

  tickImpactSparks();
  tickInfallSparks();
  tickMelody();
  tickSky();
  tickWeather();
  tickStorm();
}

function updateMeters(bass, mid, air) {
  if (!bassDot || bassDot.closest(".together-stub") || stage.classList.contains("ui-hidden")) {
    return;
  }
  PERF.meterAcc += PERF.emaDt;
  if (PERF.meterAcc < 66) return;
  PERF.meterAcc = 0;
  const set = (el, v, colorBoost) => {
    const s = 0.85 + v * 1.4;
    el.style.opacity = String(0.25 + v * 0.75);
    el.style.transform = `scale(${s})`;
    el.style.boxShadow = `0 0 ${6 + v * 18}px ${colorBoost}`;
  };
  set(bassDot, bass, "rgba(240,197,106,0.9)");
  set(midDot, mid, "rgba(69,224,255,0.9)");
  set(airDot, air, "rgba(255,110,168,0.9)");
  if (sourceMode === "system") {
    const whisper = (el, color) => {
      el.style.boxShadow = `0 0 0 3px rgba(255,255,255,0.12), 0 0 ${10 + levels.air * 16}px ${color}`;
    };
    whisper(bassDot, "rgba(240,197,106,0.85)");
    whisper(midDot, "rgba(69,224,255,0.85)");
    whisper(airDot, "rgba(255,110,168,0.85)");
  }
}

export { updateFx, updateMeters };
