import { useEffect, useState, type FormEvent } from 'react';
import { combatLevel } from '../rules/combat.ts';
import { xpToNext, MAX_LEVEL } from '../rules/curve.ts';
import { OFFLINE_CAP, type Report } from '../rules/farm.ts';
import { itemName } from '../rules/gear.ts';
import { newShade, paths, type Path, type Shade } from '../rules/shade.ts';
import { load, save, useGame, wipe, type Game } from '../state/store.ts';
import { Board } from './Board.tsx';
import { duration, fmt } from './format.ts';
import { Hunt } from './Hunt.tsx';
import { Pack, Sutler } from './Pack.tsx';
import { ShadeSheet } from './ShadeSheet.tsx';

export function Grind() {
  const [shade, setShade] = useState<Shade | null>(() => load());
  if (!shade) return <NewShade onCreate={s => { save(s); setShade(s); }} />;
  return <Playing key={shade.created} shade={shade} onDelete={() => { wipe(); setShade(null); }} />;
}

function NewShade({ onCreate }: { onCreate: (shade: Shade) => void }) {
  const [name, setName] = useState('');
  const [path, setPath] = useState<Path>('blade');
  const begin = (event: FormEvent) => {
    event.preventDefault();
    const seed = crypto.getRandomValues(new Uint32Array(1))[0] | 0;
    onCreate(newShade(name.trim().slice(0, 24) || 'Nameless', path, Date.now(), seed));
  };
  return (
    <main className="grind">
      <a className="back" href="#">&larr; Menu</a>
      <form className="card create" onSubmit={begin}>
        <h1>A new shade</h1>
        <p>You died on the sand. The Ferryman will row you back to the living for a fortune in obols. Until then, you fight.</p>
        <label>Name <input value={name} onChange={e => setName(e.target.value)} maxLength={24} placeholder="Nameless" autoFocus /></label>
        <div className="paths" role="radiogroup" aria-label="Starting gear">
          {(Object.keys(paths) as Path[]).map(key => (
            <button type="button" key={key} role="radio" aria-checked={path === key} className={path === key ? 'path on' : 'path'} onClick={() => setPath(key)}>
              <strong>{paths[key].name}</strong>
              <span>{paths[key].blurb}</span>
            </button>
          ))}
        </div>
        <button className="primary" type="submit">Wake in Lanternfall</button>
        <p className="fine">Your save lives only on this device. 240 bot shades already farm this world, and they keep climbing while you are away.</p>
      </form>
    </main>
  );
}

type Tab = 'hunt' | 'shade' | 'pack' | 'sutler' | 'board';
const tabs: { id: Tab; label: string }[] = [
  { id: 'hunt', label: 'Hunt' }, { id: 'shade', label: 'Shade' }, { id: 'pack', label: 'Pack' },
  { id: 'sutler', label: 'Sutler' }, { id: 'board', label: 'Highscores' }
];

function Playing({ shade, onDelete }: { shade: Shade; onDelete: () => void }) {
  const game = useGame(shade);
  const [tab, setTab] = useState<Tab>('hunt');
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(id);
  }, [toast]);
  const say = (message: string | null) => { if (message) setToast(message); };
  const need = xpToNext(shade.level);
  return (
    <main className="grind">
      <header className="top">
        <a className="back" href="#">&larr; Menu</a>
        <div className="who">
          <h1>{shade.name}</h1>
          <p>Level <b>{shade.level}</b> · CL {combatLevel(shade.stats)} · <span className="gold">{fmt(shade.purse)} obols</span></p>
        </div>
        <div className="xp" title={`${fmt(shade.xp)} / ${fmt(need)} XP`}>
          <i style={{ width: `${shade.level >= MAX_LEVEL ? 100 : Math.min(100, shade.xp / need * 100)}%` }} />
          <span>{shade.level >= MAX_LEVEL ? 'Max level' : `${fmt(shade.xp)} / ${fmt(need)} XP`}</span>
        </div>
      </header>
      <nav className="tabs">
        {tabs.map(t => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            {t.label}{t.id === 'shade' && shade.unspent > 0 ? <em className="badge">{shade.unspent}</em> : null}
          </button>
        ))}
      </nav>
      {tab === 'hunt' && <Hunt game={game} say={say} go={setTab} />}
      {tab === 'shade' && <ShadeSheet game={game} say={say} onDelete={onDelete} />}
      {tab === 'pack' && <Pack game={game} say={say} />}
      {tab === 'sutler' && <Sutler game={game} say={say} />}
      {tab === 'board' && <Board game={game} />}
      {toast && <div className="toast" role="status">{toast}</div>}
      {game.away && <Away report={game.away} game={game} />}
    </main>
  );
}

function Away({ report, game }: { report: Report; game: Game }) {
  const capped = report.seconds > OFFLINE_CAP;
  const drops = Object.entries(report.drops).filter(([key]) => !key.startsWith('scrap.'));
  const scrap = Object.entries(report.drops).filter(([key]) => key.startsWith('scrap.'));
  const sold = Object.values(report.sold).reduce((a, b) => a + b, 0);
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="away-title">
      <div className="card">
        <h2 id="away-title">While you were away</h2>
        <p className="muted">{duration(report.seconds)}{capped ? ' (your shade stops after 24 h)' : ''}</p>
        {report.kills > 0 ? (
          <ul className="summary">
            <li><b>{fmt(report.kills)}</b> kills</li>
            <li><b>+{fmt(report.xp)}</b> XP</li>
            {report.toLevel > report.fromLevel && <li>Level <b>{report.fromLevel} → {report.toLevel}</b>, +{report.points} points{game.shade.auto ? ' (auto-spent)' : ''}</li>}
            <li><b>+{fmt(report.gold)}</b> obols</li>
            {drops.map(([key, n]) => <li key={key}>{n > 1 ? `${n} × ` : ''}{itemName(key)}</li>)}
            {scrap.map(([key, n]) => <li key={key} className="muted">{n} × {itemName(key)}</li>)}
            {sold > 0 && <li className="muted">Pack full: sold {sold} item{sold > 1 ? 's' : ''} to the Sutler for {fmt(report.soldFor)} obols</li>}
          </ul>
        ) : <p>Your shade was not hunting, so nothing happened.</p>}
        {report.stopped && <p className="warn">{report.stopped}</p>}
        <button className="primary" onClick={game.dismissAway}>Back to it</button>
      </div>
    </div>
  );
}
