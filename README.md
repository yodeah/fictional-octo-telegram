# Underworld Duel

An idle 2.5D arena duel seen from a high three-quarter camera, inspired by the feel of Hades. This branch holds only this game: the older side-view battler lives on other branches. All art is painted by code and none of it comes from Hades.

## Run

There is no build step. From the project folder, open the file directly:

```bash
open index.html
```

Or serve it (stop with Ctrl+C) and visit <http://localhost:8157/>:

```bash
python3 -m http.server 8157 --bind 127.0.0.1
```

## How it plays

Fights are fully idle. Every visit opens on a 2v2 with a random loadout for each fighter: champion, main and backup weapon, and armor. Under the arena each fighter has a row to change any of them (a mirror match is allowed); **Shuffle** rolls new loadouts for everyone and **Swap sides** trades them between the teams. Then watch. A champion who takes up a staff borrows the Ember Priest's spellbook.

- **Champions:** there are two hardcoded fighters, each with their own gear, a backup weapon and a sprite of their own (`?a=murmillo&b=sagittarius` puts them in it). **Varro the Murmillo** fights with a gladius and a painted scutum and carries two pila (javelins) on his back to throw at a fleeing archer. He wears a grilled, crested helmet, a segmented manica on the sword arm and a greave on the leading leg. **Cassian the Sagittarius** shoots a composite bow, wears a hood, scale armor and a long cloak, and draws a curved sica from his hip when he is cornered.
- **Champion bodies:** the champions are built like figure drawings, from masses: pelvis, narrow waist, a broad ribcage flaring into the lats, a shoulder girdle out to round deltoids, biceps, forearms that narrow to the wrist, quadriceps and calves, squared fists and real feet, on longer legs than the other classes. Arms and legs keep their bone lengths, so elbows and knees bend instead of stretching. Arms are drawn as one smooth contour along a muscle profile (deltoid, biceps peak, narrow elbow, forearm swelling then narrowing to the wrist) with form shading and soft muscle creases, elbows kept in close to the ribs. The armor follows that contour: Varro's manica lames curve round the arm under a domed bronze shoulder guard, and Cassian wears team-colored sleeves under two layered leather shoulder plates. Hands are fists with knuckles, finger creases and a folded thumb, and the fingers wrap over the weapon grip. Cassian's composite recurve is drawn from a side profile: a wrapped grip with bronze collars, working limbs that sweep back toward him to bone string bridges, and stiff bone ears that flick forward again. Each limb is a solid strip with a dark sinew back (gold inlay), a pale horn belly and laminated sides, kept out of the bake's shadow pass so its colors hold against the floor. The bow is rolled around the arrow toward the camera (canted when he shoots toward or away from the camera), so it never shows edge-on. At rest he holds it low with an arrow nocked; a shot raises it, turns him side-on and draws the string to his cheek as the limbs bend deeper and the fixed-length arrow slides back until only the broadhead clears the grip. On release the string snaps straight, the arrow is gone and his hand flies back past the ear; he nocks a fresh arrow halfway through the recovery. Stowed, the bow is strapped flat across his back under the quiver, strung and empty. Varro throws a pilum overhand: carried level at the shoulder, cocked high behind the head with the shoulders turned back, whipped forward over the shoulder, and gone from his hand until he draws the next. His scutum is held angled around his front so it never shows edge-on, and Cassian carries the bow low on the run under a cloak short enough to show his legs. Arrows and pila fly as real shafts with heads, fletching and a hot streak; an arrow leaves the bow at cheek height and drops to chest height over its flight.
- **Champion tactics:** the two champions think harder than the other classes. They sidestep a shot already in flight, and against a shot still being aimed they walk one way while the aim tracks them and cut back once it locks, so the lead sends it wide (a **DODGE** pops up). Varro weaves in short zigzags toward an archer, runs at where Cassian is heading from the middle of the floor to pin him against the wall, and dashes in the moment Cassian is recovering from a shot, out of rolls or staggered. They also dodge melee windups more often.
- **Kicks and shield bashes:** anyone can throw a front kick up close: quick, unblockable and light on damage, but it shoves hard enough to slam a rival into stone, knocks out 16 energy and breaks a windup. Shield users also bash on their own, not only after a block, and a bash breaks a windup too (**INTERRUPTED**). The champions choose their moments: Varro bashes to stop a swing and kicks to send Cassian into the wall or off a raised shield, and Cassian kicks Varro away to make room to shoot.
- **Other classes:** the eleven older classes (Duelist, Hoplite, Raider, Breaker, Executioner, Marksman, Skirmisher and four mages) are still in `data.js` and the balance tool, but they can't be picked: their sprites are not up to the champions' standard.
- **Armory:** besides the champions' own gear, any fighter can carry the older classes' weapons and new ones drawn to the champions' standard. The **trident** is a spear with three barbed prongs on a crossbar: a little wider and a touch shorter, and a hit snags the rival and slows them for a moment. The **flail** swings a spiked ball on a chain that hangs slack at rest and flies straight out in the blow; it whips around a raised shield, so it is rarely blocked. The **falx** is a two-handed Dacian blade that hooks forward like a beak, edge on the inside of the curve: heavy, wide and able to split shields. Broad blades are laid flat to the camera so their shape reads from every side. The **war hammer** is a one-handed overhead slam with a square face and a back spike: it crushes stance, knocks the wind out of the rival (energy) and can break a shield, so it still pairs with a scutum. The **sling** hangs from the hand at rest; a shot raises it and whirls the pouch flat over the head (a pale trail sells the spin), then the arm snaps forward and a grey stone flies, quick and light but hard on stance. Stowed, it tucks under the belt. The **battle axe** has a bearded head: a thin blade whose edge sweeps down into a hook, a square poll behind the socket and a team-colored cord under it. The **war maul** is a long two-handed haft with a leather grip for both hands and a heavy forged head with flared faces; too heavy to hold up, it rests low in front until it is heaved overhead and brought down.
- **Armor:** each fighter's row also picks armor, worn over the champion's own outfit (or **Own outfit** for the drawing above). It recolors the torso and adds its own pieces at the arena camera distance. **Lorica segmentata** wraps the torso in overlapping steel hoops with two hinged chest plates and three steel lames on each shoulder: it turns blades and arrows but slows the wearer enough that an archer can stay away. The **bronze cuirass** is a muscle breastplate with hammered pectorals and a ribbed stomach, rolled rims, small bronze shoulder caps over team-colored pteruges and a skirt of team-colored strips: lighter than steel, and a swordsman hits a little harder in it. The **wolf pelt** is a shaggy fur mantle with a ragged edge and the forepaws hanging over the chest, with fur over each shoulder; Varro keeps his bare chest under it and Cassian trades his scales for a laced jerkin. It barely protects, but it is the fastest thing to run in and a shooter's aim is surer in it.
- **2v2:** the default bout, and the **Mode** menu switches to **1 v 1**: Varro and Felix (red) against Cassian and Draco (blue), every fighter with their own loadout row and HUD card. Each fighter picks a rival among the standing enemies, a blow lands on every enemy it covers, shots hit the first enemy in their path (never a teammate), and a team wins when both rivals are down. The fighters play as a team: a swordsman weighs distance when choosing a rival, a shooter barely does; both go after the wounded and the staggered, peel an enemy blade off a teammate (above all off their archer) and answer a blade that reaches them. A second swordsman on the same rival circles to the far side for blows from behind, an archer keeps their swordsman between themselves and the enemy and steps aside rather than shoot through a teammate, and teammates give each other room.
- **Two weapons each:** every class carries a main and a backup and swaps for 7 energy. Melee fighters take a couple of shots when they cannot close; shooters and mages draw steel when caught with no escape; a spear gives way to a sword up close and a maul to a sword when tired. The spare is worn on the back.
- **Quick movement:** melee **dashes** to close in or sidestep, shooters **roll** away, mages **blink**. Each has limited charges (the pips under the health bar), costs energy and gives a moment of invulnerability. An escape also grants a short burst of speed. A melee dash that ends beside the rival flows into a **dash-strike**: half the windup, 20% more damage.
- **Shared with the side-view battler:** HP, mana, energy, stance and stagger, shield blocks, perfect blocks and riposte bashes, shields broken by axes and mauls, the combat triangle (gentler here), spellbooks, crowded shots and blood.
- **New with a floor to move on:** attacks have a shape (sweep, thrust, slam, bolt) written on the ground during the windup, shields only cover the front, hits from behind are stronger, tall obstacles block shots, and being knocked into an obstacle staggers.
- **Maps:** the **Map** menu picks the floor. The **drowned temple** (the default, and the map the balance tools measure) has four carved stone plinths on the diagonals; blades close in under their cover, so swordsmen do best here. The **molten forge** has a pit of molten metal in the middle that shots fly over but nobody can cross, between two long brick forge hearths that stop both; fights wheel round the pit and it suits shooters a little. The **Elysian garden** has five broken marble columns in a quincunx, the middle one whole with a sacred flame, and low marble balustrades along the far and near terraces that shots clear but bodies don't; blades and shooters come out even there. Fighters walk round every obstacle, slide along a wall to its nearer end, and shoot over the low ones.
- After 45 seconds damage rises steadily, so a cautious bout still ends.

