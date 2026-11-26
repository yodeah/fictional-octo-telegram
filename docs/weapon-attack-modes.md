# Weapon attack modes

Give each weapon a cheap move the fighter can rely on and a more demanding move worth saving energy for. Fights stay fully idle. A spectator should be able to tell what the fighter attempted from the wind-up, then see what actually landed in the combat log.

## First playable moves

These are starting values to playtest. Energy (EP) pays for physical effort. Mana (MP) pays for spellbook casts. The rapier currently costs 17 base EP, the ordinary axe uses the two costs below, and Staff Spark already deals 8 base magic damage for 0 MP.

| Weapon and move | Proposed cost | When the fighter uses it | What the spectator sees |
| --- | ---: | --- | --- |
| Rapier · Chest thrust | 12 EP | Default at the outer edge of rapier reach. Reliable aim and quick recovery. | A straight extension toward the torso. The shield can intercept it. |
| Rapier · Draw cut | 8 EP | When crowded or saving energy. Shorter reach and lower damage. | A quick lateral slash with a narrow trail. It deals slashing damage wherever the blade connects. |
| Rapier · High lunge | 24 EP | On a counter opening or against a staggered rival. A miss leaves a long recovery. | A step forward and a rising point aimed at the head. Only actual head contact earns the head-hit reward. |
| Axe · Light chop | 16 EP | Default against a moving rival or when energy is low. | A short diagonal chop. Modest stance damage and a quick return to guard. |
| Axe · Overhead cleave | 36 EP | When a rival is close to a stance break or caught recovering. | A two-beat overhead wind-up. Heavy stance damage on contact, with time for a perfect block or interruption. |
| Staff · Haft tap | 6 EP, 0 MP | Inside roughly 1.6 arena units. A weak physical fallback even with an empty spellbook. | The caster shortens their grip for a blunt tap. Start at 4 base damage. |
| Staff · Staff Spark | 0 EP, 0 MP | Outside tap range, up to roughly 4.5 units. Fires at normal cast cadence while the caster saves mana. | The existing small projectile. Keep its 8 base damage initially. Paid spells still compete for damage, healing and control. |
| Spear · Probe | 11 EP | Maintain distance or conserve energy. | A quick thrust with a small step back on recovery. |
| Spear · Driving thrust | 25 EP | Near full reach against a recovering rival. | A committed step behind the spear, with higher stance damage and slower recovery. |

**Spear finisher — Last Cast.** The current game gives a lethal spear melee hit from at least 1.8 units away a one-in-eight chance of Last Cast. The winner rocks back and throws the spear, pinning the fallen rival. Once spear modes exist, use the driving thrust as the eligible move. The throw spends no extra energy and deals no second hit.

**Planned sword and rapier finisher — Lodged Blade.** A killing thrust to the torso can occasionally leave the blade stuck in the opponent. The victor lets go of the hilt as the opponent falls. A brief blood mark shows the point of contact, and the blade falls with the body and stays embedded through the victory screen. On a rapier kill, the existing run-through and kick remains another possible finish.

## Rest of the roster

Use the existing nine weapon families to share moves and animation work. The variants below change a move or its payoff enough to be recognizable at arena zoom. Start other families' quick moves near 60% of their current effective attack cost and committed moves near 130%. Tune costs against recovery and hit rate together.

