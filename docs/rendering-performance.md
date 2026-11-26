# Rendering performance notes

Measured 2026-11-26 on a Mac in the Claude desktop app's built-in browser (Chromium) at a phone-size viewport (375×812 CSS px, device pixel ratio 2, arena canvas 706×620 px) on a 60 Hz screen. Same matchup for every run: Varro Lv 54 (sword, staff, plate, round shield) vs Cassian Lv 57 (crossbow, spear, leather, round shield). **Nothing here was measured on a real phone.**

## How a frame is drawn

`frame()` in `arena.js` steps the simulation, then calls `draw()`:

1. **Backdrop**: the static venue art is drawn once per resize into an offscreen canvas (`resize()` → `scenery.backdrop` → `drawBackdrop`) and copied in with one `drawImage`. Only the crowd and wildlife (`scenery.draw`) are redrawn each frame, so adding detail to the still background costs almost nothing per frame. Animated scenery is paid every frame.
2. **Ground layer**: blood stains and the fighters' shadow ellipses, on Canvas 2D.
3. **Build**: `drawGladiator` projects every part of both fighters through `surface()` into the shared `faces` list (screen points, depth, `rgb`). Nothing is painted yet.
4. **Sort**: `faces.sort` by average depth (painter's algorithm, no depth buffer).
5. **Paint**: `paintFaces()` fills the faces in order, either with Canvas 2D (one path fill per face) or with WebGL (`gl-renderer.js`).
6. **Effects**: dust, trails, hitboxes, magic, bolts, particles, blood, sparks and damage labels, on Canvas 2D on top.

## Where the time goes (main thread, idle-to-fighting poses)

Normal detail, 2,347 faces (about 94% are quads):

| Step | Canvas 2D | WebGL |
| --- | --- | --- |
| Build polygons | 0.8 ms | 0.8 ms |
| Sort | 0.4 ms | 0.4 ms |
| Paint | 1.8 ms | 0.4 ms |
| Whole `draw()` | 3.2 ms | 2.3 ms |

Three times the polygons (**Polys 3×**, 7,041 faces):

| Step | Canvas 2D | WebGL |
| --- | --- | --- |
| Build polygons | 2.3 ms | 2.0 ms |
| Sort | 1.8 ms | 1.6 ms |
| Paint | 5.0 ms | 1.4 ms |
| Whole `draw()`, average | 9.2 ms | 5.0 ms |
| Whole `draw()`, worst | 25.2 ms | 9.3 ms |

All four setups held 60.0 FPS average, 60 minimum and zero drops on this machine, so the 60 Hz limit hid the difference in FPS. The draw-time columns are where the renderers differ. Times cover main-thread work only; the graphics chip's work for either renderer is not included, so on a phone the FPS and drop counts are the real test.

With the browser pane hidden (background-throttled) the same build took about 3.7 ms. Hidden-tab numbers are not comparable.

## What this means for adding detail

- Painting scales worst on Canvas 2D: about 0.75 µs per face, and its worst frames spike (25 ms at 3×). WebGL paints at about 0.2 µs per face with far smaller spikes.
- Building and sorting scale roughly linearly with face count and are the same for both renderers. At 3× they become the larger share under WebGL (about 3.5 of 5 ms). If detail goes beyond 3×, optimise `surface()` (it allocates arrays per face) and the sort before anything else.
- Faces hidden behind others still cost build, sort and paint. Back-facing ring segments are already skipped in `prism()`; do the same for new geometry.
- The still backdrop is cached, so background detail is cheap unless it animates.
- A 3× detail budget is about 7,000 faces for the two fighters together. Measured here it fits inside a 60 Hz frame with WebGL; on Canvas 2D it uses most of a 120 Hz frame on a fast Mac and likely more on phones.

## Renderer details worth knowing

- WebGL paints the same sorted faces, in order, into an offscreen canvas, then `drawImage`s it into the arena canvas at the point where Canvas 2D would fill them. That keeps layering with backdrop and effects without splitting the effect code. The extra full-canvas copy was cheap here; it is unmeasured on mobile Safari.
- Canvas 2D fills with the nonzero winding rule. Faces whose fan triangles from the first vertex all turn the same way are drawn as plain triangles in one batch. Concave or self-crossing faces (about 10–45 per frame at normal detail) use a stencil winding pass and a cover quad, so they fill exactly like Canvas 2D.
- Output matches Canvas 2D except on anti-aliased edges: 0.7% of pixels differed by more than 8/255, and 2 pixels by more than 60/255.
- Colours: `surface()` stores `rgb` numbers. The Canvas painter builds the CSS string when it paints, and WebGL uses the numbers directly.
- If WebGL is unavailable or the context is lost, painting falls back to Canvas 2D and the overlay says so.

## Benchmark overlay

See the README section "Renderers and benchmark". To measure: open `?bench`, pick a renderer and polygon multiplier, tap **Reset**, and let a fight run 15–20 seconds. Use Rematch or Auto-rematch (not Generate matchup) to keep the same fighters. To reproduce the tables above from the console, wrap `drawGladiator`, `faces.sort` and `paintFaces` with timers and read `ArenaBench.snapshot()`.

The 120 FPS cap was checked with simulated timestamps: 60, 90 and 120 Hz screens draw every frame, and 144, 165 and 240 Hz screens average 120 FPS with no false drops.
