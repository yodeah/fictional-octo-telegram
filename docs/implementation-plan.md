# Implementation plan

All 21 suggestions in [the proposal](swords-and-sandals-proposal.md) were approved on 2026-11-26, with a public repository. Work happens on `swords-and-sandals`; `main` mirrors the old sparring prototype until you merge.

**Order:** stage 1 makes the game playable from start to finish. Every later stage is an improvement that leaves it playable. Stop after any stage.

## How to run a stage with Sonnet

Open a fresh session in the repository and paste:

> Read `docs/implementation-plan.md`, do the next unchecked stage only, follow `AGENTS.md`, run `node --test tests/*.test.mjs`, play one run in the browser at phone width, tick the stage, then commit and push.

One stage per session keeps the context small. Use a single read-only reviewer only when a stage changes combat logic.

## Where things live

| File | Holds |
| --- | --- |
| `rules.js` | Run state, economy, characters, opponents, champions. No DOM: tests load it in Node. |
| `duel.js` | Seeded, fixed-step wrapper around the engine. The same seed gives the same fight. |
| `game.js`, `game.css`, `art.js` | Screens, saving and drawn scenes. |
| `arena.js` and friends | Combat engine and its drawing. |
| `tests/` | Headless tests: rules, repeatable fights, whole runs, weapon balance. |
| `sandbox.html` | The old sparring page, for trying weapons. |

## Stages

- [x] **1. Playable run** (suggestions 1–3, 4, 5–9, part of 10, 12, 17, 21). Dice and race creation, shipwreck intro, days and debt, market, gear, training, rest, sparring and blood bouts, four champions, one mercy per act, spell pages from champions, autosave, save code, Legacy checkpoints, 50% more health, sudden death, headless tests.
- [ ] **2. Phone hosting.** Public repository and GitHub Pages from the work branch are live (checked 2026-11-26): https://yodeah.github.io/fictional-octo-telegram/. Home-screen icon and manifest added (2026-11-26). Nothing is left for an agent: the box stays open until you have played from the link on your phone, and the next agent starts stage 3. *Done when the link plays on your phone.*
- [x] **3. Tactics and injuries** (10, 11). Stance and target on the bout screen; wounds with a surgeon (2026-11-26). Each stance has a matchup only it wins, in `tests/tactics.test.mjs`.
- [ ] **4. Spellbook rework** (13). More pages, three slots, a trigger per spell. *Done when triggers change outcomes in tests.*
- [ ] **5. Strangers and bargains** (14). Five visitors, each with a shown price. *Done when no bargain is always right or always wrong for the test bot.*
- [ ] **6. Spectate and bet** (15). Watch champions and others; watching reveals their gear.
- [ ] **7. Crowd and Charm** (16). Crowd favour changes pay and mercy; Charm changes prices.
- [ ] **8. Shop and inventory depth** (17). Limited bag, repairs, trophies, champion specials with descriptions.
- [ ] **9. Quests** (18). Eight to ten short goals.
- [ ] **10. Art and sound** (20). Richer first-person scenes, an arena backdrop per act, synthesized sound with mute.
- [ ] **11. Champion finishers** (19).
- [ ] **12. Balance pass** (21). Tune from your own runs and the test numbers: about 2 hours for a well-played run.

## Notes for later stages

**Phone install (stage 2)**
- iPhone: open the live link in Safari, Share, Add to Home Screen. Android: Chrome menu, Add to Home screen or Install app.
- On iPhone the home-screen app is expected to keep its own storage, apart from Safari. Move a run across with **Save code**. Not yet checked on a device.
- There is no service worker, so the game needs a connection to load.
- GitHub Pages serves the game from a subfolder: keep every path relative.
- `icons/icon.svg` is the source. After editing it, rebuild each PNG on a Mac with `sips -s format png -z 192 192 icons/icon.svg --out icons/icon-192.png` (also 180 and 512).

**Tactics and wounds (stage 3)**
- `tactics` and `aimZones` in `arena.js` hold every number. `Rules.tacticKeys` and `aimKeys` mirror their keys (a test checks it). Wound numbers are in `rules.js`. `mechanics.html` repeats both by hand.
- `balanced` and `any` must change nothing: no extra random rolls, multipliers of exactly 1. That keeps older saved fights replaying. Checked once against 400 fights from before the change.
- A fighter's choice is `fighter.tactic` and `fighter.aimAt`. `fighter.stance` was already the stance *meter*.
- The engine reuses its two fighter objects, so every new optional fighter field needs a default in `duel.js`.
- A fight result has `worst`, the part of the hero that took the most damage. Bolts and spells count as body.
- Saves stay `v: 1`. `run.tactic`, `run.aimAt` and `run.wounds` may be missing; use `Rules.woundsOf(run)`.
- Opponents and champions always fight balanced with no target. The test bot never changes stance or target.
- Targets swing a lot by weapon (in mirror duels, aiming high is very bad for axes and good for clubs and spears). Axes and mauls rarely reach the legs. Leave tuning to stage 12.
- `specialHit` and `chipDamage` (specials, burn) ignore `taken` and do not count toward `zoneDamage`.
- Any new energy check in the engine must use the cost after the stance multiplier.
- Wounds made the sensible bot finish 17 of 30 runs instead of 19 (`node tests/report.mjs`). It pays the surgeon only before a champion; paying every time starves it of debt money.
- Stance matchups are sensitive to combat changes. If one of those tests fails after a combat edit, check the new rates on a few hundred seeds before picking another matchup.

**Working in the repository**
- `swords-and-sandals` is usually checked out in another worktree. Branch from `origin/swords-and-sandals` under a new name and push with `git push origin HEAD:swords-and-sandals`.
- The test run takes about 3 minutes, mostly the whole-run bot test; `tests/report.mjs` takes 5 to 7.
- If the app's browser pane is hidden, the fight animation pauses: use **Skip to the end**.
- To play in the app's browser, serve the folder (`python3 -m http.server`) and set the phone size again if a click lands outside the page.
