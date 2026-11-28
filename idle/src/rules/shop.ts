// The Sutler (plan §8): sells tier 1–3 gear, five of each, restocked at 00:00 UTC; buys anything
// at 40%. Also sells the Draught of Lethe, which refunds every stat point.

import { pointsAt } from './curve.ts';
import { armors, sellPrice, shields, value, weapons } from './gear.ts';
import { addItem, fits, removeItem, type Shade } from './shade.ts';

export const SHOP_TIERS = [1, 2, 3];
export const STOCK = 5;
const DAY = 86400000;

export const utcDay = (now: number) => Math.floor(now / DAY);
/** Milliseconds until the next 00:00 UTC. */
export const untilReset = (now: number) => (utcDay(now) + 1) * DAY - now;

export const shopItems: string[] = SHOP_TIERS.flatMap(tier => [
  ...Object.keys(weapons).filter(k => !weapons[k].champion),
  ...Object.keys(shields),
  ...Object.keys(armors)
].map(type => `${type}@${tier}`));

export function restock(shade: Shade, now: number) {
  const day = utcDay(now);
  if (shade.shop.day === day) return;
  shade.shop.day = day;
  shade.shop.stock = Object.fromEntries(shopItems.map(key => [key, STOCK]));
}

export function buy(shade: Shade, key: string, now: number): string | null {
  restock(shade, now);
  if (!(shade.shop.stock[key] > 0)) return 'Sold out until the reset.';
  const price = value(key);
  if (shade.purse < price) return `You need ${price} obols.`;
  if (!fits(shade.pack, key)) return 'Your pack is full.';
  shade.purse -= price;
  shade.shop.stock[key]--;
  addItem(shade.pack, key);
  return null;
}

export function sell(shade: Shade, key: string, qty = 1): number {
  const n = Math.min(qty, shade.pack[key] ?? 0);
  if (n <= 0 || !removeItem(shade.pack, key, n)) return 0;
  const gold = n * sellPrice(key);
  shade.purse += gold;
  return gold;
}

export const lethePrice = (level: number) => 10 * level * level;

export function drinkLethe(shade: Shade): string | null {
  const price = lethePrice(shade.level);
  if (shade.purse < price) return `You need ${price} obols.`;
  shade.purse -= price;
  shade.stats = { a: 1, s: 1, d: 1, r: 1, m: 1 };
  shade.unspent = pointsAt(shade.level);
  return null;
}

