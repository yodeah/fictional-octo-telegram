# Swords and sandals: suggestions to approve

Written 2026-11-26. Nothing here is built yet. Reply with the numbers you reject or want changed; the stage-by-stage implementation plan comes after that.

## Goal

A gory autobattler with roguelike pressure, playable in portrait on a phone. A well-played run takes about 2 hours. Fights stay idle: every choice happens before the bell. It stays static files with no backend and no build step needed to run it.

## Suggestions

| # | Suggestion | Why | Cost |
| --- | --- | --- | --- |
| 1 | **First person outside fights, side view inside.** Beach, market, training yard and visitors are seen through your eyes; fights keep the current side view. | First-person combat means rewriting rendering, animation and hit detection, and reads badly for an autobattler. | Medium |
| 2 | **Story:** shipwrecked, taken in by a lanista, you owe a debt and win freedom by killing four champions. Cast: the lanista, a shopkeeper, a trainer. | Gives the 2 hours a spine. | Small |
| 3 | **Champion wall:** all four champions visible from the first minute, with gear and weakness partly hidden until you scout them. Each kill is a milestone that unlocks a mechanic. | You asked for visible targets; it also makes preparation matter. | Small |
| 4 | **Days as the pressure:** each day pick one of fight, train, rest, work or watch. The lanista collects on set days; missing a payment has a harsh cost. | Choices only matter when you cannot do everything. | Medium |
| 5 | **Dice character creation:** 4d6 drop lowest for Strength, Agility, Endurance, Mind and Charm, with 3 rerolls. | Familiar from D&D, quick on a phone. | Small |
| 6 | **Three races, each with a drawback.** Human: faster training, no peak. Elf: quick and gifted at magic, frail. Demon: lifesteal and fear, the crowd and shops dislike you. | A bonus alone is not a decision. | Small |
| 7 | **Permanent death with a Legacy checkpoint.** The dead gladiator is gone. Each champion killed lets a *new* roll start at that act with one heirloom and less gold. | Keeps death real without repeating the first act forever. | Medium |
| 8 | **Autosave that resists reload-scumming**, plus a copyable save code. Fights use a stored random seed, so reloading replays the same result. The code protects against a phone clearing browser storage. | Without it permanent death is optional. | Medium |
| 9 | **Fights about 50% longer** (HP ×1.5), with sudden death after 60 seconds. | Less luck, no stalemates. | Small |
| 10 | **Injuries:** losing health badly can leave a wound that costs gold, days or stats. You may yield once per act, losing gear and pride instead of your life. | Death should follow from choices, not one bad roll. | Medium |
| 11 | **Tactics before the bell:** stance (aggressive, balanced, defensive) and a target zone. | The main lever a player has in an autobattler. | Medium |
| 12 | **Slow rollout.** Act 1: weapons, shield, armor, energy. Act 2: tactics, crowd, first spell. Act 3: specials, pacts, harder visitors. One short card explains each when it first appears. No mana bar until you learn a spell. | You asked for gradual learning. | Medium |
| 13 | **Spellbook rework:** spells are found one at a time, you equip up to 3, and each gets a trigger such as "below 40% health". | Unlocking and setting triggers are both real choices. | Large |
| 14 | **Strangers with bargains**, at random between days, always with a visible price (examples below). | Your D&D and Baldur's Gate request. | Medium |
| 15 | **Spectate and bet:** watch other gladiators, including champions. Watching reveals their habits; bets use in-game gold. | Spectator mode that also feeds decisions. | Small to medium |
| 16 | **Crowd favour and Charm:** a pleased crowd pays more and may spare you; Charm also lowers prices. | Borrowed from Swords and Sandals. | Medium |
| 17 | **Inventory and shop:** limited bag, buy, sell, repair, champion trophies. A short list of weapons that grows by act. | 27 weapons at once is choice overload. | Large |
| 18 | **Quests:** 8 to 10 short ones, for example win without armor, or spare a rival who returns later. | Goals between champions. | Medium |
| 19 | **Gore finishers per champion**, within the repo's art direction. | Rewards the milestones. | Medium |
| 20 | **Procedural art and sound:** new backdrops drawn in code (canvas or SVG) and simple synthesized hits and crowd. | Loads statically and stays small. It will look stylized, not hand-painted. | Medium |
| 21 | **Tested balance:** a headless runner in Node plays whole runs. Targets: a sensible bot usually wins, a random bot rarely does, no weapon is far ahead, a good run is about 2 hours. | "Beatable" and "decisions matter" become measurable. | Large |

### Example bargains for suggestion 14

All original text, inspired by the kinds of trade in the sources.

- **The Marsh Crone:** +2 to one stat, -2 to another she picks.
- **The One-Eyed Peddler:** see every enemy's gear and weakness, lose accuracy at range.
- **The Red Envoy:** a powerful spell now; each cast costs health.
- **The Deck Dealer:** draw one card: a fortune, a curse or a duel with a stranger.
- **The Flagellant:** accept a wound today for a permanent edge when below half health.

## Left out on purpose

- Direct control during fights.
- A multi-fighter stable or management layer.
- Online features.
- More races, until the first three are balanced.

## Budget

The full list is very unlikely to fit one 5-hour window on a Pro plan; this is a judgment, not a measurement. The plan will be ordered so that each stage is a playable, committed game:

1. **First window:** phone layout, hosting, headless runner, character creation, the core loop of shop, train and fight, champions, autosave and death.
2. **Later windows:** magic rework, strangers, spectating, quests, art, sound and balance passes.

Subagents each start cold and re-read the code, so they spend the budget faster. Use one Sonnet session per stage and a reviewer only for combat changes, as `AGENTS.md` already says.

## Hosting for your phone

On GitHub's free plan, Pages serves public repositories only, so a tap-to-play link means making the repository public (or paying for Pro). Check [GitHub's plans page](https://docs.github.com/en/get-started/learning-about-github/githubs-plans). Tapping an HTML file inside GitHub shows its source, not the game.

## Sources

- [Swords and Sandals II wiki](https://swordsandsandals.fandom.com/wiki/Swords_and_Sandals_II:_Emperor%27s_Reign?oldid=8202)
- [Swords and Sandals first game wiki](https://swordsandsandals.fandom.com/wiki/Swords_and_sandals_gladiator)
- [Baldur's Gate 3 permanent bonuses](https://bg3.wiki/wiki/Permanent_bonuses)
- [Deck of Many Things](https://www.dndbeyond.com/magic-items/deck-of-many-things)
- [Hags in D&D 5e](https://dungeonmister.com/lore/monsters/hags-in-dnd)
- [Domina review: no saving was a major complaint](https://www.scmp.com/culture/arts-entertainment/article/2090746/game-review-domina-thumbs-gladiator-management-thumbs)
- [Mortal Glory design critique](https://medium.com/p/233498db71dc)
- [WebKit storage limits](https://developer.apple.com/forums/thread/710157)
