# Sunwake Mobile — Plan

Restored 2026-07-28 after the in-chat plan card was deleted. Updated 2026-08-02.

## Product shape

- **What it is:** Sunwake’s night-drive visualizer on the phone, reacting to **real audio** (mic / capture / file), with optional **Spotify** chrome.
- **What it is not:** Another MilkDrop preset browser, ad-supported equalizer, or paywalled core experience.
- **Web stays free:** `projects/sunwake` on Pages keeps working as today (local file + system-audio capture). Mobile is the Capacitor sibling.
- **Brand:** default eyebrow is **NIGHT DRIVE**. After Spotify App Remote connects, it becomes **NIGHT DRIVE · FOR SPOTIFY**. Capture already hears any playing app; Spotify is optional chrome, not the beat.
- **Web scenes (2026-08-03):** Night Drive + **Rain Drive** (storm cousin — cloudy overcast, wet asphalt, drum lightning) + **Skyline** (side-view highway/skyline strip). Skyline is **web-first** — bake into mobile only after it feels ready on Pages. Rain Drive ships with the Night Drive family (same Effects panel).

## Monetization (locked)

- **No ads.**
- **Core free forever:** sun, grid sea, lit flocks, weather, melody/harmony FX, camera sway, Spotify sync — everything needed for the Sunwake feeling.
- **Optional Supporter (one non-consumable IAP):** unlocks the **Black Hole suite** in `listen.js` — `blackHole` plus children `quasarJets`, `photonPulse`, `infallSparks`, `lensingShimmer`.
- **Optional tip ladder (consumable IAPs):** `$0.99` / `$2.99` / `$4.99` — gratitude only, does **not** gate features. **Tip jar is shown only after Supporter unlock.**
- UI framing: **Support Sunwake** / **Supporter** — never a fake wall on the main sky. Quiet Support link on the gate (before audio connect); full Support button in chrome once listening.

## Platform (default)

- **Android first** via **Capacitor** wrapping a mobile-tuned Sunwake web build.
- **iOS second** (same Capacitor shell + Spotify iOS App Remote).
- Skip PWA-as-Spotify-product (no clean App Remote). Optional later “Add to Home Screen” mirror only if useful.

## Audio architecture (salvage 2026-07-29)

**Goal:** sky reacts to **actual PCM/FFT**, not synth position and not Spotify's deprecated analysis API.

1. **Mic** — `getUserMedia` → WebAudio `AnalyserNode` (works with speakers; noisy on headphones-only). Manual escape hatch.
2. **Android AudioPlaybackCapture** — MediaProjection + `AudioRecord` band energies → feed. **Verified 2026-07-31:** Capture hears Spotify playback on device. **Stays armed through pause / pre-play silence** (no auto mic-fallback — that killed cold-connect → in-app Play). Tear down MediaProjection on app close / Recents swipe so the share indicator does not orphan.
3. **Local file** — file pick → `createMediaElementSource` → same analyser path (full-quality viz, no Spotify required).

**Spotify App Remote** stays **optional chrome** (title / art / skip) — never the beat source.

**Later (soft):** Android MediaSession chrome for non-Spotify players — Capture already universal; chrome can widen without rewriting the sky.

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
- Soft failures: Capture denied stays on gate; Connect fail still leaves the sky on Capture with **Connect Spotify** in chrome.
- Resume: after a successful Capture+Connect, next launch labels the hero CTA **Resume Spotify night drive**.
- Minimal now-playing strip: art, title, artist, play/pause/skip (App Remote chrome only — never the beat source).
- Effects panel adapted for touch (`FX_TOGGLES` / `FX_LABELS`). Mobile: portrait camera sway damped; sun scale slider **0.5–1.5**, default **0.75**.
- **Support** screen: Supporter unlock first; tips only after unlock; restore purchases.
- Supporter state persisted; Black Hole toggles locked-with-explain until unlocked.
- Quiet version stamp (Quasar chapter vibe from `version.json`).

