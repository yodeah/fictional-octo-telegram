# Arena Ledger

A browser prototype for an idle gladiator manager. The first milestone is an automated 1v1 duel in a fixed side view. The fighters use low-poly 3D geometry rendered on Canvas 2D with a perspective camera.

## Run locally

Open `index.html` in a browser, or run `python3 -m http.server 8000` from this directory and visit `http://localhost:8000`. There are no dependencies or build steps.

Each fighter has a main weapon, optional backup weapon, shield, armor, and spellbook. Pin any selection for future bouts or leave the slot on **Auto** to reroll it when the next bout starts. New bouts also roll fresh fighter levels and stats. Hover over a selector or focus it with the keyboard to read details. Changes made during a bout apply at the next one.

Armor has separate attack and defense bonuses for stab, slash, crush, magic, and ranged. The greatsword and war maul trade slower, more expensive swings for higher accuracy and damage. They use both hands, so the shield moves to the back and stops providing defense or blocks until a one-handed weapon is drawn.

The armory contains 27 weapons across blades, polearms, axes, impact weapons, flails, ranged weapons, and staves. Twelve armor sets include four plate harnesses, four leather kits, and four robes. Weapons have different silhouettes, attack profiles, and resource costs. Armor sets trade protection, movement speed, and bonuses to their combat style.

Fighters automatically switch between their two weapons based on distance, skills, energy, mana, and the opponent’s armor. Unused weapons stay visible on the back or hip. Crossbows fire ranged bolts. Staves increase spell power by 30%. The combat triangle gives melee an advantage against leather, ranged an advantage against robes, and magic an advantage against plate. Armor also gives a small boost to its own combat style. [Old School RuneScape combat triangle](https://oldschool.runescape.wiki/w/Combat_triangle)

Melee fighters press crossbow users at close range. A crowded shot loses damage and accuracy, so the shooter favors a melee backup or retreats while casting when a spell is available.

Both fighters start with 60 mana and 100 energy. They recover 3.6 mana and 5 energy per simulated second. Physical attacks, blocks, and dodges use energy. Swapping weapons costs 7 energy. Carrying a spare reduces movement speed by 4% and energy recovery by 0.35 per simulated second. Low energy reduces attack speed and damage. Heavier shields cover more area while slowing movement.

| Spellbook | Role | Spells |
| --- | --- | --- |
| General | Balanced damage and protection | Ember Bolt, Iron Ward, Second Wind |
| Vampiric | Damage that heals and trades health for mana | Crimson Drain, Scarlet Surge, Blood Pact |
| Glacial | Fight at range with slows, a freeze, and shielding | Frost Lance, Winter Barrage, Glacial Shell |
| Storm | Burst damage and energy control | Arc Flash, Thunderclap, Tailwind |

Equip a staff and select **None** for the backup to run a dedicated mage. Staff Spark gives that build a weak free spell when mana runs out. A staff and another weapon form a hybrid. A melee weapon, crossbow, and spellbook let the fighter use all three styles in one bout. The Vampiric and Glacial books draw inspiration from the healing and freezing effects of [Old School RuneScape’s Ancient Magicks](https://oldschool.runescape.wiki/w/Ancient_Magicks).

Melee swings check the moving weapon against the shield and body regions. Head, body, arm, and leg hits deal different damage and produce different reactions. The defeated fighter falls with a jointed ragdoll. Toggle **Hitboxes** to see collision shapes.

Fighters move and act on independent clocks, so windups can overlap and either fighter can land a follow-up. Heavy two-handed melee weapons hit harder, use more energy, and recover more slowly. Very high Strength shortens their recovery. Hits and blocks can wear down the stance meter. A stance break lowers the fighter into a vulnerable stagger. Shields can bash after a block or interrupt a nearby heavy windup. [Elden Ring combat guide](https://www.bandainamcoent.com/es_mx/news/elden-ring-introduction-part-4-combat-guide)

The Sand Pit, Fernwood Clearing, and Moonlit Ruins rotate every one to three completed bouts. Select the venue name to preview the next one. Select a marker in the scene to cheer with spectators, startle wildlife, or stir the ruins’ birds and fireflies.

Pause or change speed during a bout. Auto-rematch runs back-to-back bouts until switched off. Win totals last for the current page session.

**Generate matchup** rolls two new fighters with a level gap of at most nine, different combat builds, and equipment suited to each build. Every **Auto-rematch** uses the same generator. Neither fighter keeps a weapon from the previous bout, both levels change, and each fighter receives a different spellbook. Generated matches roll all gear slots. Use the manual **Rematch** button to retain pinned equipment.

The in-game **Mechanics guide** (`mechanics.html`) explains the combat rules and lists improvement ideas. Its numbers are written by hand, so update it when combat values change.

## Armor geometry

The prototype projects procedural 3D shapes onto Canvas 2D. With the fighter in an idle pose, the standard plate torso and helmet submit 1,044 triangle equivalents, leather submits 853, and robes submit 695. The nine original weapons each submit at least twice as many triangle equivalents as before the armory expansion. The counts triangulate the polygons passed to the renderer. Rendered size and frame time also matter when comparing detail at the in-game camera distance.

## Development plan

1. **Duel prototype** — Establish readable attacks, hits, blocks, and a clear outcome. Use repeated matches to tune reach, damage, and timing.
2. **Stable management** — Recruit a small roster and assign weapons and training. Give bout results consequences through earnings, fatigue, and recovery.
3. **Idle progression** — Save the stable locally and resolve scheduled bouts when the player returns. Let the player replay bouts from the same simulation results used to update the stable.
