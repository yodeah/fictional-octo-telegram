# Ash & Obol: idle RPG plan

An original idle RPG set in the underworld of the Underworld Duel arena. You play a shade, a dead gladiator who fights for obols. Your shade farms while the app is closed, spends level-up points on five combat stats, climbs an arena ladder, trades on a player market and hunts other shades in PK. Every fight you can watch runs in the Underworld Duel sim and renderer (`hades/sim.js`, `hades/render.js`).

Stack, as you chose on 2026-11-28:

- **Version 1:** a React + Vite + TypeScript PWA. Saves and accounts stay on the device, and there is no server.
- **Version 2:** a Spring Boot API and a PostgreSQL database, hosted on your own machine. The React app moves onto it.

Every number below was computed with a scratch model (`numbers.js` in the session scratchpad). Milestone 3 turns it into `idle/src/rules/` with tests.

## 1. Setting and names

The mechanics follow classic browser RPGs. The names, world, items and wording are original.

| Mechanic | In the game | Notes |
| --- | --- | --- |
| Game | **Ash & Obol** | No game by this name came up in a search. It echoes Salt & Sand. |
| Player character | a **shade** | You died on the sand. The Ferryman will row you back to the living for a fortune in obols. |
| Gold | **obols** | This plan says "gold" for clarity. |
| Hub | **Lanternfall**, a town of lamps on the black river | The menu screens. |
| PvE zones | **Drowned Temple**, **Molten Forge**, **Elysian Garden** | The three Underworld Duel maps. |
| PK ground | **the Gloam** | The open dark between the zones. |
| Daily PK attacks | **grudges**, 4 a day | The brief's "PK points". |
| Skull | **Bloodmark**, 12 hours | |
| PK highscore | **Infamy** | The brief's "PK points" board. |
| Safe bank | **the Vault** | |
| NPC shop | **the Sutler** | A sutler sold supplies to soldiers in camp. |
| Player market | **the Ledger**, kept by the Tollkeepers | Buy and sell orders, with a 3% toll. |
| Arena | **the Pale Coliseum** | NPC ladder of six tiers. |
| 2v2 partner | your **Sworn** companion | |
| Stat reset | **Draught of Lethe** | Lethe, the river of forgetting, in Greek myth. |

**Gear tiers** (level needed): 1 Bronze (1), 2 Iron (10), 3 Grave-steel (20), 4 Obsidian (30), 5 Ember-forged (45), 6 Styx-tempered (60), 7 Nightglass (75), 8 Lantern-gold (90).

Each item is a sim gear type plus a tier, so an Ember-forged falx is `falx@5`. Tiers change only the numbers, so every weapon keeps its look, reach and timing.

**PvE enemies** reuse the sim's humanoid kits under their own names and a cold, pale palette baked once per kit:

| Enemy | Kit | Levels |
| --- | --- | --- |
| Restless Shade | raider | 1–8 |
| Bone Archer | huntress | 5–15 |
| Drowned Legionary | hoplite | 12–28 |
| Ember Cultist | emberpriest | 20–40 |
| Forge Thrall | breaker | 30–50 |
| Hollow Duelist | duelist | 40–60 |
| Frost Revenant | frostmage | 50–70 |
| Grave Warden | executioner | 60–85 |
| Storm Wraith | stormmage | 75–95 |
| Pit Champion | murmillo, sagittarius | 85–100 |

Beasts need new sprite art and are on the ideas list.

**Gore** follows the arena art direction in `AGENTS.md`. The renderer already does all of it: blood at the point of impact, stains on the sand, heavy blows that shift the body, and rare weapon-specific finishers on killing blows.

## 2. How comparable games do it

| System | Reference games | What we take | What we do differently |
| --- | --- | --- | --- |
| XP curve | Old School RuneScape: about 13M XP to level 99, with level 92 halfway there | A curve that grows faster than polynomial, so the last levels are a long climb | Our own formula (§3.1). Level 100 takes about 79 days of perfect 24/7 farming. |
| Hit chance | OSRS: attack roll against defence roll, piecewise; effective level × (bonus + 64) | Accuracy against evasion, with gear multipliers | A smooth ratio curve where equal ratings give 75%, so watched fights don't miss too often (§3.5) |
| Combat level | OSRS: ¼ × (Def + HP + ½ Prayer) + 0.325 × the best style | A level that counts only useful points | Point-buy based: points in a second or third damage stat count half (§3.8) |
| PK range | OSRS: you can attack combat level ± the wilderness level | A level bracket | XP and Infamy fall to zero against much weaker targets, and you can't attack below 2 brackets (§5) |
| Attack limit | Torn: an attack costs 25 of your energy, which regenerates | A capped resource for attacks | 4 grudges a day, refilled at a fixed reset time |
| Gold loss | Torn: a mugging takes about 5–15% of cash on hand; cash in the bank is safe | A share of carried gold, with a safe bank | 10% of the purse, capped by the victim's level. The Vault is safe but charges a 1% deposit fee (§5.6). |
| Skull | OSRS: attacking first skulls you and you lose more on death; Tibia: attacking a marked player is justified | A mark that raises your losses | Bloodmark for 12 h: you lose 2.5× as much and can't deposit; attacking a marked shade doesn't mark you (§5.5) |
| Daily caps | Shakes & Fidget: arena XP for 10 wins a day; no reward when the honor gap is too large | Rewards only against similar opponents | 4 grudges a day and the bracket XP factor (§5.3) |
| Market | OSRS: 2% seller tax capped at 5M, buy limits per 4 h, trades when a bid ≥ an ask; EVE: regional order books with broker fees and sales tax | A limit order book with a seller tax | Price-time priority, a 3% toll that is destroyed, a price band of ½× to 2× the guide price, and settlement in the Vault (§9) |
| Offline progress | Melvor Idle: capped (12 h in 2020; guides now say 18 h); Clicker Heroes: computed on return | Progress computed on return from timestamps | A 24 h cap, computed in chunks of whole kills between level-ups (§4) |

The mechanics are inspired by these games, but the names, wording and formulas are our own.

## 3. Levels, stats and combat numbers

Notation: `L` is character level (1–100), `t` is gear tier (1–8), and `A S D R M` are Attack, Strength, Defence, Ranged and Magic (1–99 each).

### 3.1 XP curve

```
xpToNext(L) = round10( 50 × L^2.1 × 1.02^L )          level cap 100
```

The curve was fitted so that farming an on-level monster (§4) takes these times:

