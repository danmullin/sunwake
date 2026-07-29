# Sunwake Mobile (Spotify) — Plan

Restored 2026-07-28 after the in-chat plan card was deleted.

## Product shape

- **What it is:** Sunwake’s night-drive visualizer on the phone, listening to / controlling **Spotify**.
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

## Spotify architecture

Mobile cannot tap Spotify PCM the way desktop Chrome system-audio does.

1. **App Remote** — connect to installed Spotify app; play/pause/skip; now-playing metadata + playback position.
2. **Web API audio-analysis** — beats/sections/segments for the current track; interpolate against App Remote position.
3. **Fallback (phase 2):** mic / Android audio capture if analysis sync feels thin — not required for v1.

Expect: Spotify app installed; Premium likely required for reliable remote playback control.

```text
Spotify app --> App Remote (state/position/track)
Audio Analysis API --> beats/sections/segments
         \--> Sunwake renderer (FX + sun)
```

## App UX (v1)

- Fullscreen Sunwake scene (tap / hide-chrome).
- Minimal now-playing strip: art, title, artist, play/pause/skip.
- Effects panel adapted for touch (`FX_TOGGLES` / `FX_LABELS`).
- **Support** screen: Supporter unlock + tip amounts + restore purchases.
- Supporter state persisted; Black Hole toggles locked-with-explain until unlocked.
- Quiet version stamp (Quasar chapter vibe from `version.json`).

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
| **1 — Visual** | Port Sunwake renderer; drive FX from analysis beats; touch UI — **started** (renderer + synth energy feed on device; Web API audio-analysis next) |
| **2 — Product** | Full FX panel, Supporter IAP → Black Hole suite, tip SKUs, restore |
| **3 — Polish** | Battery/thermal, background reconnect, store listing, then iOS |

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
- Spotify chrome overlays the fullscreen viz (Connect / now-playing / transport)
- Energy via `window.__SUNWAKE_FEED__` — position-synced synthetic kicks/snares/hats per track (no PCM)
- Next: Spotify Web API audio-analysis (PKCE) replacing the synth feed

## Success criteria

- Play Spotify → open Sunwake → night-drive feels like the web within one connect tap.
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

- Exact Supporter price (suggested ~$2.99–$4.99).
- Whether tip SKUs ship in v1 or only Supporter.
- When to start iOS relative to Android store comfort.