| Family | Shared choices | Variant signatures |
| --- | --- | --- |
| Sword | Quick thrust for reach, sweeping cut for pressure. | Rapier uses the three moves above. Falchion gets a heavier returning cut when the first swing draws a block, with a visible second wind-up and its own energy cost. |
| Greatsword | Short-grip jab in a crowd, full sweeping cut with room. | Claymore gets a long diagonal sweep. Executioner blade trades reach for a delayed descending cut against a staggered rival. |
| Spear | Probe and driving thrust. | Trident can catch a shield on its prongs for bonus stance pressure on a block. Halberd can switch from a thrust to a slower hooked sweep. Reserve Last Cast for the spear. |
| Axe | Light chop and overhead cleave. | Bearded axe can spend its heavy attack catching a shield rim for stance pressure. Crescent axe gets a broad, slow sweep with extra reach. |
| Mace | Quick knock for HP pressure, heavy blow for stance pressure. | Morningstar gets a short rising strike. Bronzewood club can spend extra energy on a double knock, with a pause for a block between hits. |
| War maul | Short shove to regain space, committed slam against a staggered rival. | War pick turns for a narrow piercing strike. Stone sledge gets the longest wind-up and a dust ring on impact. |
| Flail | Short chain snap when crowded, full orbit with room to swing. | Chain scourge can reach around the edge of a guard if its path clears the shield. Twin flail alternates heads on its committed swing, splitting its damage budget across both contacts. |
| Crossbow | Snap shot before the rival closes, aimed shot for accuracy when there is time to reload. | Windlass arbalest braces for a high-stance-damage bolt. Repeating bow can spend extra energy on a short burst, with lower damage per bolt. |
| Staff | Haft tap nearby, Staff Spark at distance, spellbook casts when worthwhile. | Ash scepter fires a quicker, weaker cinder. Sun staff winds up a brighter, slower spark. Both built-ins cost 0 MP and use the same range rules. |

## Ranked implementation queue

Work down this table one row per playable commit. Impact rates the expected change in what a spectator sees or what a fighter can do, from 1 to 5. Within a tier, earlier rows unlock later ones or give a clearer result for less work. The maul collapse and Last Cast already shipped in `4d3efa9`.

| Order | Impact | Change and effect | Check before committing |
| ---: | ---: | --- | --- |
| 1 | 5 | **Shipped.** Axe and mace shield breaks give sustained pressure a visible payoff. | Break a shield on a block, finish the bout, then verify a fresh shield on rematch. |
| 2 | 5 | **Shipped.** Axe light chop and heavy cleave introduce the shared mode choice with an immediate energy tradeoff. | See both moves in one matchup. Check energy cost, wind-up, recovery, and shield contact. |
| 3 | 5 | Staff tap and ranged Spark let an empty-mana caster fight at either distance. | At zero MP, watch the tap up close and Spark at distance. With mana restored, confirm a useful book spell still wins. |
| 4 | 5 | Rapier draw cut, chest thrust and high lunge make aim readable. | Watch a shield intercept a thrust and a high lunge miss. Award head damage only on head contact. |
| 5 | 4 | Mace quick knock and heavy blow give shield pressure a second rhythm. | Compare block, stance damage and recovery. Verify the club double knock resolves each contact once. |
| 6 | 4 | Spear probe and driving thrust reward spacing and give Last Cast a recognizable setup. | Check a blocked thrust, a close kill and a lethal long thrust. |
| 7 | 4 | Crossbow snap and aimed shots change the value of maintaining distance. | Compare close and distant shots. Verify the repeater burst consumes its budget once. |
| 8 | 3 | Sword and falchion cuts add variety to the starting loadout. | Watch the falchion return cut and verify its extra energy cost. |
| 9 | 3 | Lodged Blade gives sword and rapier thrusts a rare finish. | Trigger it with each weapon. Check that the victor releases the only visible blade, it follows the falling torso, and the victor has it back on rematch. |
| 10 | 3 | Greatsword jab and sweep give a two-handed fighter a close-range option. | Check shield stowing and compare recovery on a missed sweep. |
| 11 | 3 | Maul shove and slam let the fighter trade damage for space. | Verify shove distance near both walls and a grounded fall on a lethal slam. |
| 12 | 3 | Flail snap and orbit reward choosing the right distance for the chain. | Verify shield interception and two distinct contacts on the twin flail. |
| 13 | 2 | Add outstanding variant signatures from the roster table, one variant per commit. | Compare each with its parent in the same matchup. Check its rare weapon hooks on blocks, misses and multi-hit attacks. |

In the first mode commit, carry the chosen move through AI selection, energy payment, pose, collision, damage type and combat logging. Show costs in loadout details. Require full energy for committed moves and retain the fatigue fallback for the cheapest physical move. Verify existing weapons in the same build. For each following row, run a complete browser bout, check the console, and mark the row shipped in the feature commit.