| Level | XP to next | Total XP | Time for this level | Days of 24/7 farming to reach it |
| --- | --- | --- | --- | --- |
| 1 | 50 | 50 | 2 min | 0 |
| 5 | 1,620 | 3,410 | 27 min | 0 |
| 10 | 7,670 | 27,570 | 72 min | 0.2 |
| 20 | 40,100 | 256,000 | 3.2 h | 1.2 |
| 30 | 114,530 | 1,022,920 | 5.9 h | 3.1 |
| 40 | 255,450 | 2,875,930 | 9.5 h | 6.4 |
| 50 | 497,530 | 6,660,760 | 13.8 h | 11.3 |
| 60 | 889,400 | 13,643,170 | 19.3 h | 18.3 |
| 70 | 1,498,610 | 25,674,610 | 26.8 h | 28.0 |
| 80 | 2,418,090 | 45,415,410 | 35.6 h | 41.0 |
| 90 | 3,774,810 | 76,634,360 | 46.6 h | 58.5 |
| 99 | 5,510,880 | 118,867,220 | 61.8 h | 78.8 |

The pace is level 20 on day one, 40 in a week, 60 in under three weeks and 100 in about 79 days. Those times assume perfect farming with no breaks. With the 24 h offline cap, PK and arena breaks, a normal player should reach the cap in three to four months.

**Worked example:** `xpToNext(20) = 50 × 20^2.1 × 1.02^20 = 50 × 539.7 × 1.4859 = 40,099 → 40,100`.

### 3.2 Stat points

- All five stats start at 1. A new shade gets **8 points**, and every level adds **3 points**. Each stat is capped at **99**.
- Total at level `L`: `points(L) = 8 + 3 × (L − 1)`, which is 305 at level 100. Raising three stats to 99 takes 294 points, so you can max three stats but never all five. That keeps builds distinct: a tank, a glass cannon, an archer, a battle mage.
- A **Draught of Lethe** refunds every point. It costs `10 × L²` gold: 25,000 at level 50, or about 8 h of on-level farming.
- **Charms** (§7) add +2 to +6 to one stat. They count everywhere a stat counts.

### 3.3 Life

```
maxHP = 200 + 4 × L          (204 at level 1, 400 at 50, 600 at 100)
```

Level 10 gives 240 HP, close to the sim's current 230–285. HP grows at the same pace as damage, so an equal-level duel lasts about 25–28 s at every level (§3.10). That fits the sim's current median bout of 24 s.

### 3.4 Gear numbers per tier

```
powerBonus(t)  = 0.05 × (t − 1)      // +0 … +35% damage
accBonus(t)    = 0.04 × (t − 1)      // +0 … +28% accuracy
armorMul(t)    = 0.6 + 0.1 × t       // 0.7 … 1.4 times the sim armor/shield defense
value(t)       = round10(120 × 2.2^(t − 1)) × typeFactor   // 120 … 29,930 for a sword
```

Evasion by armor type (light armor dodges more): pelt +0.20, leather +0.15, robes +0.10, cuirass +0.05, plate 0, segmentata −0.05.

### 3.5 Hit chance: Attack against Defence

```
AR = (A + 8) × (1 + accBonus(weapon tier))
DR = (D + 8) × (1 + evasion(armor type))
p  = clamp( 1 / (1 + (DR / AR)^1.5 / 3), 0.05, 0.97 )
```

- Equal ratings give **75%**. Double the rating gives about 89%, and half gives about 51%.
- Attack is the accuracy stat for all three styles. Each style then needs its own damage stat (S, R or M), so every build pays two stats to deal damage.
- **A miss is a glance, not a whiff.** The blow still connects in the sim, for 25% damage and 50% stance damage, and shows the word "Glance". Watched fights never look like a sword passing through someone.

| Attacker | Defender | AR | DR | p |
| --- | --- | --- | --- | --- |
| A 31, Obsidian (t4) | D 31, leather | 43.7 | 44.9 | **0.74** |
| A 60, t5 | D 20, leather | 78.9 | 32.2 | 0.92 |
| A 20, t3 | D 60, leather | 30.2 | 78.2 | 0.42 |
| A 99, t8 | D 99, plate | 137.0 | 107.0 | 0.81 |

**Worked example:** `AR = 39 × 1.12 = 43.68`, `DR = 39 × 1.15 = 44.85`, `(44.85/43.68)^1.5 = 1.040`, so `p = 1/(1 + 0.347) = 0.742`.

### 3.6 Max hit per style

The sim's base weapon damage `W` comes from `hades/data.js` (sword 13, maul 31, crossbow 23, Ember Bolt 24, and so on). The sim rolls `W + random × 4`, which these formulas keep:

```
powerMul(stat, t) = (1 + (stat − 1) / 40) × (1 + powerBonus(t))
melee   max = round((W + 4) × powerMul(S, t))          min = round(W × powerMul(S, t))
ranged  max = round((W + 4) × powerMul(R, t))
magic   max = round((spell + 4) × powerMul(M, staff t)); heals and wards scale the same way
critical    × 1.28  (9% of blows, and every blow from behind, as the sim does now)
```

At stat 99 with Lantern-gold, damage is 3.45 × 1.35 = **4.66 times** the level-1 value.

**Worked example (S, R and M 31, Obsidian):**

| Weapon | Formula | Max hit | Min hit |
| --- | --- | --- | --- |
| Sword | (13+4) × 1.75 × 1.15 | **34** | 26 |
| War maul | 35 × 2.0125 | 70 | |
| Crossbow | 27 × 2.0125 | 54 | |
| Ember Bolt | 28 × 2.0125 | 56 | |

The maul swings slowly and the crossbow reloads, so damage per second stays close across weapons. The sim's timing already balances them.

### 3.7 Damage reduction

```
Armor   = (armor.defense + (shield up ? shield.defense : 0)) × armorMul(t) + 0.4 × D
taken   = 100 / (100 + Armor)                 magic and armor-piercing hits use Armor / 2
damage  = roll × powerMul × taken × armor.taken[style] × crit × glance
```

`armor.defense` and `shield.defense` are the sim's own numbers (plate 12, leather 7; round shield 20, tower 34). `armor.taken[style]` is the sim's triangle (plate takes 0.88× from arrows, 1.10× from magic). It stays on top of the formula.

**Worked example:**
- Leather and a round shield at Obsidian with D 31 give `(7 + 20) × 1.0 + 12.4 = 39.4` Armor, so 72% of each blow gets through.
- Lantern-gold plate and a tower shield at D 99 give `46 × 1.4 + 39.6 = 104` Armor, so 49% gets through.
- Taking the shield off, or swapping to a two-handed weapon, drops the shield's part at once. The sim already tracks whether the shield is up.

