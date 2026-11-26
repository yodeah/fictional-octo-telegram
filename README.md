# Salt & Sand

A gory gladiator autobattler with permanent death, for phone and laptop. Static files only: no backend, no build step.

**Play:** open `index.html`. You wash ashore, owe the lanista, and must kill four champions. The old sparring page is `sandbox.html`.

- Dice-rolled stats and a race (human, elf or demon, each with a drawback).
- Each day: fight, train, rest or work. The debt falls due every fifth day.
- Sparring is safe from death; blood bouts and champions are not, apart from one mercy per champion.
- Champions give a trophy weapon and a spell page. Mana appears with your first spell.
- The game saves itself. A saved fight replays identically after a reload. A save code backs it up.
- A new gladiator may start at the furthest champion reached (a Legacy).

What comes next is in [docs/implementation-plan.md](docs/implementation-plan.md).

## Tests

```bash
node --test tests/*.test.mjs
```

About 90 seconds. They check the rules, that a seed repeats a fight, weapon balance, and that a sensible bot can finish while a random one cannot. `node tests/report.mjs` and `node tests/weapons.mjs` print the numbers.

## Combat engine

The sections below describe the combat engine and the sparring sandbox. The fighters use low-poly 3D geometry rendered on Canvas 2D with a perspective camera.

## Design decision: fights are fully idle

**Decided 2026-11-26.** Once a fight starts, the player cannot interact with it. All choices happen between fights, and the fighters decide everything until one falls.

- **Locked during a fight, including while paused:** gear and spellbook pickers, Reset, Generate matchup, the venue selector and the scene markers.
- **Still available, because they only change how you watch:** Pause/Resume, playback speed, Quality, Hitboxes and Auto-rematch.
- **For future features:** do not add in-fight commands, abilities, cheers or other inputs. Put player choices in preparation and progression between fights.

This replaces the earlier idea of a "corner coach" with timed calls.

## Run locally

Open `index.html` (the game) or `sandbox.html` (sparring) in a browser, or run `python3 -m http.server 8000` from this directory and visit `http://localhost:8000`. There are no dependencies or build steps.

Each fighter has a main weapon, optional backup weapon, shield, armor, and spellbook. These pickers, the fighter stats and the spell list are hidden so the fight stays in view; select **Show gear, stats & spells** under the fighters to open them, at any time. Pin any selection for future bouts or leave the slot on **Auto** to keep what the last matchup chose. Fighters keep their levels, stats, and gear until you select **Generate matchup**. Hover over a selector or focus it with the keyboard to read details. Gear is locked while a bout is in progress.

Armor has separate attack and defense bonuses for stab, slash, crush, magic, and ranged. The greatsword and war maul trade slower, more expensive swings for higher accuracy and damage. They use both hands, so the shield moves to the back and stops providing defense or blocks until a one-handed weapon is drawn.

The armory contains 27 weapons across blades, polearms, axes, impact weapons, flails, ranged weapons, and staves. Twelve armor sets include four plate harnesses, four leather kits, and four robes. Weapons have different silhouettes, attack profiles, and resource costs. Armor sets trade protection, movement speed, and bonuses to their combat style.

