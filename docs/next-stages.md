# Ash & Obol: prompts for the next stages

Stage 1 (playable offline grind) is live at https://yodeah.github.io/fictional-octo-telegram/idle/.
Paste one prompt per new session, in order. Each starts in the same worktree and ends deployed. The
backend (plan §14) stays out of scope.

Every prompt starts with this block:

> Work in the worktree `/Users/anemeth/Documents/ChatGPT/gladiator 3d manager/.claude/worktrees/idle-rpg-6210f4` on branch `claude/idle-rpg-6210f4`. The game is the Ash & Obol PWA in `idle/` (React + Vite + TS); the rules live in `idle/src/rules/`. Read `AGENTS.md` and the plan section named below in `docs/idle-rpg-plan.md` first. No backend work. When done: run `npm test`, `npm run typecheck` and `npm run build` in `idle/`; play it with `npm run preview` (port 8164) and check the console; commit; push the branch; then deploy with `gh workflow run pages.yml --ref swords-and-sandals` (a push to this branch alone doesn't deploy), wait for the run to succeed and check `/idle/` live. Remove anything you implement from `ideas.md` and add new ideas you notice.

## Stage 2: watch your hunts in the arena (plan §3.9, milestone 4)

> [block above] Let me watch a hunt as a real bout. Add the optional `stats` block to `hades/sim.js` so an RPG build drives hp, the hit roll (a miss is a 25% "Glance"), damage, armor and stance. Without `stats` the sim must stay bit-identical: prove it with `tools/hades-balance.js` output before and after. Build a fighter from the shade and from each enemy (`rules/build.ts`), add a `FightView` that mounts `HadesRender` on a canvas, and put a "Watch a kill" button on the Hunt card. Add a headless check that 200 seeded bouts all end and that a level L+10 shade beats level L at least 75% of the time. Have a read-only subagent review the sim diff (timing, hit detection, resources).

## Stage 3: the Pale Coliseum and your Sworn (plan §6, milestone 7)

> [block above] Add the Pale Coliseum: six tiers of five named NPC gladiators, climbed one rung at a time. Each fight is a watched sim bout with seeds drawn from the save. Add first-clear gold and arena marks, three paid repeat wins a day, a guaranteed tier item from each final rung, a quartermaster who sells charms for marks, and Varro and Cassian at the top. Let me recruit a Sworn companion here. Add the Coliseum board to Highscores, with bots placed on it by level.

## Stage 4: PK in the Gloam against the bots (plan §5, milestone 8)

> [block above] Add PK against the 240 bots. Split gold into the purse and the Vault (1% deposit fee). Add 4 grudges a day reset at 00:00 UTC, the 12 h Bloodmark (2.5× losses, no deposits), new-shade protection, level brackets with the XP and Infamy factors, gold-loss caps, 1v1 and 2v2 with Sworn, and bot attacks on me while I'm away, applied in time order with a Watch button for the last 10. Add the Infamy board. Test every rule in `idle/tests/`.

## Stage 5: save codes and device accounts (plan §12, milestone 2)

> [block above] Add an export/import save code (`AO1.` + base64url JSON + CRC32) on the Shade tab, so I can move my shade between phone and laptop. Then add the device-only accounts from §12 (PBKDF2, several shades per device, with the plain "not real security" warning), migrating the current localStorage save into IndexedDB.

## Stage 6: the Ledger market (plan §9, milestone 9)

> [block above] Add the Ledger: buy and sell limit orders with price-time matching, partial fills, the 3% toll that is destroyed, the ½×–2× guide-price band, escrow and settlement in the Vault, 8 open orders and 7-day expiry. Bots act as market makers, with stock from their simulated drops, refreshed hourly and caught up on return. Test the matching against the §9 worked example.

## Stage 7: polish and phone pass (milestone 10)

> [block above] Do a phone pass: layout at 375 px and on a laptop, tap targets, frame rate during watched fights, an install prompt and an "update ready" banner from the service worker, and a README section. Then work through the top of the Ash & Obol table in `ideas.md`.