### 3.8 Combat level

```
Pmax = max(S, R, M)      Poff = S + R + M − Pmax
CL   = max(1, floor((A + D + Pmax + Poff / 2) / 3))
```

A focused build has a CL about equal to its level, a hybrid that splits damage stats comes out lower, and the highest possible CL is 101.

| Build | A | D | S | R | M | CL |
| --- | --- | --- | --- | --- | --- | --- |
| New shade | 5 | 1 | 5 | 1 | 1 | 4 |
| Level 60, balanced melee | 62 | 62 | 62 | 1 | 3 | **62** |
| Level 60, glass cannon | 92 | 1 | 92 | 1 | 4 | 62 |
| Level 60, three-style hybrid | 40 | 40 | 40 | 40 | 30 | 51 |
| Level 100, maxed melee | 99 | 99 | 99 | 7 | 6 | 101 |

**Worked example:** the balanced melee build gives `(62 + 62 + 62 + (1 + 3)/2)/3 = 188/3 = 62.7`, so **62**.

The glass cannon and the tank spent the same points, so they share a bracket. The hybrid's crossbow backup does help in the sim, which is why its extra damage stats count half rather than zero.

### 3.9 How the stats map onto the Underworld Duel sim

A fighter entry gains an optional `stats` block, computed by `rules/build.ts` from the save:

```js
{ kit: 'duelist', weapon: 'sword', reserve: 'crossbow', shield: 'round', armor: 'leather',
  stats: { hp: 320, ar: 43.7, dr: 44.9, d: 31, armorTier: 4, shieldTier: 4,
           power: { melee: 2.01, ranged: 1.15, magic: 1.15 }, stanceMul: 1.2, mana: 70 } }
```

