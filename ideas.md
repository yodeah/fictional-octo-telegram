# Ideas

A backlog of improvements, sorted by **score = impact ÷ cost**, best first. The top entries are the most impact for the fewest tokens.

- **Impact:** 1 (barely noticed) to 5 (changes how the game feels or what it can become).
- **Est. tokens:** a rough guess at the total tokens one agent session spends to build, test in the browser, document and commit the idea. Treat it as an order of magnitude, not a quote.
- **Score:** impact per 10k tokens, rounded.

Fights stay fully idle (see README): ideas must not add in-fight input. The staged game features live in [docs/implementation-plan.md](docs/implementation-plan.md).

| # | Idea | Impact | Est. tokens | Score | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 | **Clear labels on Skip** | 2 | 10k | 2.0 | **Skip to the end** piles every damage label and blood spray over the final frame. Drop them when skipping. |
| 2 | **Keep finishers in view** | 2 | 15k | 1.3 | Bodies knocked back near the arena edge (pins, launches, falls) end partly off-screen. Pin to the wall there instead, or nudge the camera. |
| 3 | **Frost wording** | 2 | 15k | 1.3 | Frost Lance says it slows the target but slows attacks; Freeze stops movement, not attacks. Make the text and behavior match. |
| 4 | **Balance report for specials and spells** | 3 | 25k | 1.2 | `tests/weapons.mjs` covers plain weapons; add specials, armor and spells. |
| 5 | **Punish staggered fighters** | 3 | 25k | 1.2 | A staggered fighter takes only 14% more damage today, so a stance break barely pays off. Raise it a lot (start around +60%), show it on the hit, and check that wall slams and shield bashes don't decide bouts alone. |
| 6 | **Opponents with stances** | 4 | 35k | 1.1 | Give blood-bout foes and champions a stance and target shown on the bout screen, so the player's pick has something to answer. Keep old saved fights balanced. |
| 7 | **Status icons over fighters** | 3 | 30k | 1.0 | Small icons above the health bar for burning, rooted, blinded, frozen and staggered, so effects read at a glance. |
| 8 | **Check the special roll rate** | 1 | 10k | 1.0 | Generated fighters got a special 3–4% of the time in tests, below the 5% target, because the previous bout's weapons and pure mages are excluded. Retry the roll on another eligible special or accept the lower rate. |
| 9 | **Rags that look like rags** | 2 | 20k | 1.0 | In 2D the castaway’s rags borrow the leather set, so a new gladiator already looks armored. |
| 10 | **Breathing during bouts** | 2 | 20k | 1.0 | Fighters no longer bob while fighting, because hit detection read it from the page clock. Add it back in `displayPose` only, faded out while a blow can connect. |
| 11 | **Slow motion on the killing blow** | 4 | 45k | 0.9 | Drop to 0.3× for half a second with a slight camera push. Pairs with Stage 4 finishers. |
| 12 | **Opponents with spells and triggers** | 3 | 35k | 0.9 | Later blood foes mostly cast nothing. Give them spells and a trigger shown on the bout screen, so the player’s triggers have something to answer. |
| 13 | **Sparring losses look fatal** | 2 | 25k | 0.8 | A sparring loss ends at 0 HP with a body in a pool of blood, while the text says first blood. Stop at a yield, with the loser kneeling. |
| 14 | **Strength kick** | 4 | 60k | 0.7 | A fighter with a clear Strength advantage can kick a close opponent: little damage, but it staggers and knocks them back (into the wall if near). Costs energy, has a cooldown and a readable wind-up, and stays idle (the AI picks it). Pairs with Punish staggered fighters. |
| 15 | **Offline play** | 2 | 30k | 0.7 | A service worker that caches the files, so the home-screen app opens without a connection. Must not leave players on a stale version. |
| 16 | **Synthesized sound** | 5 | 80k | 0.6 | WebAudio clangs, thuds, bolt twangs, spell whooshes and crowd roars, generated in code with no assets, plus a mute toggle. The game is silent today. |
| 17 | **Bout summary card** | 3 | 50k | 0.6 | After the bout: damage dealt, blocks, perfect blocks, specials used and the turning point. |
| 18 | **Wall hazards per venue** | 3 | 55k | 0.5 | Build on wall slams: spikes in the Sand Pit, thorns in Fernwood, crumbling stone in the Ruins, each adding a small effect. |
| 19 | **Seeded replays** | 3 | 70k | 0.4 | Route every simulation roll through one seeded generator so a bout can be replayed exactly. Needed later for offline results. |
| 20 | **2D venues** | 3 | 80k | 0.4 | Redraw the three venues and crowds to match the 2D fighters. See the [2D art plan](docs/2d-art-poc.md). |
| 21 | **Crowd hype meter** | 3 | 90k | 0.3 | Rises with perfect blocks, specials, staggers and comebacks; a full meter makes the crowd roar and drops a small cosmetic reward. |
| 22 | **Fighter personalities** | 4 | 120k | 0.3 | Traits such as reckless, patient or showman that shift AI choices (aggression, blocking, sand throws). |
| 23 | **Weapon attack modes** | 5 | 180k | 0.3 | Give the idle AI cheap and committed attacks, staff range choices and a spear throw finisher. See the [weapon plan](docs/weapon-attack-modes.md). |

## Adding ideas

Any agent working here may add an idea when it notices a good one: put it in the table with impact, estimated tokens and score, keep the table sorted by score, and renumber. Remove an idea in the commit that implements it.
