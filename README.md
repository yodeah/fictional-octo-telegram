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

Fights are fully idle. Under the arena each fighter has a row: pick the champion (a mirror match is allowed), then any main and backup weapon from the armory, or press **Swap sides**, then watch. A champion who takes up a staff borrows the Ember Priest's spellbook.

- **Champions:** by default the bout is always the same two hardcoded fighters, each with a backup weapon and a sprite of their own. **Varro the Murmillo** fights with a gladius and a painted scutum and carries two pila (javelins) on his back to throw at a fleeing archer. He wears a grilled, crested helmet, a segmented manica on the sword arm and a greave on the leading leg. **Cassian the Sagittarius** shoots a composite bow, wears a hood, scale armor and a long cloak, and draws a curved sica from his hip when he is cornered.
- **Champion bodies:** the champions are built like figure drawings, from masses: pelvis, narrow waist, a broad ribcage flaring into the lats, a shoulder girdle out to round deltoids, biceps, forearms that narrow to the wrist, quadriceps and calves, squared fists and real feet, on longer legs than the other classes. Arms and legs keep their bone lengths, so elbows and knees bend instead of stretching. Arms are drawn as one smooth contour along a muscle profile (deltoid, biceps peak, narrow elbow, forearm swelling then narrowing to the wrist) with form shading and soft muscle creases, elbows kept in close to the ribs. The armor follows that contour: Varro's manica lames curve round the arm under a domed bronze shoulder guard, and Cassian wears team-colored sleeves under two layered leather shoulder plates. Hands are fists with knuckles, finger creases and a folded thumb, and the fingers wrap over the weapon grip. Cassian's composite recurve is drawn from a side profile: a wrapped grip with bronze collars, working limbs that sweep back toward him to bone string bridges, and stiff bone ears that flick forward again. Each limb is a solid strip with a dark sinew back (gold inlay), a pale horn belly and laminated sides, kept out of the bake's shadow pass so its colors hold against the floor. The bow is rolled around the arrow toward the camera (canted when he shoots toward or away from the camera), so it never shows edge-on. At rest he holds it low with an arrow nocked; a shot raises it, turns him side-on and draws the string to his cheek as the limbs bend deeper and the fixed-length arrow slides back until only the broadhead clears the grip. On release the string snaps straight, the arrow is gone and his hand flies back past the ear; he nocks a fresh arrow halfway through the recovery. Stowed, the bow is strapped flat across his back under the quiver, strung and empty. Varro throws a pilum overhand: carried level at the shoulder, cocked high behind the head with the shoulders turned back, whipped forward over the shoulder, and gone from his hand until he draws the next. His scutum is held angled around his front so it never shows edge-on, and Cassian carries the bow low on the run under a cloak short enough to show his legs. Arrows and pila fly as real shafts with heads, fletching and a hot streak; an arrow leaves the bow at cheek height and drops to chest height over its flight.
- **Champion tactics:** the two champions think harder than the other classes. They sidestep a shot already in flight, and against a shot still being aimed they walk one way while the aim tracks them and cut back once it locks, so the lead sends it wide (a **DODGE** pops up). Varro weaves in short zigzags toward an archer, runs at where Cassian is heading from the middle of the floor to pin him against the wall, and dashes in the moment Cassian is recovering from a shot, out of rolls or staggered. They also dodge melee windups more often.
- **Kicks and shield bashes:** anyone can throw a front kick up close: quick, unblockable and light on damage, but it shoves hard enough to slam a rival into stone, knocks out 16 energy and breaks a windup. Shield users also bash on their own, not only after a block, and a bash breaks a windup too (**INTERRUPTED**). The champions choose their moments: Varro bashes to stop a swing and kicks to send Cassian into the wall or off a raised shield, and Cassian kicks Varro away to make room to shoot.
- **Other classes:** the eleven older classes (Duelist, Hoplite, Raider, Breaker, Executioner, Marksman, Skirmisher and four mages) are still in `data.js` and the balance tool, but they can't be picked: their sprites are not up to the champions' standard.
- **Armory:** besides the champions' own gear, any fighter can carry the older classes' weapons and new ones drawn to the champions' standard. The **trident** is a spear with three barbed prongs on a crossbar: a little wider and a touch shorter, and a hit snags the rival and slows them for a moment.
- **Two weapons each:** every class carries a main and a backup and swaps for 7 energy. Melee fighters take a couple of shots when they cannot close; shooters and mages draw steel when caught with no escape; a spear gives way to a sword up close and a maul to a sword when tired. The spare is worn on the back.
- **Quick movement:** melee **dashes** to close in or sidestep, shooters **roll** away, mages **blink**. Each has limited charges (the pips under the health bar), costs energy and gives a moment of invulnerability. An escape also grants a short burst of speed. A melee dash that ends beside the rival flows into a **dash-strike**: half the windup, 20% more damage.
- **Shared with the side-view battler:** HP, mana, energy, stance and stagger, shield blocks, perfect blocks and riposte bashes, shields broken by axes and mauls, the combat triangle (gentler here), spellbooks, crowded shots and blood.
- **New with a floor to move on:** attacks have a shape (sweep, thrust, slam, bolt) written on the ground during the windup, shields only cover the front, hits from behind are stronger, carved stone plinths block shots, and being knocked into stone staggers.
- After 45 seconds damage rises steadily, so a cautious bout still ends.

