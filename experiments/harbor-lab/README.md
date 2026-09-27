# Lisbon Coastal Study 01

Isolated, playable rendering prototype. The public Windward game remains **0.1.10**.
The experiment is not referenced by the production entry point. The Pages workflow publishes an explicit browser-asset allowlist separately under `/windward/lab/`, without changing the root game or reading its saves. This preview is public, not password protected; `noindex` is only a request to search engines, not access control.

Public preview: https://osanidiot.github.io/windward/lab/

## Run

From the Windward directory:

```powershell
node experiments/harbor-lab/server.cjs
```

Open http://127.0.0.1:4179. This URL works on this computer only. The server binds to localhost by default; `HOST` and `PORT` can be explicitly changed for a later LAN device test. It serves an allowlist of prototype files and the three existing geography/navigation/engine scripts only.

## What Is Implemented

- A real WebGL 2 scene, not a flattened concept image. The new 2.5D art pass uses painted surface detail on lightweight, independently rotating geometry, not camera-facing picture cards. Orthographic camera, independent hull/sails, land, buildings, plants, sea shader and wake.
- Existing Lisbon coast geometry and navigation/land checks; local rendering scale is four scene units per chart unit.
- Mouse/touch sea destinations, keyboard direction steering, natural acceleration/braking through the existing engine, and heading-up/north-up camera modes.
- A circular 52-chart-unit test region. No open-world travel or port entry.
- Map dialog, wider lookout view, two quality settings, reset and diagnostic HUD in the help dialog.
- Paused simulation and rendering while a dialog is open or the document is hidden. Reduced-motion freezes decorative water, sail and bird animation and avoids drawing while idle.
- Bounded instanced scenery, wake history and pixel resolution. No dynamic asset downloads or paid APIs during play.
- Recoverable messages for missing modules, unavailable WebGL 2 and graphics context loss.

## Intentional Limits

This validates rendering/navigation and the first painted art pass, **not final art quality**. The ship now has a rounded hull, three animated sail panels, an upper sail, stitched linen, planked decks, stern windows, railings and rope ladders. The town distinguishes warehouses, awnings, houses, stone lanes and a watchtower. These remain reusable procedural models, not the concept's finished dense city or a historical reconstruction of Belem.

The original coarse shoreline is retained rather than replacing real geography with the imaginary coast from the concept. Fine cliffs, detailed terrain textures and a full set of harbor models remain art-production work.

No production save is read or written. State is in memory and resets on reload. Trading, contracts, real port entry and audio are deliberately absent. The demo advances the existing simulation at **15% of normal game time** to keep the small coastal study navigable. The public game's speed is unchanged. Displayed funds belong only to this in-memory session.

The current tests use desktop Edge with mobile-sized viewports. They **do not establish real phone FPS, battery consumption or thermal behavior**. Test those before deciding to replace the production renderer.

## Checks

```powershell
node --test experiments/harbor-lab/model.test.cjs
node --test experiments/harbor-lab/painted.test.cjs
node --test experiments/harbor-lab/wake.test.cjs
node experiments/harbor-lab/browser.test.cjs
```

Browser tests require Playwright and Edge. `BASE_URL` can override the local preview address.
`node package.cjs` (from this directory) packages only browser files to `_site/lab/`. The preview includes local copies of the three shared engine/geography scripts and uses relative asset URLs, so GitHub Pages project subpaths work. Screenshots, test tools, the development server and documentation are not copied to Pages. Source code and Three.js's MIT notice are intentionally public; no external API keys are required.
They check 390x844, 320x568, 844x390 and 1280x900, steering, camera projection, clipping/controls, braking, chart pause, resets, save isolation and graphics failure messages. Unit tests cover initial state, coordinate conversion, coast/region rejection and engine reuse.

## Rendering Budget

- Lightweight (default): at most 30 draws/second, DPR at most 1, at most 700,000 framebuffer pixels, no shadow rendering or full-screen shadow overlay.
- Sharp: at most 60 draws/second, DPR at most 1.5, at most 1,400,000 framebuffer pixels, shadow map refresh at most once/second during normal animation (also refreshed after resizing/settings changes).
- Both use a deterministic, tileable 128x128 water texture with baked slopes and mipmaps. The water fragment shader takes four texture samples instead of repeatedly generating multi-octave noise for every pixel. Shore foam, water motion, highlights and the bow wave remain.
- MSAA is disabled. There is a deliberate edge-sharpness/detail tradeoff, particularly on large/high-DPI displays; HTML text and controls remain at native resolution.
- Navigation is integrated at 60 fixed steps/second, independently of drawing cadence. Long stalls are capped at 100 ms rather than attempting a large catch-up jump. The 15% demo time scale is unchanged.
- The diagnostic FPS counts actual scene draws, not animation callbacks. Hidden tabs and open dialogs do not draw. Reduced-motion idle scenes redraw only after changes.

