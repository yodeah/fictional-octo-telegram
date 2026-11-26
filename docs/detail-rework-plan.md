# Plan: rework the art to about 2× detail with a quality setting

Goal: rework the gladiators, armor, shields, weapons and venue backgrounds to roughly twice the current geometric detail, in many small, playable commits, with a **Quality** setting so slower devices can drop back to about today's detail.

**Why 2× and not 3×:** on the first phone test (2026-11-26) the game ran at about 24 FPS on Canvas and 22 FPS on WebGL, well below 60, so phones have no headroom for 3×. Because WebGL's much cheaper painting did not help there, polygon painting is probably not the phone's main cost (see `docs/rendering-performance.md`). Find the real cost before adding detail. Start with the prompt below; the rest of this file is the background it points to.

## Prompt for the next agent

> Rework Arena Ledger's art to about twice its current detail, with a Quality setting (Low, Medium, High) so slower phones can drop back to roughly today's detail. Cover the gladiators' bodies, all 12 armor sets and helmets, the shields, all 27 weapons, crossbow bolts, and the three venue backgrounds. Read `AGENTS.md`, `README.md`, `docs/rendering-performance.md` and `docs/detail-rework-plan.md` first. The plan file has the constraints, the order of work and the checklist for each commit.
>
> Before adding any detail, do step 0 (baseline and phone bottleneck) and step 1 (Quality setting). Work gradually. Each commit improves one part (one primitive, one body part, one armor set, one weapon family, one venue), stays playable, and is small enough to review at a glance. Never batch several parts into one commit. Keep the budget table in the plan file up to date with every commit.
>
> Keep the low-poly, flat-shaded look: more and better-shaped facets, not textures, gradients or outlines. Don't change combat: hit detection, poses used by combat, timing, damage, the simulation's random rolls, or the size and reach of anything that has a hitbox. When a step needs a decision (for example making WebGL the default renderer, what each Quality level includes, or changing a silhouette in a way that would need hitbox changes), stop and ask me.
>
> After each commit, give me the hash, `open index.html` to start the game, what to look at, and the before/after face count and draw time from the benchmark overlay for both renderers.

## Background

