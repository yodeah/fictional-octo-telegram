import { useState } from 'react';
import { describe, item, itemName, levelNeeded, sellPrice, tiers, value } from '../rules/gear.ts';
import { equip, PACK_SLOTS, slotsUsed } from '../rules/shade.ts';
import { buy, drinkLethe, lethePrice, sell, shopItems, untilReset } from '../rules/shop.ts';
import type { Game } from '../state/store.ts';
import { duration, fmt } from './format.ts';

const order = { weapon: 0, shield: 1, armor: 2, charm: 3, scrap: 4 };
const sortKey = (key: string) => {
  const it = item(key);
  return it ? order[it.kind] * 100 - ('tier' in it ? it.tier : 0) : 999;
};

export function Pack({ game, say }: { game: Game; say: (m: string | null) => void }) {
  const { shade } = game;
  const keys = Object.keys(shade.pack).sort((a, b) => sortKey(a) - sortKey(b) || a.localeCompare(b));
  const scrap = keys.filter(k => k.startsWith('scrap.'));
  const scrapValue = scrap.reduce((sum, k) => sum + sellPrice(k) * shade.pack[k], 0);
  const used = slotsUsed(shade.pack);
  return (
    <section className="stack">
      <div className="card">
        <div className="row">
          <h2>Pack</h2>
          <span className={used >= PACK_SLOTS ? 'warn' : 'muted'}>{used} / {PACK_SLOTS} slots</span>
        </div>
        {used >= PACK_SLOTS && <p className="warn">Your pack is full. New loot goes straight to the Sutler at 40%.</p>}
        {scrap.length > 0 && (
          <button onClick={() => game.act(s => { for (const k of scrap) sell(s, k, s.pack[k]); })}>Sell all scrap for {fmt(scrapValue)} obols</button>
        )}
        {keys.length === 0 ? <p className="muted">Empty. Loot from your hunts lands here.</p> : (
          <ul className="items">
            {keys.map(key => {
              const it = item(key);
              const gear = it && it.kind !== 'scrap';
              const need = levelNeeded(key);
              return (
                <li key={key}>
                  <div>
                    <strong>{itemName(key)}{shade.pack[key] > 1 ? ` × ${shade.pack[key]}` : ''}</strong>
                    <small>{describe(key)}{gear && need > shade.level ? ` · needs level ${need}` : ''}</small>
                  </div>
                  {gear && <button disabled={need > shade.level} onClick={() => say(game.act(s => equip(s, key)))}>Equip</button>}
                  <button onClick={() => game.act(s => { sell(s, key, 1); })}>Sell {fmt(sellPrice(key))}</button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

const groups = [
  { id: 'weapon', label: 'Weapons' }, { id: 'shield', label: 'Shields' }, { id: 'armor', label: 'Armor' }
] as const;

export function Sutler({ game, say }: { game: Game; say: (m: string | null) => void }) {
  const { shade } = game;
  const [tier, setTier] = useState(Math.min(3, shade.level >= 20 ? 3 : shade.level >= 10 ? 2 : 1));
  const lethe = lethePrice(shade.level);
  return (
    <section className="stack">
      <div className="card">
        <div className="row">
          <h2>The Sutler</h2>
          <span className="muted">Restocks in {duration(untilReset(game.now) / 1000)}</span>
        </div>
        <p className="muted">"Bronze to grave-steel, five of each, fresh every midnight. Anything finer, you'll have to pry off the dead. I buy anything at four in ten."</p>
        <div className="seg" role="tablist">
          {[1, 2, 3].map(t => (
            <button key={t} role="tab" aria-selected={tier === t} className={tier === t ? 'on' : ''} onClick={() => setTier(t)}>
              {tiers[t]!.name} <small>Lv {tiers[t]!.level}</small>
            </button>
          ))}
        </div>
        {groups.map(group => (
          <div key={group.id}>
            <h3>{group.label}</h3>
            <ul className="items">
              {shopItems.filter(k => k.endsWith(`@${tier}`) && item(k)?.kind === group.id).map(key => {
                const stock = shade.shop.stock[key] ?? 0;
                const price = value(key);
                const worn = Object.values(shade.equip).includes(key);
                return (
                  <li key={key}>
                    <div>
                      <strong>{itemName(key)}{worn ? ' · worn' : ''}</strong>
                      <small>{describe(key)} · {stock} left</small>
                    </div>
                    <button disabled={!stock || shade.purse < price} onClick={() => say(game.act((s, now) => buy(s, key, now)) ?? `Bought ${itemName(key)}. Equip it from your Pack.`)}>
                      {fmt(price)}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <div className="card">
        <h2>Draught of Lethe</h2>
        <p>Drink from the river of forgetting: every stat returns to 1 and all {shade.unspent + Object.values(shade.stats).reduce((a, b) => a + b - 1, 0)} points come back to spend again.</p>
        <button disabled={shade.purse < lethe} onClick={() => {
          if (confirm(`Forget every stat point for ${fmt(lethe)} obols?`)) say(game.act(s => drinkLethe(s)) ?? 'Your mind is clear. Spend your points on the Shade tab.');
        }}>Drink for {fmt(lethe)} obols</button>
        <p className="fine">Price rises with your level ({fmt(lethe)} at level {shade.level}).</p>
      </div>
    </section>
  );
}