Fighters automatically switch between their two weapons based on distance, skills, energy, mana, and the opponent’s armor. Unused weapons stay visible on the back or hip. Crossbows fire ranged bolts. Staves increase spell power by 30%. The combat triangle gives melee an advantage against leather, ranged an advantage against robes, and magic an advantage against plate. Armor also gives a small boost to its own combat style. [Old School RuneScape combat triangle](https://oldschool.runescape.wiki/w/Combat_triangle)

Melee fighters press crossbow users at close range. A crowded shot loses damage and accuracy, so the shooter favors a melee backup or retreats while casting when a spell is available.

In the sandbox, both fighters start with 60 mana and 100 energy. They recover 3.6 mana and 5 energy per simulated second. Physical attacks, blocks, and dodges use energy. Swapping weapons costs 7 energy. Carrying a spare reduces movement speed by 4% and energy recovery by 0.35 per simulated second. Low energy reduces attack speed and damage. Heavier shields cover more area while slowing movement.

| Spellbook | Role | Spells |
| --- | --- | --- |
| General | Balanced damage and protection | Ember Bolt, Iron Ward, Second Wind |
| Vampiric | Damage that heals and trades health for mana | Crimson Drain, Scarlet Surge, Blood Pact |
| Glacial | Fight at range with slows, a freeze, and shielding | Frost Lance, Winter Barrage, Glacial Shell |
| Storm | Burst damage and energy control | Arc Flash, Thunderclap, Tailwind |

Equip a staff and select **None** for the backup to run a dedicated mage. Staff Spark gives that build a weak free spell when mana runs out. A staff and another weapon form a hybrid. A melee weapon, crossbow, and spellbook let the fighter use all three styles in one bout. The Vampiric and Glacial books draw inspiration from the healing and freezing effects of [Old School RuneScape’s Ancient Magicks](https://oldschool.runescape.wiki/w/Ancient_Magicks).

Melee swings check the moving weapon against the shield and body regions. Head, body, arm, and leg hits deal different damage and produce different reactions. The defeated fighter falls with a jointed ragdoll. Some killing blows end in a finisher, chosen by weapon and hit zone (`finishers.js`): a frost shatter, a bolt pin, a rare beheading, a rapier run-through with a kick, a grounded maul collapse, or a rare finishing spear throw. Finishers start after the winner is decided and only change drawing. Toggle **Hitboxes** to see collision shapes.

Fighters move and act on independent clocks, so windups can overlap and either fighter can land a follow-up. Heavy two-handed melee weapons hit harder, use more energy, and recover more slowly. Very high Strength shortens their recovery. Hits and blocks can wear down the stance meter. A stance break lowers the fighter into a vulnerable stagger. Shields can bash after a block or interrupt a nearby heavy windup. A perfect block earns a riposte bash with knockback, and being knocked into the arena edge staggers. Bucklers bash faster and tower shields hit harder. Once per bout, a staggered fighter may throw sand to blind a nearby attacker for 2 seconds. To test these, open `sandbox.html?force=perfect,wall,sand` (any subset) to make them trigger whenever they can. [Elden Ring combat guide](https://www.bandainamcoent.com/es_mx/news/elden-ring-introduction-part-4-combat-guide)

The Sand Pit, Fernwood Clearing, and Moonlit Ruins rotate every one to three completed bouts. Between bouts, select the venue name to preview the next one, or select a marker in the scene to cheer with spectators, startle wildlife, or stir the ruins’ birds and fireflies.

Pause or change speed to control how you watch a bout. Auto-rematch runs back-to-back bouts until switched off. Win totals last for the current page session.

The **Quality** menu saves your choice for the next visit. Low is the default. Medium and High refine the fighters, equipment, bolts, finisher props and the three venues. High draws about twice as much geometry as Low in the reference bout.

**Generate matchup** rolls two new fighters with a level gap of at most nine, different combat builds, and equipment suited to each build. Neither fighter keeps a weapon from the previous bout, both levels change, and each fighter receives a different spellbook. Generated matches roll all gear slots. **Rematch**, **Auto-rematch**, and **Reset** keep the same two fighters.

The in-game **Mechanics guide** (`mechanics.html`) explains the combat rules and lists improvement ideas. Its numbers are written by hand, so update it when combat values change.

## Weapon specials

Rare special weapons (`specials.js`) reuse an existing weapon's model with new colors and small details, and change the fight through a few hooks that `arena.js` calls (attack start, landed hit, every step, blocking, weapon choice and drawing). A generated fighter carries one 5% of the time; the **Main** and **Backup** pickers list them, marked ★, under *Special weapons*, so you can equip one before a fight. A fighter carries at most one special. There are fifteen: **Stormbrand** (sword, lightning after three landed hits), **Snarecaster** (crossbow, a 3-second root), **Last Oath** (greatsword, +60% damage and lifesteal below 10% health, no blocking), **Dawn Mender** (mace, an interruptible heal below 35% health), **Dragon Bow** (crossbow, one burning double shot), **Winter’s Bite** (axe, every third hit freezes), **Leech Fang** (rapier, heals on hit, costs HP on a miss), **Earthshaker** (maul, one stance-breaking slam), **Jailer’s Chain** (flail, one pull) **Phoenix Spear** (survives one killing blow at 1 HP and sets the attacker burning), **Tidecaller** (trident, every third hit a wave that can slam the target into the wall), **Gambler’s Club** (club, a die roll per swing: 6 triples, 1 fumbles), **Briar Blade** (falchion, thorns), **Pendulum** (twin flail, momentum that speeds up swings) and **Headsman’s Verdict** (executioner blade, one unblockable execution below 25% health). The mechanics guide has the numbers. `?force=oath,mender,pull,verdict` makes the health- and distance-gated ones trigger early for testing. The scoreboard shows each fighter's special and its state.

## Combat effects

Hits, heavy blocks, and stance breaks shake the arena, with the strongest shake on the finishing blow. The shake is off when the system asks for reduced motion. Melee swings leave a short trail behind the weapon head, warmer for heavy weapons. Blows flash at the contact point, blocks and hits on plate throw sparks, and footfalls, heavy blows, stance breaks, and falling bodies raise dust tinted to the venue. A blocked crossbow bolt stays stuck in the shield for the rest of the bout. Weapon wounds spray blood that stains the ground until the next bout, and a fighter felled by a weapon leaves a spreading pool. Damage numbers grow with the share of health lost, show the hit zone and armor weakness underneath, turn gold for head hits and green for healing, and stay readable at any playback speed. All effects live in `effects.js` and are cosmetic: they never change fight state or use the simulation's random rolls.

## Animation

Fighters coil before they swing and carry the weapon through after it lands, then settle back to guard. Heavy two-handed weapons coil deepest, spears draw back for a thrust, crossbows steady the aim and kick on release, and staves gather power before pushing a spell out. Blows knock the defender back by more for heavier hits and a larger share of health lost, and big hits force a stumble step. Head hits snap the head back, body blows double the fighter over, arm hits fling the arm, and leg hits buckle the knee. A blocked weapon rebounds off the shield while the defender braces, and a miss overreaches. This motion is drawing only: `fighterPose` stays the combat pose that hit detection, guarding and movement use, and `displayPose` adds the animation on top for rendering. While a blow can still connect, both fighters are drawn exactly in their combat pose, so **Hitboxes** match what you see when it matters.

## Renderers and benchmark

The benchmark overlay is hidden by default so it never covers the fight. Select **FPS** next to the speed control to show or hide it, or open `sandbox.html?bench` to start with it open. It reports current, average and minimum FPS (over half-second windows), the worst frame interval, main-thread draw time, and frame drops: frames that take more than 1.5 times the expected interval for the screen's refresh rate, which is estimated from the fastest animation frames (`?hz=60` overrides it). The first second after loading, Reset or a toggle is ignored, and so is time while paused or in a hidden tab. The text updates four times a second.

The overlay toggles the fighter painter between **Canvas** (the default) and **WebGL**, and **Polys 1×/3×** builds each fighter three times over to test three times as many polygons with the same picture. The choices are saved in the browser; `?renderer=webgl` and `?polygons=3` set them from the address bar.

Opening with `?bench` adds face and triangle-equivalent counts by fighter part, plus cached and animated scenery counts and the most recent backdrop rebuild time. The same breakdown is available from `ArenaBench.snapshot()` while that overlay is open. Use **Polys 1×** to compare Quality levels.

The second row of buttons finds what limits the frame rate on a device. **Res full / Res 1×** draws the arena at up to 2 pixels per CSS pixel or at 1 (`?res=1`), which tests fill rate. **Fighters**, **Scenery** and **Effects** each skip drawing that part: the fighters' polygons and shadows, the animated crowd and wildlife, or dust, trails, blood, sparks, magic, bolts and damage numbers. These toggles change only the picture, are never saved, and add **TEST TOGGLE ON** to the overlay while active. The **Scene · Fighters · FX** line shows the main-thread milliseconds each part took per frame. Only the depth-sorted fighter polygons move to WebGL (`gl-renderer.js`). They are painted in sorted order into an offscreen WebGL canvas that is drawn into the arena canvas where Canvas 2D would have filled them, so backdrops, shadows and effects keep their layering. Concave and self-crossing polygons use a stencil pass with the same nonzero fill rule as Canvas 2D. Rendering is capped at 120 FPS; skipped frames leave the simulation clock alone, so the next frame advances by the full elapsed time.

Measured at phone size on a Mac (60 Hz), both renderers held 60 FPS with no drops at 1× and 3×. WebGL cut main-thread draw time from 3.2 to 2.3 ms at 1× and from 9.2 to 5.0 ms at 3×, and painting alone from 1.8 to 0.4 ms. The first test on a phone reported about 24 FPS on Canvas and 22 FPS on WebGL. The follow-up phone profiling steps and full measurements are in [docs/rendering-performance.md](docs/rendering-performance.md). The plan for doubling geometric detail with a Quality setting is in [docs/detail-rework-plan.md](docs/detail-rework-plan.md).

## Armor geometry

The prototype projects procedural 3D shapes onto Canvas 2D. With the fighter in an idle pose, the standard plate torso and helmet submit 1,044 triangle equivalents on Low and 1,980 on High. Leather goes from 853 to 1,569 and robes go from 695 to 1,281. The counts triangulate the polygons passed to the renderer. Rendered size and frame time also matter when comparing detail at the in-game camera distance.

## Development plan

See [docs/implementation-plan.md](docs/implementation-plan.md).
