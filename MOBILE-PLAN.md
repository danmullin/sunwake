# Sunwake Mobile (Spotify) — Plan

Restored 2026-07-28 after the in-chat plan card was deleted.

## Product shape

- **What it is:** Sunwake’s night-drive visualizer on the phone, reacting to **real audio** (mic / capture / file), with optional **Spotify** chrome.
- **What it is not:** Another MilkDrop preset browser, ad-supported equalizer, or paywalled core experience.
- **Web stays free:** `projects/sunwake` on Pages keeps working as today (local file + system-audio capture). Mobile is the Spotify-native sibling.

## Monetization (locked)

- **No ads.**
- **Core free forever:** sun, grid sea, lit flocks, weather, melody/harmony FX, camera sway, Spotify sync — everything needed for the Sunwake feeling.
- **Optional Supporter (one non-consumable IAP):** unlocks the **Black Hole suite** in `listen.js` — `blackHole` plus children `quasarJets`, `photonPulse`, `infallSparks`, `lensingShimmer`.
- **Optional tip ladder (consumable IAPs):** `$0.99` / `$2.99` / `$4.99` — gratitude only, does **not** gate features.
- UI framing: **Support Sunwake** / **Supporter** — never a fake wall on the main sky.

## Platform (default)

- **Android first** via **Capacitor** wrapping a mobile-tuned Sunwake web build.
- **iOS second** (same Capacitor shell + Spotify iOS App Remote).
- Skip PWA-as-Spotify-product (no clean App Remote). Optional later “Add to Home Screen” mirror only if useful.

## Audio architecture (salvage 2026-07-29)

**Goal:** sky reacts to **actual PCM/FFT**, not synth position and not Spotify's deprecated analysis API.

1. **Mic** — `getUserMedia` → WebAudio `AnalyserNode` (works with speakers; noisy on headphones-only).
2. **Android AudioPlaybackCapture** — MediaProjection + `AudioRecord` band energies → feed. **Verified 2026-07-31:** Capture hears Spotify playback on device. Keep **silence ~2s → auto mic fallback** for apps that opt out or when nothing is playing.
3. **Local file** — file pick → `createMediaElementSource` → same analyser path (full-quality viz, no Spotify required).

**Spotify App Remote** stays **optional chrome** (title / art / skip) — never the beat source.

**Dead for new apps:** Web API `/v1/audio-analysis` (403). Do not plan product on it.
**Out of scope:** Web Playback SDK (no PCM to AnalyserNode).

```text
Mic / Capture / File --> PCM --> AnalyserNode (or native bands)
                              \--> Sunwake night-drive frame loop
Spotify App Remote -.optional.-> now-playing chrome only
```

## App UX (v1)

- Fullscreen Sunwake scene (tap / hide-chrome).
- **Spotify-hero gate** (2026-07-31): primary **Start with Spotify** → share audio (Capture / MediaProjection) → App Remote connect. Mic · File are secondary escapes. Capture is not a free-standing first-run button (lives in the Spotify path + dock).
- Soft failures: Capture denied stays on gate; Connect fail still leaves the sky on Capture with **Connect Spotify** in chrome; silence ~2s → mic fallback.
- Resume: after a successful Capture+Connect, next launch labels the hero CTA **Resume Spotify night drive**.
- Minimal now-playing strip: art, title, artist, play/pause/skip (App Remote chrome only — never the beat source).
- Effects panel adapted for touch (`FX_TOGGLES` / `FX_LABELS`).
- **Support** screen: Supporter unlock + tip amounts + restore purchases.
- Supporter state persisted; Black Hole toggles locked-with-explain until unlocked.
- Quiet version stamp (Quasar chapter vibe from `version.json`).

Copy principles: never imply Spotify streams into the app or that App Remote analyses audio. MediaProjection = “share audio so the sky can hear what’s playing.” Connect = “show what’s playing · skip tracks.”

## Technical approach

**Stack (locked): vanilla web + Capacitor — no React.**

Sunwake today is `listen.js` / `listen.css` / `index.html`. Keep that. Capacitor wraps the same canvas/WebGL brain in an Android (then iOS) shell. Spotify App Remote and Play Billing arrive as native plugins / thin JS bridges — not a framework rewrite.

React is out of scope for v1 (and likely longer). A fullscreen visualizer does not need a component tree; now-playing strip, Effects panel, and Support screen stay simple DOM + CSS like the current glass FX panel.

