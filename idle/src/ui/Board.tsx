import { useMemo, useState } from 'react';
import { botAt, makeBots, type BotView } from '../rules/bots.ts';
import { combatLevel, type Stats } from '../rules/combat.ts';
import { statNames, type StatKey } from '../rules/gear.ts';
import type { Shade } from '../rules/shade.ts';
import type { Game } from '../state/store.ts';
import { ago, fmt } from './format.ts';

export interface Entry { name: string; level: number; totalXp: number; stats: Stats; cl: number; you: boolean; style: string; hunting: string }

type BoardId = 'overall' | StatKey;

function rankBy(entries: Entry[], board: BoardId): Entry[] {
  return [...entries].sort((x, y) => board === 'overall'
    ? y.totalXp - x.totalXp
    : y.stats[board] - x.stats[board] || y.totalXp - x.totalXp);
}

/** The bots as they stand now, refreshed every ten seconds, with you among them. */
export function useWorld(shade: Shade, now: number) {
  const bots = useMemo(() => makeBots(shade.seed, shade.created), [shade.seed, shade.created]);
  const bucket = Math.floor(now / 10000);
  const views = useMemo(() => bots.map(b => botAt(b, bucket * 10000)).filter((v): v is BotView => !!v), [bots, bucket]);
  const you: Entry = {
    name: shade.name, level: shade.level, totalXp: shade.totalXp, stats: shade.stats, cl: combatLevel(shade.stats),
    you: true, style: 'You', hunting: ''
  };
  const entries: Entry[] = [you, ...views.map(v => ({
    name: v.bot.name, level: v.level, totalXp: v.totalXp, stats: v.stats, cl: v.cl, you: false,
    style: v.bot.arch.name, hunting: v.hunting.name
  }))];
  const overall = rankBy(entries, 'overall');
  const index = overall.indexOf(you);
  return { views, entries, rank: index + 1, total: overall.length, rival: index > 0 ? overall[index - 1] : null };
}

export function Board({ game }: { game: Game }) {
  const { shade, now } = game;
  const world = useWorld(shade, now);
  const [board, setBoard] = useState<BoardId>('overall');
  const ranked = rankBy(world.entries, board);
  const at = ranked.findIndex(e => e.you);
  // The top ten, then the shades around you.
  const shown = new Set<number>();
  for (let i = 0; i < Math.min(10, ranked.length); i++) shown.add(i);
  for (let i = Math.max(0, at - 3); i <= Math.min(ranked.length - 1, at + 3); i++) shown.add(i);
  const rows = [...shown].sort((a, b) => a - b);
  const feed = world.views
    .filter(v => v.level > 1 && v.leveledAt <= now)
    .sort((a, b) => b.leveledAt - a.leveledAt)
    .slice(0, 8);

  return (
    <section className="stack">
      <div className="card">
        <h2>Highscores</h2>
        <div className="seg" role="tablist">
          {(['overall', 'a', 's', 'd', 'r', 'm'] as BoardId[]).map(id => (
            <button key={id} role="tab" aria-selected={board === id} className={board === id ? 'on' : ''} onClick={() => setBoard(id)}>
              {id === 'overall' ? 'Overall' : statNames[id]}
            </button>
          ))}
        </div>
        <table className="board">
          <thead>
            <tr><th>#</th><th>Shade</th><th>{board === 'overall' ? 'Level' : statNames[board]}</th><th className="num">Total XP</th></tr>
          </thead>
          <tbody>
            {rows.map((i, n) => (
              <Row key={i} rank={i + 1} entry={ranked[i]} board={board} gap={n > 0 && rows[n - 1] !== i - 1} />
            ))}
          </tbody>
        </table>
        <p className="fine">{world.total} shades. Bots farm around the clock at their own pace, so the board moves while you are away.</p>
      </div>
      <div className="card">
        <h2>Lanternfall news</h2>
        <ul className="log">
          {feed.map(v => (
            <li key={v.bot.id} className="level"><time>{ago(now - v.leveledAt)}</time> {v.bot.name} reached level {v.level}, hunting {v.hunting.name}s.</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Row({ rank, entry, board, gap }: { rank: number; entry: Entry; board: BoardId; gap: boolean }) {
  return (
    <>
      {gap && <tr className="gap"><td colSpan={4}>…</td></tr>}
      <tr className={entry.you ? 'you' : ''}>
        <td>{rank}</td>
        <td><strong>{entry.name}</strong><small>{entry.you ? 'you' : entry.style}</small></td>
        <td>{board === 'overall' ? `${entry.level}` : entry.stats[board]}<small>CL {entry.cl}</small></td>
        <td className="num">{fmt(entry.totalXp)}</td>
      </tr>
    </>
  );
}
