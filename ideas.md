# Ideas

A backlog of improvements, sorted by **score = impact ÷ cost**, best first. The top entries are the most impact for the fewest tokens.

- **Impact:** 1 (barely noticed) to 5 (changes how the game feels or what it can become).
- **Est. tokens:** a rough guess at the total tokens one agent session spends to build, test in the browser, document and commit the idea. Treat it as an order of magnitude, not a quote.
- **Score:** impact per 10k tokens, rounded.

Fights stay fully idle (see README): ideas must not add in-fight input.

| # | Idea | Impact | Est. tokens | Score | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 | **Guard the zero-size resize** | 1 | 5k | 2.0 | `resize()` throws when the canvas has no size (a hidden tab or pane at load). Skip the backdrop copy when width or height is 0. |
| 2 | **Sudden death** | 3 | 20k | 1.5 | After 60 simulated seconds, damage rises a little every few seconds so two defensive builds can't stall. |
| 3 | **Keep finishers in view** | 2 | 15k | 1.3 | Bodies knocked back near the arena edge (pins, launches, falls) end partly off-screen. Pin to the wall there instead, or nudge the camera. |
| 4 | **Frost wording** | 2 | 15k | 1.3 | Frost Lance says it slows the target but slows attacks; Freeze stops movement, not attacks. Make the text and behavior match. |
| 5 | **Headless balance runner** | 4 | 35k | 1.1 | `?balance` steps `update()` without drawing for a few thousand generated bouts and prints win rates by weapon, special, armor and spellbook. Agents already do this by hand from the console. |
| 6 | **Status icons over fighters** | 3 | 30k | 1.0 | Small icons above the health bar for burning, rooted, blinded, frozen and staggered, so effects read at a glance. |
| 7 | **Attack stat matters** | 2 | 20k | 1.0 | Attack currently does almost nothing. Give it a small accuracy or block-penetration effect. |
| 8 | **Check the special roll rate** | 1 | 10k | 1.0 | Generated fighters got a special 3–4% of the time in tests, below the 5% target, because the previous bout's weapons and pure mages are excluded. Retry the roll on another eligible special or accept the lower rate. |
| 9 | **Slow motion on the killing blow** | 4 | 45k | 0.9 | Drop to 0.3× for half a second with a slight camera push. Pairs with Stage 4 finishers. |
| 10 | **Synthesized sound** | 5 | 80k | 0.6 | WebAudio clangs, thuds, bolt twangs, spell whooshes and crowd roars, generated in code with no assets, plus a mute toggle. The game is silent today. |
| 11 | **Bout summary card** | 3 | 50k | 0.6 | After the bout: damage dealt, blocks, perfect blocks, specials used and the turning point. |
| 12 | **Wall hazards per venue** | 3 | 55k | 0.5 | Build on wall slams: spikes in the Sand Pit, thorns in Fernwood, crumbling stone in the Ruins, each adding a small effect. |
| 13 | **Seeded replays** | 3 | 70k | 0.4 | Route every simulation roll through one seeded generator so a bout can be replayed exactly. Needed later for offline results. |
| 14 | **Crowd hype meter** | 3 | 90k | 0.3 | Rises with perfect blocks, specials, staggers and comebacks; a full meter makes the crowd roar and drops a small cosmetic reward. |
| 15 | **Fighter personalities** | 4 | 120k | 0.3 | Traits such as reckless, patient or showman that shift AI choices (aggression, blocking, sand throws). |
| 16 | **Weapon attack modes** | 5 | 180k | 0.3 | Give the idle AI cheap and committed attacks, staff range choices and a spear throw finisher. See the [weapon plan](docs/weapon-attack-modes.md). |
| 17 | **Finish the 2D art** | 5 | 190k | 0.3 | If the 2D proof of concept wins: the other six weapon families, variants and shields. See the [2D art plan](docs/2d-art-poc.md). |
| 18 | **Saved stable** | 5 | 250k | 0.2 | Persist fighters, records, injuries and earnings in local storage. Start of the management layer. |

## Adding ideas

Any agent working here may add an idea when it notices a good one: put it in the table with impact, estimated tokens and score, keep the table sorted by score, and renumber. Remove an idea in the commit that implements it.
