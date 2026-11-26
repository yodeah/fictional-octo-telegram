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
- [ ] **2. Phone hosting.** Public repository and GitHub Pages from the work branch are live (checked 2026-11-26): https://yodeah.github.io/fictional-octo-telegram/. Still to do: home-screen icon and manifest. *Done when the link plays on your phone.*
- [ ] **3. Tactics and injuries** (10, 11). Stance and target before each bout; wounds with lasting costs. *Done when each stance wins some matchup the others lose, in tests.*
- [ ] **4. Spellbook rework** (13). More pages, three slots, a trigger per spell. *Done when triggers change outcomes in tests.*
- [ ] **5. Strangers and bargains** (14). Five visitors, each with a shown price. *Done when no bargain is always right or always wrong for the test bot.*
- [ ] **6. Spectate and bet** (15). Watch champions and others; watching reveals their gear.
- [ ] **7. Crowd and Charm** (16). Crowd favour changes pay and mercy; Charm changes prices.
- [ ] **8. Shop and inventory depth** (17). Limited bag, repairs, trophies, champion specials with descriptions.
- [ ] **9. Quests** (18). Eight to ten short goals.
- [ ] **10. Art and sound** (20). Richer first-person scenes, an arena backdrop per act, synthesized sound with mute.
- [ ] **11. Champion finishers** (19).
- [ ] **12. Balance pass** (21). Tune from your own runs and the test numbers: about 2 hours for a well-played run.