1. Extract / share render core from `listen.js` + `listen.css` into a mobile entry with a Spotify input adapter replacing file/system-audio analysers.
2. New app shell: `projects/sunwake-mobile/` — Capacitor Android, visualizer `www/`, Spotify auth + App Remote bridge.
3. Billing: Play Billing (Capacitor purchases plugin) — one Supporter product + tip SKUs; restore on launch.
4. Store listing: “Sunwake — Synthwave visualizer for Spotify”; clear Premium/Spotify-app requirements.

## Phased delivery

| Phase | Ship |
|---|---|
| **0 — Spike** | Capacitor Android + Spotify App Remote connect + now-playing + cover art — **complete** (2026-07-29) in `projects/sunwake-mobile/` |
| **1 — Salvage** | Real audio inputs (Mic / Capture / File) drive FFT; App Remote optional chrome — **landed** 2026-07-29; analysis API abandoned |
| **2 — Product** | Full FX panel, Supporter IAP → Black Hole suite, tip SKUs, restore — **required before Play** · **UI + Billing wiring landed 2026-08-01** (needs Play Console SKUs + release track to purchase for real) |
| **3 — Polish** | Battery/thermal, background reconnect, store listing — **required before Play**; iOS after Android store comfort |

**Play Store policy (locked 2026-07-31):** First public Android release is the **complete** v1 — Phase 2 + Phase 3 store packaging. No free-core soft launch without Support / Supporter / tips.

### Phase 1 salvage — real audio (2026-07-29)

Honest reset: we mis-steered toward Spotify-native analysis / synth-from-position. Salvage = **direct analysis paths**.

- Source strip: **Mic | Capture | File** (one live at a time)
- `SunwakeMobile.startAnalyserFromStream` / `FromElement` / `stopAnalyser`
- Synth `__SUNWAKE_FEED__` only for native capture bands (or idle off) — not primary driver
- `RECORD_AUDIO` + MediaProjection foreground service for Capture
- Docs: analysis API marked dead for new apps

### Phase 0 — complete (2026-07-29)

Proven on emulator (`Medium_Phone_API_36.1`):

- App id: `in.danmull.sunwake`
- Stack: vanilla + Capacitor 7 (no React)
- Connect via App Remote (Dashboard: package + redirect + debug SHA1)
- Now-playing: title / artist / play-pause / skip
- Album art via ImagesApi → data URL (MEDIUM), shimmer on track change
- Web mock still available via `npm start`

### Phase 1 status (2026-07-29)

- Copied `listen.js` / `listen.css` into `projects/sunwake-mobile/src/`
- Spotify chrome overlays the fullscreen viz (Connect / now-playing / transport) — **optional**
- **Salvage:** Mic / Capture / File drive real FFT; synth-from-position and audio-analysis API abandoned
- Capture silence (~2s near-zero RMS) auto-falls back to mic with status toast
- **Verified 2026-07-31 (Danny):** Capture successfully hears Spotify audio on device — primary path for Spotify + sky, not “expect silence”
- **Gate (2026-07-31):** Spotify-hero CTA runs Capture then App Remote; Mic/File secondary; Connect-later chrome if App Remote fails

## Success criteria

- Play Spotify → open Sunwake → **Start with Spotify** → share audio + chrome → night-drive feels like the web.
- Non-supporters never see ads or a broken core sky.
- Supporters get Black Hole / Quasar suite; tippers get thanks only.
- Web Sunwake unchanged and free.

## Out of scope (v1)

- React (or other SPA frameworks) — vanilla + Capacitor only.
- Recording/export VJ tools.
- Hundreds of MilkDrop-style presets.
- iOS simultaneous launch.
- In-app Spotify streaming via Web Playback SDK (deferred).

## Decisions still soft (change anytime)

- Exact tip amounts (suggested $0.99 / $2.99 / $4.99) — tips **do** ship in complete v1 (gratitude only).
- When to start iOS relative to Android store comfort (after complete Android Play ship).

## Decisions locked

- First Play Store Android release = **complete v1** (Phase 2 + Phase 3 packaging). No thin soft launch.
- Tip SKUs ship with v1; they do not gate features.
- Core sky free forever; **Supporter ($0.99)** unlocks **Black Hole suite** only (`blackHole` + children). Soft lock: toggles visible, explain, never a mid-drive wall.
- Supporter price locked at **$0.99** (2026-08-01).
