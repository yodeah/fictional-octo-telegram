# Underworld Duel — 2.5D proof of concept

A 1v1 idle duel seen from a high three-quarter camera, inspired by the feel of Hades. It is a separate page from the side-view arena: `index.html` and its files are unchanged. All art is drawn in code and none of it comes from Hades.

## Run

From the project folder:

```bash
open hades.html
```

## How it plays

As in the main game, fights are fully idle. Choose a class for each side (or leave **Random**), then watch.

- **Classes:** Duelist, Hoplite, Raider, Breaker, Executioner (melee); Marksman, Skirmisher (ranged); Cryomancer, Stormcaller, Sanguinist, Ember Priest (magic).
- **Two weapons each:** every class carries a main and a backup and swaps for 7 energy. Melee fighters take a couple of shots when they cannot close; shooters and mages draw steel when caught with no escape; a spear gives way to a sword up close and a maul to a sword when tired. The spare is worn on the back.
- **Quick movement:** melee **dashes** to close in or sidestep, shooters **roll** away, mages **blink**. Each has limited charges (the pips under the health bar), costs energy and gives a moment of invulnerability. An escape also grants a short burst of speed. A melee dash that ends beside the rival flows into a **dash-strike**: half the windup, 20% more damage.
- **Shared with the side-view battler:** HP, mana, energy, stance and stagger, shield blocks, perfect blocks and riposte bashes, shields broken by axes and mauls, the combat triangle (gentler here), spellbooks, crowded shots and blood.
- **New with a floor to move on:** attacks have a shape (sweep, thrust, slam, bolt) written on the ground during the windup, shields only cover the front, hits from behind are stronger, stone planters block shots, and being knocked into stone staggers.
- After 45 seconds damage rises steadily, so a cautious bout still ends.

## Address options

`?a=marksman&b=raider` pins classes, `?seed=7` repeats a bout, `?debug` draws collision shapes.

## Code

| File | Contents |
| --- | --- |
| `data.js` | weapons, armor, spells, movement, classes, arena size |
| `sim.js` | the duel with no DOM: decisions, movement, hits, projectiles |
| `render.js` | camera, scenery, fighters, effects |
| `main.js` | matchups, clock, HUD, controls |

Balance check without a browser:

```bash
node tools/hades-balance.js 60
```
