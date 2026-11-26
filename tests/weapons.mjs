// Round robin between shop weapons on otherwise equal fighters. Usage: node tests/weapons.mjs [bouts per pair]
import { load } from './harness.mjs';

export function weaponRates(game, bouts = 12, armor = ['rags', 'leather', 'plate']) {
  const { Rules, ArenaDuel, weapons } = game;
  const keys = Object.keys(Rules.catalog).filter(key => Rules.slotOf(key) === 'weapon');
  const fighter = (weapon, kit, color) => ({
    name: color ? 'B' : 'A', level: 10, strength: 60, attack: 60, ranged: 60, magic: 40, defense: 15, maxHP: 190, color: [120, 80, 60], trim: [200, 200, 200],
    gear: { weapon, reserve: 'none', shield: weapons[weapon].twoHanded ? 'none' : 'round', armor: kit, spellbook: 'none', special: 'none' }
  });
  const wins = Object.fromEntries(keys.map(key => [key, 0]));
  const total = { ...wins };
  keys.forEach((a, i) => keys.slice(i + 1).forEach((b, j) => {
    for (let n = 0; n < bouts; n++) {
      // Swap sides every bout so neither corner is favored.
      const [first, second] = n % 2 ? [b, a] : [a, b];
      const kit = armor[Math.floor(n / 2) % armor.length];
      ArenaDuel.setup(i * 1009 + j * 83 + n, [fighter(first, kit, 0), fighter(second, kit, 1)]);
      wins[ArenaDuel.resolve().won ? first : second]++;
      total[a]++;
      total[b]++;
    }
  }));
  return keys.map(key => [key, wins[key] / total[key]]).sort((x, y) => y[1] - x[1]);
}

if (process.argv[1].endsWith('weapons.mjs')) {
  for (const [key, rate] of weaponRates(load(), Number(process.argv[2] || 12))) console.log(key.padEnd(12), rate.toFixed(2));
}
