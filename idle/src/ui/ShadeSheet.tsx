import { combatLevel, throughArmor } from '../rules/combat.ts';
import { MAX_STAT, pointsAt } from '../rules/curve.ts';
import { describe, item, itemName, statNames, type Slot, type StatKey } from '../rules/gear.ts';
import { allocate, combatOf, presets, spendByPreset, unequip, type Preset } from '../rules/shade.ts';
import type { Game } from '../state/store.ts';
import { fmt } from './format.ts';

const statHelp: Record<StatKey, string> = {
  a: 'Accuracy with every weapon and spell.',
  s: 'Damage with blades, axes and hammers.',
  d: 'Evasion, armor and staying power.',
  r: 'Damage with bows, slings and crossbows.',
  m: 'Damage of staff spells.'
};
const slots: { id: Slot; label: string }[] = [
  { id: 'weapon', label: 'Weapon' }, { id: 'shield', label: 'Shield' }, { id: 'armor', label: 'Armor' }, { id: 'charm', label: 'Charm' }
];

export function ShadeSheet({ game, say, onDelete }: { game: Game; say: (m: string | null) => void; onDelete: () => void }) {
  const { shade } = game;
  const me = combatOf(shade);
  const charm = shade.equip.charm ? item(shade.equip.charm) : null;
  const bonus = (k: StatKey) => charm && charm.kind === 'charm' && charm.stat === k ? charm.amount : 0;
  return (
    <section className="stack">
      <div className="card">
        <div className="row">
          <h2>Stats</h2>
          <span className={shade.unspent ? 'points on' : 'points'}>{shade.unspent} point{shade.unspent === 1 ? '' : 's'} to spend</span>
        </div>
        <ul className="stats">
          {(Object.keys(statNames) as StatKey[]).map(k => (
            <li key={k}>
              <div><strong>{statNames[k]}</strong><small>{statHelp[k]}</small></div>
              <b className="value">{shade.stats[k]}{bonus(k) ? <em> +{bonus(k)}</em> : null}</b>
              <button disabled={!shade.unspent || shade.stats[k] >= MAX_STAT} onClick={() => game.act(s => { allocate(s, k, 1); })}>+1</button>
              <button disabled={shade.unspent < 2 || shade.stats[k] >= MAX_STAT} onClick={() => game.act(s => { allocate(s, k, 5); })}>+5</button>
            </li>
          ))}
        </ul>
        {shade.unspent > 0 && (
          <div className="presets">
            <span>Spend all as</span>
            {(Object.keys(presets) as Preset[]).map(p => (
              <button key={p} onClick={() => game.act(s => { spendByPreset(s, p); })}>{presets[p].name}</button>
            ))}
          </div>
        )}
        <label className="auto">
          Points earned while away
          <select value={shade.auto ?? ''} onChange={e => game.act(s => { s.auto = (e.target.value || null) as Preset | null; })}>
            <option value="">wait for me</option>
            {(Object.keys(presets) as Preset[]).map(p => <option key={p} value={p}>auto-spend as {presets[p].name}</option>)}
          </select>
        </label>
        <p className="fine">{pointsAt(shade.level)} points at level {shade.level}: 8 to start and 3 a level. Stats cap at 99, so no shade can max all five. The Sutler sells a Draught of Lethe that refunds them.</p>
      </div>

      <div className="card">
        <h2>Combat</h2>
        <dl className="facts">
          <div><dt>Life</dt><dd>{me.hp}</dd></div>
          <div><dt>Combat level</dt><dd>{combatLevel(shade.stats)}</dd></div>
          <div><dt>Style</dt><dd>{me.style}</dd></div>
          <div><dt>Max hit</dt><dd>{me.maxHit}</dd></div>
          <div><dt>Swing</dt><dd>{me.cycle.toFixed(2)} s</dd></div>
          <div><dt>Accuracy</dt><dd>{me.ar.toFixed(1)}</dd></div>
          <div><dt>Evasion</dt><dd>{me.dr.toFixed(1)}</dd></div>
          <div><dt>Armor</dt><dd>{me.armor.toFixed(0)} <small>({Math.round(100 - throughArmor(me.armor, 'melee') * 100)}% off)</small></dd></div>
        </dl>
      </div>

      <div className="card">
        <h2>Equipment</h2>
        <ul className="gear">
          {slots.map(slot => {
            const key = shade.equip[slot.id];
            return (
              <li key={slot.id}>
                <small>{slot.label}</small>
                <div>{key ? <><strong>{itemName(key)}</strong><small>{describe(key)}</small></> : <span className="muted">empty</span>}</div>
                {key && <button onClick={() => say(game.act(s => unequip(s, slot.id)))}>Take off</button>}
              </li>
            );
          })}
        </ul>
        <p className="fine">Put on gear from your Pack. Gear tiers need a level: Iron 10, Grave-steel 20, Obsidian 30, Ember-forged 45, Styx-tempered 60, Nightglass 75, Lantern-gold 90.</p>
      </div>

      <div className="card">
        <h2>Record</h2>
        <dl className="facts">
          <div><dt>Kills</dt><dd>{fmt(shade.kills)}</dd></div>
          <div><dt>Obols earned</dt><dd>{fmt(shade.earned)}</dd></div>
          <div><dt>Total XP</dt><dd>{fmt(shade.totalXp)}</dd></div>
          <div><dt>Arrived</dt><dd>{new Date(shade.created).toLocaleDateString()}</dd></div>
        </dl>
        <button className="danger" onClick={() => { if (confirm(`Delete ${shade.name} for good? This cannot be undone.`)) onDelete(); }}>Delete this shade</button>
      </div>
    </section>
  );
}