Copy principles: never imply Spotify streams into the app or that App Remote analyses audio. MediaProjection = “share audio so the sky can hear what’s playing.” Connect = “show what’s playing · skip tracks.”

## Technical approach

**Stack (locked): vanilla web + Capacitor — no React.**

Sunwake today is `listen.js` / `listen.css` / `index.html`. Keep that. Capacitor wraps the same canvas/WebGL brain in an Android (then iOS) shell. Spotify App Remote and Play Billing arrive as native plugins / thin JS bridges — not a framework rewrite.

React is out of scope for v1 (and likely longer). A fullscreen visualizer does not need a component tree; now-playing strip, Effects panel, and Support screen stay simple DOM + CSS like the current glass FX panel.

1. Extract / share render core from `listen.js` + `listen.css` into a mobile entry with a Spotify input adapter replacing file/system-audio analysers.
2. New app shell: `projects/sunwake-mobile/` — Capacitor Android, visualizer `www/`, Spotify auth + App Remote bridge.
3. Billing: Play Billing (`@capgo/native-purchases`) — one Supporter product + tip SKUs; restore on launch. See `projects/sunwake-mobile/PLAY-CONSOLE.md`.
4. Store listing: night-drive first; Spotify as optional chrome — clear Premium/Spotify-app notes where App Remote is used.

## Phased delivery

| Phase | Ship |
|---|---|
| **0 — Spike** | Capacitor Android + Spotify App Remote connect + now-playing + cover art — **complete** (2026-07-29) in `projects/sunwake-mobile/` |
| **1 — Salvage** | Real audio inputs (Mic / Capture / File) drive FFT; App Remote optional chrome — **landed** 2026-07-29; analysis API abandoned |
| **2 — Product** | Full FX panel, Supporter IAP → Black Hole suite, tip SKUs, restore — **UI + Billing wiring landed 2026-08-01**; signed upload keystore + AAB path ready 2026-08-02. **Play Console parked** until Danny has a physical Android device (new personal accounts require device verification) + closed-test runway for production |
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

### Phase 1 status (updated 2026-08-02)

- Copied `listen.js` / `listen.css` into `projects/sunwake-mobile/src/`
- Spotify chrome overlays the fullscreen viz (Connect / now-playing / transport) — **optional**
- **Salvage:** Mic / Capture / File drive real FFT; synth-from-position and audio-analysis API abandoned
- Capture stays armed through silence; MediaProjection stopped on task remove / activity finish
- **Verified 2026-07-31 (Danny):** Capture successfully hears Spotify audio on device — primary path for Spotify + sky
- **Gate (2026-07-31):** Spotify-hero CTA runs Capture then App Remote; Mic/File secondary; Connect-later chrome if App Remote fails

### Phase 2 status (updated 2026-08-02)

- Support screen + soft-lock Black Hole suite
- Tip jar only after Supporter unlock
- Release signing + `bundleRelease` AAB path documented in `PLAY-CONSOLE.md`
- **Blocked on Play:** physical Android for Console device verification; production also needs closed test (12 opted-in testers × 14 days) for new personal accounts

## Success criteria

- Play Spotify → open Sunwake → **Start with Spotify** → share audio + chrome → night-drive feels like the web.
- Non-supporters never see ads or a broken core sky.
- Supporters get Black Hole / Quasar suite; tippers get thanks only (after unlock).
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
- Hero CTA wording vs NIGHT DRIVE brand (eyebrow already night-drive-first).
- MediaSession multi-app chrome timing.
- When to port **Skyline** from web into `sunwake-mobile` (after web polish).

## Decisions locked

- First Play Store Android release = **complete v1** (Phase 2 + Phase 3 packaging). No thin soft launch.
- Tip SKUs ship with v1; they do not gate features; UI shows tips only after Supporter.
- Core sky free forever; **Supporter ($0.99)** unlocks **Black Hole suite** only (`blackHole` + children). Soft lock: toggles visible, explain, never a mid-drive wall.
- Supporter price locked at **$0.99** (2026-08-01).
- Capture does not auto-fallback to mic on silence (2026-08-01).
