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
| `fighter2d.js`, `weapons2d.js`, `armor2d.js` | The 2D fighter art, the default. Details in [2d-art-poc.md](2d-art-poc.md). |
| `tests/` | Headless tests: rules, repeatable fights, whole runs, weapon balance. |
| `sandbox.html` | The old sparring page, for trying weapons. |

## Stages

- [x] **1. Playable run** (suggestions 1–3, 4, 5–9, part of 10, 12, 17, 21). Dice and race creation, shipwreck intro, days and debt, market, gear, training, rest, sparring and blood bouts, four champions, one mercy per act, spell pages from champions, autosave, save code, Legacy checkpoints, 50% more health, sudden death, headless tests.
- [ ] **2. Phone hosting.** Public repository and GitHub Pages from the work branch are live (checked 2026-11-26): https://yodeah.github.io/fictional-octo-telegram/. Home-screen icon and manifest added (2026-11-26). Nothing is left for an agent: the box stays open until you have played from the link on your phone, and the next agent starts stage 3. *Done when the link plays on your phone.*
- [x] **3. Tactics and injuries** (10, 11). Stance and target on the bout screen; wounds with a surgeon (2026-11-26). Each stance has a matchup only it wins, in `tests/tactics.test.mjs`.
- [x] **4. Spellbook rework** (13). Market pages, three slots, a trigger per spell chosen on the bout screen (2026-11-26). `tests/spells.test.mjs` shows triggers changing win rates.
- [x] **5. Strangers and bargains** (14). Five visitors between days, each with a shown price (2026-11-26). `tests/bargains.test.mjs` shows each one right in one situation and wrong in another, for the test bot and in measured odds.
- [x] **6. Spectate and bet** (15). Watch the champion or an undercard for a day and bet up to a day’s wage; watching the champion reveals gear and habits (2026-11-27). `tests/stands.test.mjs` shows simple betting strategies losing gold.
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

**Spells and triggers (stage 4)**
- `spellTriggers` in `arena.js` holds the conditions; `Rules.triggerKeys` mirrors its keys (a test checks it). `mechanics.html` repeats them by hand.
- A fighter's choice is `fighter.triggers` (`{ spellKey: triggerKey }`, default `null` in `duel.js`). `auto` or missing must change nothing and add no random rolls. Checked against 720 fights from before the change.
- A due trigger skips the weapon scoring in `pickAction` and casts in slot order (`hero.spellList` order). A held spell is invisible to the old scoring, support spells included.
- `run.triggers` and `run.pageAct` may be missing in old saves. Use `Rules.triggerFor(run, key)`.
- All 12 spells can now turn up on pages. The market sells one page per act from act 2 (`Rules.buyPage`). The test bot buys none and sets no triggers.
- Opponents and champions always cast on their own judgement.
- Trigger matchups, like stance matchups, are sensitive to combat edits: recheck rates on 100 seeds before changing one.

**Strangers and bargains (stage 5)**
- `visitors`, `visitorOffer`, `visitorTerms` and `acceptBargain` in `rules.js`. Terms are text built from the same numbers as the effects, except a few written into both: check them together.
- A visitor arrives in `endDay` (day 3 on, 25%, never two days running) and leaves at the next day or fight. Ignoring one is refusing.
- They roll on `run.fate`, apart from `run.rng`, so meeting one never changes a run's foes or fight seeds. A drawn duel does use `run.rng`.
- The offer, the deck card included, is fixed on arrival and saved. `run.met`, `run.visitor`, `run.duel` and `run.fate` may be missing in old saves; use `Rules.metOf(run)`.
- `run.duel` blocks every day action until the duel is fought. Fight kind `duel` pays and risks like a blood bout.
- Engine additions: `fighter.zeal` (default `false` in `duel.js`, damage ×`zealDamage` below half health, not on specials or burning) and the `verdict` spell (`hpCost` on a damage spell; not in `Rules.spellPool`).
- The Peddler’s “see every enemy” became the champion wall: ordinary foes already show their gear.
- `wouldAccept` in `tests/bot.mjs` judges by trial fights against the blood bout and champion ahead. `tests/report.mjs` prints how often each bargain is taken and refused.
- Sensible bot, 30 runs (seeds 1–30): 17 won before stage 4, 13 after it, 13 with stage 5 refusing every stranger, 10 with the bot judging bargains. So strangers by themselves change nothing, and the bot's short-sighted yeses cost it about 3 runs: it judges only the next blood bout and champion, on small samples, for permanent trades. The stage 4 drop may be the two new spells on pages or noise. Left for the stage 12 balance pass.
- Stage 6 (spectate) should reuse `run.fate`-style separate dice if it adds random events.

**The stands (stage 6)**
- `billFor`, `bookOdds`, `startWatch`, `finishWatch` and `study` in `rules.js`. The engine comes in as a callback `duel(seed, first, second)`, so `rules.js` still needs no engine.
- The bill depends only on `run.sands`, the day and the act, so it is rebuilt, not saved, and never touches `run.rng`. `run.sands` and `run.scouted` may be missing in old saves.
- A watched bout is `run.pending` with `kind: 'watch'`; the two fighters sit in `hero` and `foe`, and `winner` is stored before anything is shown. `finishFight` hands it to `finishWatch`, which ignores the replayed result. An engine change between deploys could make a bout left mid-watch show a different winner than the stored one.
- Odds: 40 trial bouts, 80% of a fair return, 4× at most, no bets under 1.1×. Champion challengers copy the champion's numbers with ordinary gear and no special, so one side is often too strong to bet on.
- The Peddler shows all champions' gear at once but no habits; watching shows only the current champion, with habits and, on the bout screen, `study`'s stance and aim advice.
- Restoring a save code taken before a bet still shows who wins. Fights have the same hole.
- The test bot never watches.

**Repeatable fights (fixed 2026-11-27)**
- Until now `fighterPose` took its breathing from the page clock, so in a browser the same seed could fight differently after a reload. Headless tests never saw it, because that clock stays at 0 there. Anything `checkContact` reads must come from fight state alone; `tests/game.test.mjs` checks the page clock.
- A browser replay now matches Node exactly. Idle breathing still shows before a bout, not during one.

**2D art (merged 2026-11-26)**
- 2D is the default; the **Art** button on the fight screen (or `?style=3d`) brings back the 3D meshes. The choice is kept in `localStorage` under `arena-art`.
- New weapons, shields and armor need an entry in the 2D files, or they keep their 3D mesh. Rags borrow the leather set.
- The picture never changes the fight. A new script must also be listed in `sandbox.html` and `tests/harness.mjs`.

**Deploying**
- Every push to `swords-and-sandals` rebuilds https://yodeah.github.io/fictional-octo-telegram/. Check it with `gh api repos/yodeah/fictional-octo-telegram/pages/builds/latest --jq '.status + " " + .commit'`.

**Working in the repository**
- `swords-and-sandals` is usually checked out in another worktree. Branch from `origin/swords-and-sandals` under a new name and push with `git push origin HEAD:swords-and-sandals`.
- The test run takes about 3 minutes, mostly the whole-run bot test; `tests/report.mjs` takes 5 to 7.
- If the app's browser pane is hidden, the fight animation pauses: use **Skip to the end**.
- To play in the app's browser, serve the folder (`python3 -m http.server`) and set the phone size again if a click lands outside the page.
