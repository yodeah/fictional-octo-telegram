# Weapon attack modes

Give each weapon a cheap move the fighter can rely on and a more demanding move worth saving energy for. Fights stay fully idle. A spectator should be able to tell what the fighter attempted from the wind-up, then see what actually landed in the combat log.

## First playable moves

These are starting values to playtest. Energy (EP) pays for physical effort. Mana (MP) pays for spellbook casts. Today the rapier costs 17 base EP, the axe costs 29, and Staff Spark already deals 8 base magic damage for 0 MP.

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

## Implementation order and playtests

1. **Rapier and axe.** Add mode definitions beside the weapon data in `arena.js`. Score legal moves for the main and reserve weapons using distance, energy, opposing stance and counter windows. Keep the chosen move on the action through payment, pose, contact, armor response and logging. Apply heavy handling once. Require full energy for committed moves and preserve the existing fatigue fallback for the cheapest physical move. Show costs in loadout details. In a shield matchup, watch a chest thrust hit the shield, a high lunge miss, and a blocked cleave leave a counter opening.
2. **Staff spacing.** Include the tap among the AI's physical candidates and range-gate the existing Spark. Use a small margin around the tap boundary when choosing movement to avoid repeated forward/backward steps. Test with 0 MP at both ranges, then with a stocked spellbook and a wounded caster. Verify tap costs EP once, Spark changes neither resource, and a useful heal still wins the choice.
3. **Spear and Last Cast.** Test a lethal long thrust, an ordinary close kill, a blocked thrust and a rematch. Verify one victory, one visible spear and a restored weapon on rematch. Check the throw at both ends of the arena.
4. **Remaining families and rare weapons.** Introduce each family as a playable change. Let rare weapons inherit their base moves. Audit multi-hit moves so a burst cannot accidentally advance a once-per-attack special several times. Compare mode usage, bout duration and win rates against the previous build across armor, shield and reserve matchups. Investigate any move that wins nearly every decision or never gets chosen.

For each game commit, finish a browser bout from `index.html`, inspect the console, and watch whether the wind-up and recovery communicate the energy tradeoff at normal speed.