`node experiments/harbor-lab/render.bench.cjs` is an **intrusive diagnostic**: it waits for GPU completion after each drawn frame and reports 45 samples after 20 warm-up frames. It does not measure ordinary gameplay FPS. One before/after run on desktop Edge / ANGLE D3D11 / RTX 2060 SUPER, at 1280x900 with device scale 2, gave:

| Default mode | Before | After |
| --- | ---: | ---: |
| Framebuffer pixels | 1,399,712 | 698,897 |
| Median callback + GPU wait | 1.6 ms | 1.4 ms |
| P95 callback + GPU wait | 5.1 ms | 2.5 ms |

These short hardware-accelerated Edge runs did not reproduce the user's severe in-app stutter. They demonstrate reduced work, not proof that the in-app browser issue is resolved. Embedded-browser GPU availability, thermal behavior, and real device frame pacing still require testing there. No production files or saves were changed.

## Assets And License

### Ship-Water Interaction Follow-Up

The later wake pass changes only ship-induced foam, not the underlying sea texture, lighting or shoreline waves. Bow foam follows two curved arms from the scaled prow (7.95 scene units forward), rather than a circle inside the hull. Stern history is sampled at most ten times per second and stays in world space during turns. Both width and true alpha vary with age: foam spreads and smoothly reaches zero at 14 seconds, instead of darkening at constant opacity then disappearing abruptly. Stopping emission does not clear existing foam. Reset/teleport clears it deliberately. Dialogs freeze its clock with the simulation; reduced-motion still allows the finite trail to fade after stopping, then returns to idle rendering. The wake reuses the sea's texture and one fixed-size draw buffer, with no added image assets.

Scene meshes, facade decoration and terrain/water textures are generated by local source code. `painted-materials.webp` is a new AI-generated, four-quadrant material atlas (plaster, terracotta tiles, ship timber and linen), created for this experiment with the built-in image-generation tool. No external game art is used. The concept image remains a reference outside the runtime.

Atlas provenance: generated 2026-09-27, source `exec-5590907b-67e1-4abe-a558-28b45ae4d335.png`, converted without cropping to a 1254x1254 WebP (461,764 bytes). Prompt requested flat orthographic material swatches, a muted hand-painted historical maritime style, and no text/logos/watermarks. Runtime canvas extracts each quadrant to 512x512 and adds facade features. The generated swatches are not guaranteed perfectly seamless; they are clamped, not tiled across buildings.

The original models in `world.js` remain as the non-painted code path for comparison; the preview selects `painted.js`. Static details are merged by material. At the initial 1280x900 view the painted pass uses about 32 draw calls versus 76 previously, with about 68,000 triangles (under the existing 80,000 budget). This is not a claim of real-device FPS. Water shader, coastline/collision, 1.5 ship scale, demo speed and public files were not changed. The camera is slightly lower so sails and building facades are more readable.

Three.js is vendored at **0.180.0 / r180**, MIT licensed; see `vendor/LICENSE-three.txt`. It is served locally and not loaded from a CDN at runtime. Sources:

- https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.min.js
- https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.core.min.js
- https://raw.githubusercontent.com/mrdoob/three.js/r180/LICENSE

SHA-256 of the downloaded files:

```text
three.module.min.js e2b5ee6bccd38fd6d8a2428546b83c5f2426d84b152ef82be8055556e3b40eb6
three.core.min.js   61ba0df005b05991361d040d8ff670e1aadfd0ce7aeebd1fdb0725957a8957de
LICENSE-three.txt  bfe119ea4fd413f5f7ca3fcd63adb0c4a073ed39daa2fe7d3e6b769e21272601
```

## Next Decision

Review the prototype before integrating anything into the game. If the camera and rendering direction are accepted, produce one coherent set of higher-quality buildings, coastal stone/vegetation textures and ship geometry, then validate the same area on actual phones. Do not treat the generated concept as proof of achievable real-time quality.