## How the picture is made

This follows the pipeline of the original Hades, where characters were [built in 3D and pre-rendered into 2D frames from many angles](https://www.hyperlific.com/articles/jen-zees-2d-defiance-and-the-hand-that-paints-hades-ii/) over [hand-painted 2D environments](https://mcvuk.com/business-news/behind-the-art-of-hades-we-value-artistic-integrity-and-excellence-in-artistic-craft-at-supergiant-however-were-first-and-foremost-a-game-design-lead-team/), with a pen-and-ink look.

- **Fighters are 2D sprites.** A small rig poses each frame once; it is painted in flat color with a heavy shadow side, a hot rim light and an ink outline, then cached. There are 16 facing directions and animations for idle, run, dash, windup, strike, recover, hurt, stagger and death. A broken stance drops the fighter into a staggered stance: buckled onto the back knee, weapon hanging with the blade dragging, guard sagging and head lolling while the body reels.
- **Each class has its own headgear**: crests, pelts, horns, hoods, crowns and halos over the team color.
- **Baked on first use**, about 1 ms a frame, with at most 1,400 frames kept; the champions get extra in-between frames, breathe while idle, swing their arms on the run, coil deeper before a blow and settle back to guard with a slight overshoot.
- **Scenery and effects are prepainted** too: floor (with old bloodstains, broken blades, dropped shields, dented helmets and spent arrows near the edge), stone plinths, vignette, glows, sweep crescents and impact bursts are stamped, not rebuilt.
- **Backdrop:** a drowned temple in a cavern with flowing falls, mist and light shafts. A crowd of shades hops at big blows and cheers a kill; it is drawing only and never affects the bout.
- **Camera:** fixed high angle that zooms in while keeping both fighters in view.

The sprites are generated by code, not drawn by an artist. Painted sprite sheets could replace `sprites.js` behind the same `get()` call.

## Address options

`?a=murmillo&b=murmillo` pins the champions (`murmillo` or `sagittarius`), `?seed=7` repeats a bout, `?debug` draws collision shapes, `?fps` shows frame rate, draw time and the sprite cache.

## Code

| File (in `hades/`) | Contents |
| --- | --- |
| `data.js` | weapons, armor, spells, movement, classes, arena size |
| `sim.js` | the duel with no DOM: decisions, movement, hits, projectiles |
| `sprites.js` | rig, painting and the sprite cache |
| `render.js` | camera, scenery, sprite placement, effects |
| `main.js` | matchups, clock, HUD, controls |

`tools/sprites.html?kit=murmillo` shows every facing and animation of one fighter at full size, for checking art (serve the folder first). Add `&facings=3,5&scale=1.5` for a close look at chosen directions, `&rows=windup,active` for chosen animations and `&shape=kick` to see a kick.

Balance check without a browser:

```bash
node tools/hades-balance.js 60
```
