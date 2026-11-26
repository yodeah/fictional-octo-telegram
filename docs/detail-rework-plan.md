# Double the game's geometric detail

High Quality should show about twice the current geometric detail across fighters, equipment and venues. Medium should target about 1.5× and Low should retain today's geometry as a fallback. Put the new faces into visible contours and changes in surface angle, such as a helmet brow, a shield rim or a chipped stone edge. Keep the flat-shaded style, team colours, current camera and direct `index.html` entry point.

The Quality menu and geometry upgrades are now in the game. High draws 4,576 faces and 10,026 triangle equivalents in the fixed reference pose. Low is the default while physical phone performance is being evaluated. See the [measured rollout](rendering-performance.md#benchmark-overlay).

## Work already in the game

- `e6f6495` added the optional WebGL fighter painter and the FPS overlay. `5032b96` added resolution, fighter, scenery and effects probes with timings for those groups.
- `90c2309` set the 2× target after the first phone test reported about 24 FPS on Canvas and 22 FPS on WebGL. The Mac benchmark reached 60 FPS with either painter at 1× and in the synthetic 3× test. The phone bottleneck is still undiagnosed. See [rendering performance notes](rendering-performance.md).
- The animation work introduced `displayPose`, weapon trails and hit reactions. The gear and finisher work added 15 special weapons that share base meshes, activated visual states and weapon-specific finishers. Wielded and stowed equipment, frozen fighters and ragdolls all pass through the same fighter model builder. Some projectiles and finisher props are drawn later in Canvas.

## Scope and budgets

The fighter count covers the shared body, all 12 armor kits and their helmets, 3 shields, 27 base weapons and 15 special variants, including equipped and stowed gear. It also includes shield-lodged bolts. Track airborne bolts, the finishing bolt and ice shards in the effects layer. Track the Sand Pit, Fernwood Clearing and Moonlit Ruins separately, with separate counts for their animated crowd and wildlife.

Keep the fighter meshes in the shared, depth-sorted face list in `arena.js` so Canvas and WebGL keep the same layering. Start body and gear work in `drawGladiator()`, `armorTorso()`, `armorHelmet()`, `shield()` and `weaponModel()`. Special accents come from `specials.js`. The Sand Pit backdrop is in `drawBackdrop()`, and the other venues and their animated layers are in `venues.js`.

Count the **emitted faces** passed to `paintFaces()` and the **triangle equivalents** of those faces (an n-sided face contributes n − 2). Emitted faces track the build, sort and paint workload. Triangle equivalents give a consistent geometry count when primitives change between triangles, quads and larger polygons. Keep the overlay's **Polys** probe at 1× when comparing real geometry. It duplicates the existing model at 3× for stress testing.

| Quality | Reference bout emitted faces | Reference bout triangle equivalents |
| --- | ---: | ---: |
| Low | ~2,350 | ~5,140 |
| Medium | ~3,500 | ~7,700 |
| High | ~4,700 | ~10,300 |

Use about 1.8–2.2× Low's triangle count as the High target for each major asset group. Inspect recognisable features at normal game zoom before spending more faces. Use ~5,700 emitted faces as an initial review threshold for heavy matchups, then validate the practical cap on hardware. For each venue, aim for roughly twice the filled facets on its featured structures and props and time the static cache rebuild separately from the animated layer. Account for curves, particles and glow through their draw cost.

### Current geometry baseline

Measured offline against `9db4432` by calling `drawGladiator()` on fixed idle poses with both clocks at zero and counting faces before sorting and painting. The reference uses the same gear as the earlier Mac benchmark.

| Fixture | Emitted faces | Triangle equivalents |
| --- | ---: | ---: |
| Varro with Plate, sword, staff and round shield | 1,258 | 2,762 |
| Cassian with Leather, crossbow, spear and round shield | 1,089 | 2,376 |
| Reference bout total | 2,347 | 5,138 |
| Heavy sample with Blackiron harness, greatsword, war maul and tower shield | 1,395 | 3,086 |
| Special sample with Gilded parade plate, Pendulum, windlass arbalest and tower shield | 1,460 | 3,206 |
| Light sample with Robes, Sun staff, no backup weapon and a buckler | 1,110 | 2,404 |

The historical Mac browser timings at 2,347 faces were 3.2 / 6.4 ms average / worst for Canvas and 2.3 / 5.8 ms for WebGL. The 7,041-face stress test reached 9.2 / 25.2 ms for Canvas and 5.0 / 9.3 ms for WebGL. Refresh these timings on the current checkout before choosing a Quality default.

## Implementation order

1. **Make the baseline repeatable.** Use a developer-only geometry report under `?bench` to count faces and triangle equivalents for body, armor, helmet, shield, held weapon, stowed weapon and embedded bolts. Record idle, active-strike and fallen snapshots for the fixtures above. Sweep the loadouts to identify the actual heaviest combination. Record live draw averages and worst frames for both painters. Repeat the existing 20-second phone probe with resolution, fighters, scenery and effects switched individually. Collect device, browser, FPS, drops and the timing split. The inventory and desktop benchmark can proceed while the phone data is gathered.
2. **Ship Quality with one visible pilot.** Add a saved Low / Medium / High control alongside playback controls and route it through the drawing code. Start with the round shield's bevel, boss and rim for a quick comparison at game zoom. Low uses the current geometry. Keep Canvas as the initial renderer and decide the default tier from the measurements. If fill rate is the main phone bottleneck, use a lower pixel density on Low and retest. Keep the diagnostic probes independently usable.
3. **Upgrade shared primitives and body meshes.** Teach `prism()` and `loft()` to add rings and facets only for parts that opt in. Roll them out across limbs, then feet, hands, shoulders, neck and face. Match adjoining joints through poses and keep the camera-facing facets inside the existing model bounds. Retain the current culling and check useful detail at both phone and desktop scale.
4. **Update the armor, helmets and other shields.** Start with the plate family, then leather and robes. Use visible features such as bevelled plate edges, layered leather and cloth folds. Test every kit and helmet variant, including the frozen, fallen and detached-head poses. Apply the shield pilot to buckler and tower shields, testing the same grip point for drawn, stowed and bashing shields.
5. **Upgrade the armory by family.** Work through blades, polearms, axes, impact weapons, flails, crossbows and staves. Preserve each profile and its grip, tip, blade and head dimensions. Let special weapons inherit the base upgrade, then review each palette and accent with the weapon held and stowed. Check state-dependent details when the special activates. Finish the bolt variants in flight, stuck in a shield and in the pin finisher, then check the finisher shards. Preserve the existing layers and projectile paths.
6. **Upgrade the venues.** Add stepped masonry and banner folds to the Sand Pit, angular trunks and rock planes to Fernwood, and broken edges and relief to Moonlit Ruins. Keep static art in the backdrop cache. Invalidate it on resize, venue change and a Quality change that affects it. Then detail the animated crowd, boar, squirrel and birds where the measured per-frame cost allows. Keep scenery interaction targets aligned.
7. **Tune and close out.** Compare the final tier budgets and visible improvements by asset group. If performance regresses, use the timings to decide whether to reduce hidden faces, allocations or the animated detail. Refresh the performance notes and README counts using the same fixtures.

## Verification for each playable commit

- Deliver one coherent, visible change or one useful diagnostic improvement per commit. Record its scope and before/after geometry and timings with the relevant fixtures in the performance notes.
- Complete a bout in Canvas and WebGL and check the console. Check the changed model at phone and desktop sizes, with the Hitboxes overlay during contact and with the appropriate guard, swap, fall or finisher pose. Use the `?force` switches documented in the Mechanics guide for the finishers. Compare the two painters on the same pose, paying attention to overlaps and concave faces.
- Keep simulation timing, hitboxes, weapon segments, stats, and random rolls intact. Keep models anchored to the existing pose and use seeded variation for the art. Confirm tier changes mid-bout affect drawing only. When testing a rendering change that touches a shared helper, compare outcome, event order and random-call count under the same seeded, fixed simulation steps.
- Verify performance at 1× simulation speed and 1× Polys with the same fixtures. Compare draw time and drops for each painter. On the test phone, Low should match or beat its own pre-change baseline. Set the default only after checking live frame pacing, including a heavy bout and an active venue. Review the trade-off if High reaches the face target but misses the device's frame budget.
- Stage the relevant files and report the commit hash, `open index.html`, what to try and the measured change.