| RPG number | Sim value it changes | Where in `hades/sim.js` |
| --- | --- | --- |
| `maxHP = 200 + 4L` | `hp`, `maxHP` (replaces the kit's hp) | `createFighter` |
| Attack and weapon tier (`ar`) | New hit roll: a glance does 25% damage and 50% stance | `strike`, before the block check |
| Defence and armor evasion (`dr`) | The same roll | `strike` |
| Strength (`power.melee`) | Damage of melee blows, second attacks, bashes and kicks | `landBlow` → `strike` |
| Strength (`stanceMul`) | Stance damage dealt × (1 + (S−1)/150), so heavy hitters stagger sooner | `addStance` |
| Ranged (`power.ranged`) | Bolt damage; stance damage × (1 + (R−1)/300) | `stepProjectiles` |
| Magic (`power.magic`) | Spell damage, heal and ward | `stepProjectiles`, `applySupport` |
| Magic | Mana pool `70 + M/2` | `createFighter` |
| Defence and gear (`d`, tiers) | `taken = 100/(100 + Armor)` replaces `absorption` | `strike` |
| Defence | `stanceLimit(f) + 0.3 × D` | `stanceLimit` |
| Gear tier | Only the numbers above. Reach, timing, energy, movement and AI stay the sim's own. | |

Three rules for the sim change:

1. **Without `stats`, the sim stays bit-identical.** The new roll only calls `duel.random()` when both fighters have `stats`. A test checks that `tools/hades-balance.js` prints the same output before and after the change, so the 2v2 game is unaffected.
2. **Calibration.** A headless test runs 40 equal-level bouts at levels 1, 25, 50, 75 and 100. Each set's median length must fall between 18 and 40 s. A level `L+10` shade must beat a level `L` shade at least 75% of the time. The sim's mean time to kill must land within ±30% of the formula's.
3. **The engagement factor of 0.5 is measured, not assumed.** The formula assumes a fighter swings for half of the bout. Milestone 4 measures that share in the sim and updates `ENGAGE` in the rules.

### 3.10 Worked duel: two level-30 shades

Both shades have A, S and D at 31, an Obsidian sword, a round shield and leather. Each swing does:

```
average roll = (13 + 2) × 1.75 × 1.15 = 30.2
× hit share (0.742 + 0.25 × 0.258 = 0.807)
× taken 0.717
× crit 1.025
= 17.9 per swing
```

The sword's cycle is 0.30 + 0.10 + 0.34 = 0.74 s. Half of each bout is spent swinging, so DPS is 17.9 / 0.74 × 0.5 = **12.1**, and each shade has 320 HP. The bout lasts about **26 s**. The model gives 28 s at level 1, 26 s at 50 and 26 s at 100.

## 4. AFK farming and offline progress

**Activities:** fight one enemy type in a zone, or rest. Gathering and crafting skills are on the ideas list.

**Monster model:** an enemy of level `e` has 60% of a player's HP, stats of `e`, gear one tier below what that level allows, and the kit's weapon.

```
ttk    = monsterHP / myDPS                     (formula from §3, no sim)
hurt   = theirDPS × ttk                        damage taken per kill
rest   = hurt / (3% of maxHP per second)       shades heal between fights
cycle  = ttk + 3 s loot + rest
xpKill = round(10 + 4e + 0.04e²)       goldKill = 1 + floor(e/2), rolled ×0.5–1.5
```

An enemy whose `hurt` exceeds 75% of your HP is marked **too dangerous** and can't be farmed. Wins against it are uncertain, so it's left to fights you watch.

**The sweet spot is broad.** For a balanced level-50 shade (A, S and D at 53, Ember-forged gear):

| Enemy level | HP | Time to kill | Damage taken | Cycle | Kills/h | XP/kill | XP/h | Gold/h |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 20 | 168 | 7.2 s | 45 | 13.9 s | 260 | 106 | 27,500 | 2,860 |
| 40 | 216 | 10.7 s | 119 | 23.6 s | 152 | 234 | 35,700 | 3,200 |
| 50 | 240 | 12.9 s | 181 | 30.9 s | 116 | 310 | 36,100 | 3,020 |
| 60 | 264 | 15.3 s | 262 | 40.2 s | 90 | 394 | 35,300 | 2,780 |
| 65 | 276 | 16.6 s | 303 | 44.9 s | 80 | 439 | (too dangerous: 303 > 300) | |

XP per hour stays flat from 10 levels under you to 10 levels over, and gold per hour peaks a little below your level. Your choice of enemy comes down to its drops and how quickly you want to see it die.

**Offline progress (runs on return):**

```
elapsed = clamp(now − lastSeen, 0, 24 h)            negative (clock moved back) → 0, lastSeen = now
rng     = seeded(hash(saveSeed, lastSeen))           a reload repeats the same result
repeat:
  cycle = cycle(build at current level, enemy)
  n     = min(floor((elapsed + carry) / cycle), killsToNextLevel)
  xp   += n × xpKill;  gold → purse += Σ rolled gold;  drops ~ Binomial(n, p) per drop line
  elapsed −= n × cycle;  on level-up: +3 unspent points, +4 maxHP, recompute cycle
until no whole kill fits; carry the remainder
```

Points earned offline stay unspent until you allocate them, unless you set an auto-allocate preset (on the ideas list). Loot that doesn't fit in the pack is sold to the Sutler at 40% and listed in the return summary. PK attacks on you while you were away are applied in time order, using your purse at that moment (§5.8).

**Worked example (8 h away at level 20, Drowned Legionaries at level 20):**

- **Kill cycle:** the shade has A, S and D at 23 with Grave-steel gear (sword max 29). Each Legionary takes 13.1 s to kill and deals 121 damage, which takes 14.4 s of rest. Adding 3 s of loot gives a **30.6 s cycle**, about 118 kills an hour.
- **Kills, XP and gold:** 28,800 s / 30.6 gives **941 kills**. They give 941 × 106 = **99,700 XP** and about 941 × 11 = **10,350 gold** into the purse.
- **Levels:** level 20 needs 40,100 XP and level 21 needs 45,310. The shade reaches **level 22** with 14,300 XP toward 23 and gains **6 unspent points**.
- **Drops:** each kill has these chances; each line is drawn once from a binomial:

  | Drop | Chance per kill | Expected in 941 kills |
  | --- | --- | --- |
  | Grave-steel scrap (a material for later crafting) | 1/8 | about 118 |
  | Iron gear | 1/60 | 16 |
  | Grave-steel gear | 1/250 | 4 |
  | Legion signet, a +3 Defence charm | 1/2000 | about 0.5 |

## 5. PK in the Gloam

### 5.1 Grudges

- Each shade has **4 grudges** (PK attacks), and an attack costs one.
- At the daily reset they **refill to 4**. Unused grudges don't carry over.
- **The reset is 00:00 UTC:** 01:00 in CET and 02:00 in CEST. It's the same moment for everyone, which matters once the world is shared.
- The refill is computed lazily: `if (grudgeDay < todayUTC) { grudges = 4; grudgeDay = todayUTC }`. No timer is needed on the device or the server.

### 5.2 Fights

- Every PK fight runs in the sim with both sides under AI control. The result is a bout you can watch, stored as a seed plus both builds.
- **1v1:** your build against theirs.
- **2v2:** you and your **Sworn** companion against the target and theirs. A Sworn is an NPC you pick in the Pale Coliseum: any sim kit, at your CL − 5, with gear one tier below yours. Bots have one too.
- Both modes cost one grudge.
- **Maps:** each attack takes the zone the target is farming in, so the Drowned Temple, the Molten Forge or the Elysian Garden.

### 5.3 Level brackets and XP

```
B       = max(4, round(CL / 10))             bracket width: 4 at CL 1–44, 5 at 45–54, … 10 at 100
Δ       = targetCL − yourCL
allowed : Δ ≥ −2B (and the target is not protected); attacking up is always allowed
factor  = clamp(1 + Δ / (2B), 0, 1.5)
XP      = 10% × xpToNext(targetCL) × factor
Infamy  = round(10 × factor) per win, +3 per attack you beat off as defender
```

**At CL 50 (B = 5):**

| Target CL | Δ | Factor | XP | Infamy |
| --- | --- | --- | --- | --- |
| 60 | +10 | 1.5 (capped) | 133,000 | 15 |
| 55 | +5 | 1.5 | 100,700 | 15 |
| 50 | 0 | 1.0 | 49,750 | 10 |
| 48 | −2 | 0.8 | 35,100 | 8 |
| 45 | −5 | 0.5 | 18,000 | 5 |
| 40 | −10 | 0 | 0 | 0 |
| below 40 | | can't attack | | |

**What this is worth:** a win against an equal gives about 1.4 h of farming XP, so four wins a day add about 5.5 h. That's a solid bonus, not a replacement for farming. Farming much weaker shades gives no XP and no Infamy, and you can't attack below two brackets at all.

### 5.4 Gold taken

```
taken from the victim's purse = min(rate × purse, cap × victimCL)
  normal: rate 10%, cap 100        Bloodmarked victim: rate 25%, cap 250  (2.5×)
failed attack: the defender takes min(5% × attacker's purse, 100 × attacker CL)
```

The purse is the gold you carry. Gold in the Vault can't be taken.

**Worked examples:**
- A level-48 victim farmed for 12 h and carries 35,000. A normal loss takes min(3,500, 4,800) = **3,500**.
- If that victim is Bloodmarked, the loss is min(8,750, 12,000) = **8,750**.
- A full day's purse at level 50 is about 72,600, and the cap holds the loss to **5,000**.

### 5.5 Bloodmark (the skull)

- **Duration:** attacking another shade marks you for **12 hours**, and every further attack resets the timer to 12 h.
- **Loss multiplier:** while marked, you lose **2.5×** as much gold when attacked (§5.4).
- **Second penalty:** **the Vault refuses deposits from a marked shade**, so what you carry stays at risk until the mark fades.
- **Hunting marked shades is free:** attacking a marked shade doesn't mark you. Marked shades also show first in target lists, so they draw hunters.
- **Marked defenders are still fair game:** winning a defence while marked doesn't clear the mark.

### 5.6 Protections

- **New shades:** a shade is protected for its first **72 hours**, and always while below **CL 10**. A protected shade can't be attacked or attack. Attacking ends the 72-hour part early.
- **Loss cap:** a loss takes at most 10% of the purse, capped at 100 × CL (§5.4).
- **The safe Vault:**
  - Items in the Vault are never at risk.
  - Gold deposits cost **1%** (minimum 1), and withdrawals are free.
  - The fee pulls gold out of the economy and makes carrying gold a choice.
  - Farmed gold always lands in the purse; there's no auto-deposit. Banking is something you do on your daily visit.

### 5.7 Arena and PvE aren't PK

Arena and PvE losses cost nothing and never mark you.

### 5.8 Bots attacking you

Bots spend grudges too: each bot uses `4 × aggression` a day on average, with aggression between 0 and 1. A bot picks targets in range, weighted by `purse × (marked ? 3 : 1)`. In a bracket of about 20 shades, expect about **1 attack a day while you're unmarked and 2–3 while marked**.

Attacks while you're away run in the sim at that moment (about 7 ms each). They're applied in time order and listed on return with a **Watch** button; the last 10 are kept. For example: *03:12 — Orsk Lanternless (CL 21) beat you and took 410 obols. Watch.*

## 6. The Pale Coliseum (arena ladder)

The ladder has six tiers of five named NPC gladiators each. You climb one rung at a time.

| Tier | Levels | Final rung |
| --- | --- | --- |
| Bone Pit | 2–10 | a Restless Shade captain |
| Iron Ring | 13–25 | |
| Marble Sands | 29–45 | |
| Obsidian Court | 50–66 | |
| Gilded Hall | 70–90 | |
| Pale Crown | 92–100 | Varro and Cassian, the Underworld Duel champions, with their painted sprites |

- **Opponents:** each NPC is built like a player of that level with on-level gear, plus 5% to every stat as the house edge. Each tier mixes kits so every style gets tested.
- **First clear:** 50 × NPC level in gold and arena marks equal to the tier number. Each tier's final rung also gives a guaranteed item of that tier.
- **Repeats:** the first three repeat wins each day pay 25% of the first-clear gold.
- **Marks** buy charms from the arena quartermaster.
- **Losses** cost nothing: no gold, no Bloodmark. Each attempt draws its seed from the save, so reloading doesn't reroll a fight.
- **Sworn:** you recruit your companion here. 2v2 arena tiers are on the ideas list.

## 7. Inventory and equipment

- **Pack:** 32 slots. Materials, potions and marks stack to 999 per slot. Gear takes one slot each.
- **Vault:** 200 slots, and everything stacks. Identical gear (`falx@5`) stacks because items have no random rolls in version 1.
- **Equipment:** main weapon, backup weapon, shield, armor and a charm. These are the four slots the sim knows, plus a charm.
  - A two-handed main weapon lowers the shield, as the sim already does.
  - A staff without a spellbook gets the Ember Priest's book, as the sim already does.
- **Equip rules:** gear needs its tier's level (§1).
- **Item keys:** `type@tier` for gear, plain keys for the rest (`scrap.grave`, `charm.legion`).

## 8. The Sutler (NPC shop)

- **Sells:** tier 1–3 gear and basics at their value (§3.4), five of each, restocked at the daily reset. Tier 4 and up come only from drops, the arena and the Ledger, which gives the market demand.
- **Buys:** anything at **40%** of its value. That sets a price floor on the Ledger, since nobody sells there below 40%.

**Gear value and hours of on-level gold:**

| Tier | Level | Sword value | Gold/h at that level | Hours per item |
| --- | --- | --- | --- | --- |
| 1 | 1 | 120 | 119 | 1.0 (a starter set is free) |
| 3 | 20 | 580 | 1,295 | 0.4 |
| 5 | 45 | 2,810 | 2,698 | 1.0 |
| 6 | 60 | 6,180 | 3,628 | 1.7 |
| 8 | 90 | 29,930 | 5,375 | 5.6 |

A full Lantern-gold set (four items) costs about a day of gold, so the final upgrade feels earned.

## 9. The Ledger (player market)

- **Orders:**
  - An order is buy or sell, with an item key, a quantity and a whole-number limit price.
  - You can hold up to **8 open orders**, and orders expire after **7 days**.
  - A buy order locks its gold from the Vault when it's placed. A sell order locks its items.
- **Matching:**
  - Orders match by **price, then time**: a new order fills against the best resting orders first, and among equal prices the oldest goes first.
  - **The trade happens at the resting order's price**, so the newer order gets the better price.
  - Orders can fill partly, and the remainder rests on the book.
- **Toll:** **3% of the seller's proceeds**, rounded down. Sales under 34 gold pay nothing. The toll is destroyed, which makes it the game's main gold sink.
- **Price band:**
  - Orders must sit between **½× and 2× the guide price**. That blocks dumping an item to an alt for 1 gold and stops bots from spiking prices.
  - The guide price is the median of the last 20 trades in 48 h, or the item's value when there are none.
- **Settlement** goes to the Vault, safe from PK. A marked shade can still sell, and pays the toll for it.

**Worked example:** you sell 10 Ember-forged swords (`sword@5`, value 2,810) at **2,700**. The guide price is 2,810, so the band is 1,405–5,620. The book holds these buy orders:

| Buyer | Quantity | Price | Placed |
| --- | --- | --- | --- |
| Varn | 3 | 2,850 | 10:02 |
| Ilsa | 5 | 2,760 | 10:40 |
| Brug | 4 | 2,600 | 09:15 |

1. 3 fill at **2,850**, Varn's price: 8,550.
2. 5 fill at **2,760**: 13,800.
3. Brug's 2,600 is below your 2,700, so it doesn't match. Your last **2 rest** on the book as a sell order at 2,700.
4. Gross 22,350, toll 3% = **670**, **21,680** into your Vault. The 670 is destroyed.

## 10. Bots: a world that's already busy

- **Population:** 240 bot shades. The world "opened" 120 days before you registered.
- **Each bot:**
  - **Name:** from an original syllable list, such as Orsk Lanternless, Mirelle of the Reeds, Tavo Ninefingers, Senna Ashveil, Brug the Unburied or Ilka Coldwake.
  - **Join time:** at some point in those 120 days.
  - **Diligence:** `e`, the share of perfect farming it gets. Hardcore bots (10%) have `e` from 0.8 to 1.0, regulars (40%) 0.4–0.8 and casuals (50%) 0.1–0.4.
  - **Archetype:** balanced melee 30%, tank 15%, glass cannon 10%, archer 20%, mage 20%, hybrid 5%. Each maps to a sim kit and a stat split.
  - **Aggression and a trading temperament.**
- **Progress over time needs no ticking.** A bot's level at any moment comes from `hours = e × (now − joined)`, read off the same cumulative-hours table that drives §3.1.
  - **Worked example:** a regular who joined 40 days ago with `e = 0.6` has 576 h of perfect farming. That's 24 days on the table, so **level 67**.
- **Gear:** a bot equips the best tier for its level 70% of the time, and one tier lower otherwise.
- **Purse:** a bot banks once a day at its own hour, so its purse is `goldPerHour × hours since its bank time`. That gives PK realistic targets.
- **PK between bots:** resolved by formula (win chance from the two DPS-to-HP ratios), not the sim, which is cheap. Bots gain Infamy, so the board moves.
- **Market making:** for each tradable item, bots keep 3–6 buy orders at 92–98% of the guide price and 3–6 sell orders at 102–110%. They refresh every game hour, simulated in chunks on return, up to 24 h.
  - Bots' stock comes from their simulated drops (drop rates × hours), and their demand from upgrading gear at level gates. Supply and demand follow the same rules as yours.

## 11. Highscores

- **The boards:**
  - **Overall:** CL, then total XP.
  - **One per stat:** Attack, Strength, Defence, Ranged and Magic, ranked by stat level, then total XP.
  - **Infamy:** the PK points board.
  - **Coliseum:** highest rung, then the date reached.
- **Bots** are on every board, so a new shade starts near the bottom of a living list. Your own row is pinned at the bottom of each board.

## 12. Accounts and saves (version 1, on the device)

- **Storage:** an IndexedDB database `ash-and-obol` with two stores: `accounts` (name, salt, hash, iterations, created) and `saves` (name → state).
- **Password:** hashed with WebCrypto **PBKDF2-SHA256, 600,000 iterations** (the OWASP 2023 figure) and a 16-byte random salt. That takes about 0.3–1 s on a phone at login.
- **"Stay signed in"** remembers the last account in `localStorage`.
- **Plain warning in the UI and README:**

  > Accounts live only on this device. The password keeps a casual visitor out of your save on a shared device. It isn't real security: anyone holding the device can read or change the save. Real accounts come with the server.

- **Export and import code:** `AO1.` + base64url(JSON) + a CRC32 checksum. The checksum catches typos, not cheating. Moving to version 2 will import this code.

## 13. Version 1 build: React + Vite + TypeScript PWA

```
idle/                      the new game (Vite root)
  index.html  vite.config.ts  package.json  tsconfig.json
  public/  manifest.webmanifest  icons/  (service worker built by the Vite PWA plugin or hand-written)
  src/rules/*.ts           pure rules: no DOM, no React; the source of truth that v2 ports to Java
  src/state/               save, IndexedDB, offline catch-up, bots
  src/ui/                  React screens: Lanternfall hub, zones, Coliseum, Gloam, Ledger, Sutler, Vault, Highscores
  src/fight/FightView.tsx  mounts the Underworld Duel renderer
  tests/*.test.ts          node --test (Node 25 runs TypeScript directly)
hades/                     the Underworld Duel sim and renderer, shared and unchanged except §3.9
```

- **The sim stays plain JS.** `hades/*.js` load as classic scripts (`HadesData`, `HadesSim`, `HadesRender` globals), copied in by Vite's static folder. The 2v2 game and the idle game run the same files.
- **`FightView`:**
  - It calls `HadesRender.init(canvas)` once per page, because `init` adds a resize listener. It steps `HadesSim` and calls `HadesRender.draw` on each animation frame.
  - It's paused while the tab is hidden.
  - Sprites are baked once and kept, and React never re-renders the canvas.
- **Responsive:** one column on a phone, a sidebar on a laptop.
- **Installable and offline:** a manifest, a service worker that precaches the build, and icons drawn for this game from the Salt & Sand recipe (an SVG plus 180, 192 and 512 PNGs).
- **Tests** (`node --test idle/tests`):
  - **Rules:** the XP curve, points, combat level, hit chance bounds, max hit and damage reduction, the PK reset at 00:00 UTC, the Bloodmark timer and multiplier, bracket XP, protection, gold-loss caps, market matching (price-time, partial fills, toll, band, escrow), offline progress (cap, level-ups mid-session, determinism by seed, clock moved back), stacking and the shop.
  - **Fight checks:** a headless check that 200 seeded bouts all end and that the stats scale (§3.9).
  - **Other:** the Salt & Sand install test, adapted, and the `hades-balance` bit-identical check.
  - **Golden vectors:** tests also write `idle/tests/vectors.json`, inputs with their outputs, which the Java port replays in version 2.
- **Publishing:** the Pages workflow gains a job step that builds the idle branch (`npm ci && npm run build`) and copies `dist/` to `/idle/`. I'll show you that diff before pushing it. This is separate from retiring the old games, which is still waiting for your yes.
- **`AGENTS.md`:** the "no build step" rule changes, as you agreed. The idle game builds with `npm run build`, and the 2v2 game stays build-free.

## 14. Version 2 backend: Spring Boot + Postgres on your machine

### 14.1 Comparison

| | Supabase | Firebase | PocketBase | Cloudflare Workers + D1 + Durable Objects | Nakama | **Spring Boot + Postgres, self-hosted (your choice)** |
| --- | --- | --- | --- | --- | --- | --- |
| Auth | Built in (email, OAuth), 50k MAU free | Built in, the most polished | Built in (email, OAuth) | None built in: a library, or your own (Workers cap PBKDF2 at 100k iterations) | Built in (device, email, social) | Spring Security sessions with an Argon2 or BCrypt encoder: yours to run and patch |
| Server-run fights (anti-cheat) | Edge Functions are Deno on V8, so `sim.js` runs as is | Cloud Functions (Node) run `sim.js`, but need the paid Blaze plan | JS hooks run on goja: most of ES6, synchronous, CommonJS. The sim's syntax would need checking or transpiling | Workers are V8, so `sim.js` runs unchanged | Authoritative matches in its TypeScript runtime (goja) | GraalJS runs `sim.js` inside the JVM, or a small Node sidecar does (§14.3) |
| Market | Postgres transactions and row locks: strong | Firestore transactions are optimistic, and one hot order-book document contends | SQLite transactions, single writer: simple and consistent | One Durable Object per order book, single-threaded: ideal | Custom storage and RPC | Postgres transaction with an advisory lock per item: strong (§14.2) |
| Highscores | SQL with indexes and views | Indexed `orderBy` queries; no SQL ranks | SQL on SQLite | D1 (SQLite) with indexes | Built-in leaderboards and tournaments | SQL `rank() over (...)`, indexes, a materialized view refreshed every few minutes |
| Daily PK reset | Lazy in SQL, or pg_cron | Lazy, or Cloud Scheduler (Blaze) | Lazy, or cron in hooks | Lazy, or Cron Triggers | Leaderboard reset schedules built in | Lazy refill in SQL, plus `@Scheduled` jobs for bots |
| Cost and free tier | Free: 500 MB database, 50k MAU, 5 GB egress, but **pauses after a week without activity**. Pro $25/month | Spark free: about 50k reads and 20k writes a day. Functions need Blaze (pay as you go) | Free software; you host it (a single binary) | Free: 100k requests/day; D1 5M rows read and 100k written a day, 5 GB; SQLite Durable Objects included. Paid $5/month | Free software (Apache-2.0); Heroic Cloud is about $600/month | Free software. You pay for your machine's power, plus an optional domain at about €10 a year |
| Fits your React + Spring + Postgres wish | It is Postgres: Spring can use it as a managed database | No (not SQL) | No (SQLite, Go) | No (not self-hosted, no Spring) | Partly (Postgres, but Go/TS servers) | **Yes** |

**Recommendation:** Spring Boot 3 on Java 21 with PostgreSQL 16, self-hosted with Docker Compose. Postgres gives the market real transactions and the highscores real SQL. The lazy timestamp rules mean nothing breaks while the machine sleeps. If you ever stop hosting it yourself, point the same Spring app at a managed Postgres such as Supabase or Neon; the schema moves as is.

### 14.2 Design

- **Rules in Java:**
  - Rules are ported from `idle/src/rules/*.ts`. A JUnit suite replays `vectors.json` from the TypeScript tests, so the two versions can't drift.
  - The server is authoritative for XP, gold, PK, the market and bots. The client computes the same numbers only for previews.
- **Tables:**
  - `accounts(id, name, pass_hash, created_at)`
  - `shades(account_id, is_bot, level, xp, a, s, d, r, m, purse, vault_gold, skull_until, protected_until, grudges, grudge_day, activity, activity_since, infamy, …)`
  - `items(owner, place, slot, item_key, qty)`
  - `orders(id, owner, item_key, side, price, qty_open, created_at, expires_at)`, indexed on `(item_key, side, price, created_at) where qty_open > 0`
  - `trades(…)`
  - `fights(id, kind, seed, sim_version, lineup jsonb, winner, length, at)`
  - `pk_log(…)`
- **Market matching:** one transaction per order.
  1. `select pg_advisory_xact_lock(hashtext(item_key))`
  2. Read the opposite side `order by price, created_at for update`
  3. Insert the trades, update the orders, move gold and items between Vaults, and destroy the toll.
- **Offline progress** runs on the server when a request arrives, with the same chunked algorithm as §4, so the phone can't fast-forward its clock.
- **Migration from version 1:** paste your `AO1.` save code once while signed in. The server checks and clamps it (levels against XP, gold against plausible earnings) before accepting it.

### 14.3 Fights, determinism and GraalJS

- **How a server fight works:** the server picks the seed, runs `hades/sim.js` and stores the seed, sim version, lineup and result. The client downloads the seed and lineup and replays the bout locally with the same file.
- **The engine problem:**
  - A replay only matches exactly if every engine computes the same floating-point numbers.
  - `+ − × ÷` and `Math.sqrt` are exact everywhere.
  - `Math.sin`, `cos`, `atan2`, `hypot`, `exp` and `pow` aren't guaranteed to match across V8 (Chrome, Node), JavaScriptCore (Safari, every iPhone browser) and GraalJS.
- **The fix:** milestone B1 swaps those calls in the sim for deterministic versions built only from exact operations. A test checks that a set of seeds gives identical results in Node, Chrome, Safari and GraalJS.
- **Fallback:** the client always shows the server's winner. If its replay ends differently, it plays the server's recorded event stream instead.
- **GraalJS speed:** it compiles to fast code on a GraalVM JDK (Community Edition is free). A stock OpenJDK may run it interpreted, which is far slower.
  - A bout takes about 7 ms in V8. If a GraalJS bout takes over 100 ms, a Node sidecar container runs the same `sim.js` behind a local HTTP call instead.

### 14.4 Hosting on your own machine

- **`docker-compose.yml`:**
  - `db`: postgres:16, with a volume.
  - `api`: the Spring Boot jar on a GraalVM JDK 21 image.
  - `web`: Caddy serves the React build and proxies `/api` to Spring.
- **Reaching it from your phone needs HTTPS.** Service workers and installing the app need a secure origin unless the page is on `localhost`, so `http://192.168.x.x` won't do. Two free options:
  - **Tailscale (start here):** `tailscale serve` gives you `https://<machine>.<tailnet>.ts.net` with a real certificate, reachable only from your own devices.
  - **Cloudflare Tunnel (for friends):** a public HTTPS address on a domain you add to Cloudflare, with no open ports on your router.
- **When the machine sleeps,** nobody can play, but nothing is lost. Offline progress, grudges and bots all catch up from timestamps when it wakes. For a world that's always on, use a mini PC or a Raspberry Pi 5 (about 5 W).
- **Backups:** a nightly `pg_dump` to another disk, with a restore rehearsed once.

## 15. Milestones and token estimates

Version 1 runs on your phone and laptop with no server. Every milestone ends in a playable, tested commit.

| # | Milestone | What you can try | Est. tokens |
| --- | --- | --- | --- |
| 0 | Retire Salt & Sand, Arena Ledger and the first Underworld Duel (waiting for your yes) | The links page at `/` | 10k |
| 1 | Skeleton | The React + Vite + TS app at `/idle/` installs, works offline and opens on a phone. `node --test` runs, and `AGENTS.md` gets the build rule | 45k |
| 2 | Accounts and saves | Register, log in and out, export and import a save code | 30k |
| 3 | Rules core and items | Level up and spend points, see max hit, hit chance, Armor and CL; pack, Vault, equipment and the Sutler | 60k |
| 4 | Fights | `stats` in the sim (bit-identical without them), build → fighter, Glance, `FightView`; watch a PvE bout to the end; headless scaling check | 70k |
| 5 | AFK farming and offline progress | Pick an enemy, close the app, come back to XP, gold, drops and level-ups | 45k |
| 6 | Bots and highscores | 240 shades with levels and gear; boards for overall, each stat, Infamy and the Coliseum | 45k |
| 7 | Pale Coliseum and Sworn | The ladder with rewards; recruit a companion | 40k |
| 8 | PK | Grudges, the daily reset, Bloodmark, protections, gold loss, brackets, 1v1 and 2v2, bot attacks while you're away with Watch | 70k |
| 9 | The Ledger | Buy and sell orders, matching, toll, price band, escrow, bot market makers | 70k |
| 10 | Polish and phone pass | Layout on phone and laptop, frame rate during fights, README | 35k |
| | **Version 1 total** | | **≈ 520k** |

Version 2 moves to Spring Boot and Postgres on your machine.

| # | Milestone | Est. tokens |
| --- | --- | --- |
| B1 | Deterministic sim math, plus a cross-engine seed test | 35k |
| B2 | Spring Boot skeleton, Docker Compose (Postgres, Caddy), Flyway schema, Testcontainers | 50k |
| B3 | Accounts with Spring Security; import of `AO1.` saves | 40k |
| B4 | Rules ported to Java, checked against `vectors.json` | 80k |
| B5 | Fights run on the server via GraalJS or a Node sidecar; replay API | 45k |
| B6 | Market matching in Postgres; bots on `@Scheduled` | 60k |
| B7 | Highscores, daily resets, and the React client switched to the API with offline-first sync | 60k |
| B8 | Hosting runbook: Tailscale or Cloudflare Tunnel HTTPS, backups, updates | 25k |
| | **Version 2 total** | **≈ 395k** |

## 16. More ideas, ranked

These are also in `ideas.md` under *Ash & Obol*. Score is impact (1–5) per 10k estimated tokens.

| Idea | Impact | Est. tokens | Score |
| --- | --- | --- | --- |
| Auto-allocate presets for points earned offline (melee, tank, archer, mage) | 2 | 4k | 5.0 |
| Ferryman's Lantern: an upgrade that raises the offline cap from 24 h to 48 h | 2 | 5k | 4.0 |
| Daily login gift with a 7-day streak (obols, then a charm on day 7) | 3 | 8k | 3.8 |
| Shareable bout codes: a seed plus both builds, so anyone can watch a fight | 3 | 8k | 3.8 |
| Loadout presets: switch between a farming build and a PK build in one tap | 3 | 10k | 3.0 |
| Bout recap: damage by weapon, glances, blocks and stance breaks after each fight | 3 | 10k | 3.0 |
| Bounties: put obols on a marked shade's head; bots claim them too | 3 | 12k | 2.5 |
| Bet on Coliseum bouts between bots, with odds from 40 trial sims and a 20% house cut (salvaged from Salt & Sand) | 3 | 12k | 2.5 |
| Feats (achievements) with titles shown on the highscores | 3 | 15k | 2.0 |
| Seasonal Infamy board that resets monthly | 2 | 10k | 2.0 |
| Events: a Blood Moon weekend with double PK gold in the Gloam, or a Coliseum tournament | 4 | 25k | 1.6 |
| Ascension: pay the Ferryman to return to the living. You reset to level 1 for a permanent bonus | 4 | 25k | 1.6 |
| Push notifications (attacked, offline cap reached, order filled); needs the server | 3 | 20k | 1.5 |
| 2v2 Coliseum tiers with your Sworn | 3 | 20k | 1.5 |
| Grave-digging, a gathering skill: materials for crafting, with its own XP and highscore board | 4 | 35k | 1.1 |
| Forging, a crafting skill: turn materials into gear, a market supply line | 5 | 45k | 1.1 |
| Quests: short story chains with fixed watched fights and unique charms | 4 | 50k | 0.8 |
| Brotherhoods (clans) with shared Vault, clan PK wars and a clan board; needs the server | 4 | 60k | 0.7 |
| Beast enemies (ash hounds, wraiths, a three-headed gate dog) with new baked sprites | 4 | 60k | 0.7 |

## 17. Defaults I chose where the brief left it open

| Topic | Default |
| --- | --- |
| Name and setting | Ash & Obol. Shades in an underworld; obols for gold; in-world names in §1 |
| Daily PK reset | 00:00 UTC (01:00 CET, 02:00 CEST); grudges refill to 4, no carry-over |
| Level bracket | `B = max(4, round(CL/10))`. You can attack down to `CL − 2B`, and up without limit. XP factor `clamp(1 + Δ/(2B), 0, 1.5)` |
| PK rewards | XP = 10% of the target's `xpToNext` × factor. Infamy 10 × factor per win, +3 per successful defence |
| Gold loss | 10% of the purse, capped at 100 × victim CL. A failed attacker drops 5% to the defender, capped at 100 × attacker CL |
| Skull | 12 h Bloodmark, refreshed by each attack. Loss ×2.5 (25%, cap 250 × CL); no Vault deposits while marked; attacking a marked shade doesn't mark you |
| New-player protection | 72 h, and always below CL 10; attacking ends the 72-hour part early |
| Safe bank | The Vault: items always safe; 1% gold deposit fee; no auto-deposit |
| Offline cap | 24 h; loot that doesn't fit is sold to the Sutler at 40% |
| Progression | Level cap 100, stat cap 99; 8 starting points, +3 per level; HP 200 + 4L |
| Combat feel | A missed roll is a 25% glance, not a whiff; equal ratings hit 75% |
| Market | 3% seller toll, destroyed; price band ½×–2× guide; 8 open orders; 7-day expiry; settles in the Vault |
| Shop | Sells tiers 1–3, five of each, restocked daily; buys at 40% |
| Bots | 240 bots; the world is 120 days old when you register |
| Respec | Draught of Lethe, 10 × L² gold |
| 2v2 | You and a Sworn companion (CL − 5, gear one tier lower) against the target and theirs, for one grudge |
| Version 1 passwords | PBKDF2-SHA256, 600k iterations, labelled as not real security |

## 18. Waiting on you

- **Step 1:** you answered "Not yet" to retiring Salt & Sand, Arena Ledger and the first Underworld Duel from the site, so nothing has been tagged or pushed. Milestone 0 runs when you say yes.
- **Go-ahead:** I start building milestone 1 once you approve this plan.

## Sources

- Supabase pausing and free plan: https://supabase.com/kb/faqs/platform/free-project-pausing and https://github.com/orgs/supabase/discussions/33121
- Cloudflare Durable Objects free tier and pricing: https://developers.cloudflare.com/changelog/2025-04-07-durable-objects-free-tier and https://developers.cloudflare.com/durable-objects/platform/pricing
- Cloudflare D1 limits and pricing: https://developers.cloudflare.com/d1/platform/limits and https://developers.cloudflare.com/d1/platform/pricing/
- Workers PBKDF2 iteration cap: https://github.com/cloudflare/workerd/issues/1346 and https://lord.technology/2024/02/21/hashing-passwords-on-cloudflare-workers.html
- Firebase plans: https://firebase.google.com/docs/projects/billing/firebase-pricing-plans
- PocketBase JS engine: https://pocketbase.io/docs/js-overview/
- Nakama: https://heroiclabs.com/nakama/
- OSRS Grand Exchange tax and buy limits: https://oldschool.runescape.wiki/w/Grand_Exchange_tax and https://oldschool.runescape.wiki/w/Update:Grand_Exchange_Tax_&_Item_Sink
- OSRS combat level and accuracy: https://oldschool.runescape.wiki/w/Combat_level and https://oldschool.runescape.wiki/w/Range_calculator
- Torn attacks and mugging: https://wiki.torn.com/wiki/Attack and https://wiki.torn.com/wiki/Mug
- Shakes & Fidget arena: https://gameplay.tips/guides/shakes-and-fidget-arena-and-arena-manager-guide.html
- Melvor Idle offline cap (2020 patch notes): https://wiki.melvoridle.com/w/V0.16.2