- **Stack**: plain HTML, CSS and JavaScript, no build step and no libraries. The game is `index.html` plus `arena.js` (simulation, models, drawing), `effects.js` (cosmetic effects), `venues.js` (backgrounds and scenery), `matchups.js`, `bench.js` (frame cap and benchmark overlay) and `gl-renderer.js` (optional WebGL painter).
- **3D pipeline**: models are procedural. Parts call `surface(points, color, light, transform)`, which projects a 3D polygon with `project()` and pushes a face to `faces`. `draw()` sorts faces by average depth (painter's algorithm, no depth buffer) and `paintFaces()` fills them. Lighting is a per-face multiplier passed by the caller, so each facet is one flat colour.
- **Building blocks** in `arena.js`: `prism` (tapered, bevelled limb or shaft with `sides` facets; skips back faces), `loft` (half-ring body shells from `[y, width, depth]` rings), `circleProfile` (cached ring angles), `forgedBlade`, `shield`, `weaponModel` and `variantWeapon` (27 weapons via `weapons` and `variants`), `armorTorso`, `armorSignature`, `armorHelmet`, `drawGladiator`, `stuckBolts`. Venue art is in `venues.js` (`forest`, `ruins`, `terrain`, `crowd`, `wildlife`, `moonlife`) and in `drawBackdrop` in `arena.js` for the Sand Pit.
- **Poses**: `fighterPose` is the combat pose. `displayPose` adds drawing-only anticipation, follow-through and hit reactions on top. Models are drawn from joint positions in the pose (`pose.joints.*`).
- **Hit detection does not use the mesh.** `bodyZones` uses capsules between joints with fixed radii, and `weaponSegments` hard-codes each weapon's striking segment along its axis (for example sword blade from 0.23 to 1.13). If a weapon's visible blade or head gets longer, shorter or wider, the **Hitboxes** view will stop matching what you see. Keep each part's overall dimensions and reach; add detail within the same silhouette.
- **Current size**: 2,347 faces for both fighters together in the benchmark matchup. README "Armor geometry" lists per-armor counts (plate torso and helmet 1,044 triangle equivalents, leather 853, robes 695).
- **Performance**: see `docs/rendering-performance.md`. At phone size on a Mac, 3× (about 7,000 faces) took 9.2 ms per frame on Canvas 2D (worst 25 ms) and 5.0 ms with WebGL (worst 9 ms). Build and sort scale with face count for both renderers. On the first phone test both renderers ran at only 22–24 FPS (see the phone section in that file).
- **Benchmark**: hidden by default; select **FPS** next to the speed control (or open `?bench`). It shows FPS, drops, draw time, per-part time (scene, fighters, effects), the renderer and the face count, plus test toggles for resolution and for skipping fighters, scenery or effects. **Polys 3×** fakes 3× detail by drawing each fighter three times. It is above the new 2× target but still a useful stress test.

## Constraints

- No changes to combat or to anything the simulation reads: `fighterPose`, `bodyZones`, `weaponSegments`, `checkContact`, `attackSegments`, `startAction`, weapon and armor stats, timing values, or the order and number of `Math.random()` calls. Model and scenery code must never call `Math.random()`; use a seeded `randomSource(seed)` for variation.
- Keep `displayPose` drawing-only, and keep the rule that both fighters are drawn exactly in their combat pose while a blow can connect.
- Keep the art style: flat-shaded facets with per-face lighting, the existing palettes, fighter team colours (`fighter.color`) and the side-view camera. No textures or images.
- Keep fighter faces in the single `faces` list painted by `paintFaces()` so both renderers and the layering keep working. Don't paint model parts directly with `ctx`.
- Keep the gear look recognisable: players pick gear by name, so each of the 27 weapons and 12 armor sets must still read as itself.
- Budget at **High**: about 4,700 faces in total for the two fighters in a typical matchup (about 2×), heaviest matchup (two plate fighters with two-handed weapons) under about 5,700. **Low** stays at about today's 2,350. If a step would overrun, stop and ask.
- Every new piece of detail must respect the Quality level: build it from primitives that take a detail level, or skip small add-ons (rivets, straps, fingers) at Low. Low must still look finished, not broken.
- Faces nobody can see still cost time. Skip back-facing facets (see `prism`) and don't model what is always hidden (inside of torsos, under plates).
- Background: the still backdrop is drawn once per resize and cached, so detail there is almost free per frame. Animated scenery (crowd, wildlife, birds, fireflies) runs every frame. Count it in draw time.

## Order of work (one commit per bullet unless it is tiny)

0. **Baseline and phone bottleneck.** On the phone, Canvas and WebGL ran at about the same low FPS, so first find what limits the frame there. The benchmark overlay already has the toggles for this (**Res 1×**, **Fighters**, **Scenery**, **Effects**) and a **Scene · Fighters · FX** timing line. If the phone results are not yet in `docs/rendering-performance.md` under "First phone test", ask the user to run the test described there and record what they report. Use the result to decide what the Quality levels change (resolution, polygon detail, scenery, effects). Then add a dev-only per-part face counter (for example `?bench` also logs faces per part per fighter, or a small console helper) without changing the picture. Record per-part counts for a plate, a leather and a robe fighter with three different weapons, plus draw time on both renderers at 1×. Fill in the budget table below.
1. **Quality setting.** Add a **Quality** control (Low, Medium, High) that changes only drawing: a global detail level read by the model code and, if step 0 showed fill rate matters, the canvas resolution. Save the choice like the benchmark settings and keep it changeable during a fight (it only changes how you watch). Default it from the measurements, and ask the user which default to use. At this point all levels look the same; later steps make them differ.
2. **Primitives.** Give `prism` and `loft` an optional detail level (more sides and more lengthwise sections, gentler bevels) and use it nowhere yet. Then switch limbs to it in a separate commit and check the joints still meet cleanly.
3. **Body.** One commit each: head and face, hands (simple fingers and thumb), feet and sandals, bare arms and legs (muscle swell via extra sections), neck and shoulders.
4. **Armor.** One commit per armor set (12): plate harnesses, then leather kits, then robes. Within the same outer silhouette add plate edges, rivets, straps, layered pauldrons, stitching folds and cloth hems as facets.
5. **Helmets.** One commit per helmet style used by the sets.
6. **Shields.** One commit per shield type: rim, boss, planks and straps.
7. **Weapons.** One commit per family: blades, greatswords, polearms, axes, impact weapons, flails, crossbow, staves. Keep blade and head lengths and widths so `weaponSegments` and the Hitboxes view still match. Then the crossbow bolt and stuck bolts.
8. **Venues.** One commit per venue for the still backdrop (Sand Pit in `drawBackdrop`, Fernwood Clearing, Moonlit Ruins), then separate commits for animated crowd and wildlife, which cost time every frame.
9. **Performance pass** if needed: reduce allocations in `surface()` and `project()`, and consider a cheaper sort (for example bucketing by depth per part). Only with measurements showing a gain, and no visible change.
10. **Review.** Update README "Armor geometry" counts, `docs/rendering-performance.md` with new measurements, and `mechanics.html` only if something it describes changed.

If the phone drops frames at High during steps 3–8, stop and ask whether to lower the High budget, change the default Quality, or make WebGL the default.

## Checklist for every commit

- Screenshots before and after at phone size (375×812) and desktop, in at least two venues, with the fighter idle, mid-swing and after a fall (ragdoll).
- Turn on **Hitboxes** during a fight and confirm the shapes still sit on the parts they belong to.
- Benchmark overlay: face count at Low and High, and average and worst draw time on Canvas and WebGL. Add a row to the budget table.
- Run a full bout to the end in both renderers and check the console for errors.
- Check the WebGL and Canvas pictures still match (edges aside) for the changed part, especially concave shapes.
- Stage only the files for that step and use a short commit message that names the part.

## Budget table

Fill in at step 0 and add a row per commit. Faces are for the benchmark matchup (Varro: sword, staff, plate, round shield; Cassian: crossbow, spear, leather, round shield) unless noted.

| Commit | Part changed | Faces (both fighters) | Canvas draw avg / worst (ms) | WebGL draw avg / worst (ms) |
| --- | --- | --- | --- | --- |
| e6f6495 | Baseline, before rework | 2,347 | 3.2 / 6.4 | 2.3 / 5.8 |
| e6f6495 | Polys 3× stand-in (above the new 2× target) | 7,041 | 9.2 / 25.2 | 5.0 / 9.3 |
