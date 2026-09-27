# Integrated Windward Demo

The accepted painted sailing renderer is connected to the existing 0.1.10 game.
This is a separate build, not a replacement of the stable entry point or a new
art pass. The build targets `/windward/demo/` when deployed with Pages.

## Run

From the repository root:

```powershell
node experiments/harbor-lab/demo-server.cjs
```

Open http://127.0.0.1:4180/demo/. This address is local to this computer.
The server packages once at startup. After source edits, run
`node experiments/harbor-lab/package-demo.cjs` and refresh. Generated files live
under ignored `_site/demo/`; do not edit them directly.

## Connected Systems

- The original app and engine own all state, movement, acceleration/braking,
  collision, wind, spending, trading, contracts, exploration and progression.
  The renderer never advances a separate simulation.
- Port services, chart controls, automatic sailing, temporary chart peek,
  manual steering, lookout/surveys, rumors and market events reuse the existing UI.
- Arrival requires explicit port entry, preserving undiscovered names until then.
  Port/sea transitions stay in one document and reuse the gesture-unlocked audio
  context, including the existing recorded effects and fixed volume mix.
- Reload stops movement and restores location and progress using the original
  migration/session logic. The multi-tab ownership lock is preserved.

## Storage And Compatibility

The demo starts a separate voyage using `windward-demo-v1` (or its `-test` variant).
It never imports or overwrites `windward-v1`. Reset affects only the demo.
Sound and camera preferences are also namespaced, including the 2D fallback.
There is no account or cloud save; browser/device records remain independent.

`package-demo.cjs` copies an explicit browser-asset allowlist. It generates the
entry HTML and changes the namespace literals in the copied audio/fallback
files. The copied app also memoizes the visible stats signature to avoid replacing
unchanged counters and hidden objective markup on every animation frame. The
engine, chart, discovery and session scripts are copied unchanged; navigation and
simulation cadence remain identical. No production source file is edited.

WebGL or painted-asset initialization failure falls back to the existing 2D
sailing renderer. Graphics context loss during play pauses the ship and leaves
the chart accessible; refresh restores the demo record.

## Rendering Limits

Four scene units per chart unit preserve the coastal study's proportions. Travel
uses the normal game engine speed, not the study's 15% time scale or Lisbon radius.
Terrain streams across the real map, retaining at most three regions and disposing
evicted GPU assets. Towns reuse generic decorative models, not unique historical
city reconstructions. All seven ship tiers use the same hull with small scale and
sail-color variations; performance/cargo capacity follow the original engine.

Default rendering caps at 30 FPS, DPR 1 and 700,000 framebuffer pixels without
shadows. The optional quality button is inside the existing sailing-help panel.
Hidden screens/dialogs do not draw. Reduced-motion avoids idle redraws and retains
finite wake fade. Discovery dialogs still allow sailing, as the original game
explicitly describes. Desktop Edge tests do not establish real phone performance.

## Mobile Follow-Up

Mobile uses a taller sea stage, closer portrait framing, a smaller compass and a
single chart button instead of a large overlaid minimap. Coordinates and duplicate
status decoration are hidden; camera settings remain in the existing help panel.
The ship model, real coastline, collision and shore-wave texture retain their detail.
Only inland relief and decorative trees/rocks use a lower geometry budget.

Depth and relief calculations run in a module Web Worker. The main thread keeps
the previous region visible while preparing its replacement; a deep-water layer
covers the remaining area. If workers are unavailable, the same deterministic
calculations run in small asynchronous slices. At most one region is prepared at
a time and the existing three-region cache remains bounded. DOM site markers are
reused and the hidden mobile minimap does not redraw.

`node experiments/harbor-lab/mobile.bench.cjs` compares a real Lisbon-to-Cadiz trip
with desktop Edge's CPU throttled 4x at 390x844. One before/after run recorded
six long tasks of 837-1326 ms before, and four of 86-105 ms after. Visible triangles
at the destination decreased from 80,408 to 39,584. These are laboratory long-task
measurements, not actual-phone FPS or a guarantee of stutter-free play.
An additional installed Chrome run at 1280x900 without CPU throttling recorded
no tasks over 50 ms during the same voyage (initial loading excluded). The
benchmark accepts `BROWSER_CHANNEL`, `WIDTH`, `HEIGHT` and `CPU_RATE` overrides.
Build-specific URL hashes cover the entry scripts, CSS, nested modules and worker
imports so a new public release cannot silently reuse the previous demo code.

## Checks

```powershell
node --test experiments/harbor-lab/demo-package.test.cjs experiments/harbor-lab/wake.test.cjs
node experiments/harbor-lab/demo.browser.test.cjs
node experiments/harbor-lab/mobile.browser.test.cjs
```

Browser checks require Playwright and Edge, with the demo server running.
`DEMO_URL` overrides the local address. They cover four viewport sizes, trading,
exploration, contracts/delivery, all ship tiers/port regions, sea surveys, actual
cross-region travel, braking, chart/port transitions, audio context reuse and bell
playback, reload/reset isolation, tab ownership and graphics fallback/recovery.
Read-only `window.windwardDemo.snapshot()` diagnostics do not provide a game-state
setter. Existing game and isolated-lab tests should also be run before release.