## How the picture is made

This follows the pipeline of the original Hades, where characters were [built in 3D and pre-rendered into 2D frames from many angles](https://www.hyperlific.com/articles/jen-zees-2d-defiance-and-the-hand-that-paints-hades-ii/) over [hand-painted 2D environments](https://mcvuk.com/business-news/behind-the-art-of-hades-we-value-artistic-integrity-and-excellence-in-artistic-craft-at-supergiant-however-were-first-and-foremost-a-game-design-lead-team/), with a pen-and-ink look.

- **Fighters are 2D sprites.** A small rig poses each frame once; it is painted in flat color with a heavy shadow side, a hot rim light and an ink outline, then cached. There are 16 facing directions and animations for idle, run, dash, windup, strike, recover, hurt, stagger and death. A broken stance drops the fighter into a staggered stance: buckled onto the back knee, weapon hanging with the blade dragging, guard sagging and head lolling while the body reels.
- **Each class has its own headgear**: crests, pelts, horns, hoods, crowns and halos over the team color.
- **Baked on first use**, about 1 ms a frame, with at most 1,400 frames kept; the champions get extra in-between frames, breathe while idle, swing their arms on the run, coil deeper before a blow and settle back to guard with a slight overshoot.
- **Scenery and effects are prepainted** too: each map's floor (with old bloodstains, broken blades, dropped shields, dented helmets and spent arrows near the edge) and backdrop, every obstacle, vignette, glows, sweep crescents and impact bursts are painted once per map and stamped, not rebuilt.
- **Backdrops:** the temple sits in a cavern over dark water with flowing falls, mist and light shafts. The forge stands on a molten lake under smoke and ember light, with chimneys of the great forges, a colossal anvil on the far shore, chains hanging from the dark and falls of lava. The garden floats on a river of light under an Elysian sunset, with green hills, cypresses, a marble temple and falls of bright water. A crowd of shades (teal, ember or golden) hops at big blows and cheers a kill; it is drawing only and never affects the bout.
- **Camera:** fixed high angle that zooms in while keeping both fighters in view.

The sprites are generated by code, not drawn by an artist. Painted sprite sheets could replace `sprites.js` behind the same `get()` call.

## Address options

`?mode=1v1` starts a duel instead of a team bout, `?map=forge` or `?map=garden` starts on another map, `?a=murmillo&b=murmillo` puts the first two fighters in that champion's own gear (`murmillo` or `sagittarius`), `?seed=7` repeats the loadouts and the bout, `?debug` draws collision shapes, `?fps` shows frame rate, draw time and the sprite cache.

## Code

| File (in `hades/`) | Contents |
| --- | --- |
| `data.js` | weapons, armor, spells, movement, classes, maps and their obstacles |
| `sim.js` | the duel with no DOM: decisions, movement, hits, projectiles |
| `sprites.js` | rig, painting and the sprite cache |
| `render.js` | camera, each map's scenery and ambience, sprite placement, effects |
| `main.js` | matchups, clock, HUD, controls |

`tools/sprites.html?kit=murmillo` shows every facing and animation of one fighter at full size, for checking art (serve the folder first). Add `&facings=3,5&scale=1.5` for a close look at chosen directions, `&rows=windup,active` for chosen animations and `&shape=kick` to see a kick.

Balance check without a browser:

```bash
node tools/hades-balance.js 60
```

Every map with random champion loadouts, 1v1 and 2v2: bout length, stalls (no winner by 240 s) and how often each side wins:

```bash
node tools/hades-maps.js 300
```
