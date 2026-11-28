import { enemies, enemyById, enemyCombatant, zones } from '../rules/enemies.ts';
import { huntInfo, phase } from '../rules/farm.ts';
import { weapons } from '../rules/gear.ts';
import { combatOf } from '../rules/shade.ts';
import type { Game } from '../state/store.ts';
import { useWorld } from './Board.tsx';
import { clock, duration, fmt } from './format.ts';

type Go = (tab: 'shade' | 'board') => void;

export function Hunt({ game, say, go }: { game: Game; say: (m: string | null) => void; go: Go }) {
  const { shade } = game;
  const me = combatOf(shade);
  const current = shade.hunt ? enemyById(shade.hunt) : undefined;
  const world = useWorld(shade, game.now);
  const above = world.rival;

  return (
    <section className="stack">
      {current ? <Current game={game} /> : (
        <div className="card idle">
          <h2>Resting in Lanternfall</h2>
          <p>Pick an enemy below. Your shade keeps hunting it while the app is closed, for up to 24 hours.</p>
        </div>
      )}
      {shade.unspent > 0 && (
        <button className="notice" onClick={() => go('shade')}>
          You have <b>{shade.unspent}</b> unspent stat point{shade.unspent > 1 ? 's' : ''}. Spend them on the Shade tab →
        </button>
      )}
      {above && (
        <button className="notice rival" onClick={() => go('board')}>
          Rank <b>#{world.rank}</b> of {world.total}. Next to pass: <b>{above.name}</b>, level {above.level}, {fmt(above.totalXp - shade.totalXp)} XP ahead →
        </button>
      )}
      {zones.map(zone => (
        <div className="card zone" key={zone.id}>
          <h2>{zone.name}</h2>
          <p className="muted">{zone.blurb}</p>
          <ul className="enemies">
            {enemies.filter(e => e.zone === zone.id).map(e => {
              const info = huntInfo(me, e);
              const on = shade.hunt === e.id;
              const far = e.level > shade.level + 25;
              return (
                <li key={e.id} className={on ? 'on' : info.dangerous ? 'danger' : ''}>
                  <div>
                    <strong>{e.name}</strong> <span className="lvl">Lv {e.level}</span>
                    <small>{weapons[e.weapon].name}{far ? '' : ` · ${duration(info.ttk)} a kill · ${Math.round(info.hurtShare * 100)}% of your life`}</small>
                  </div>
                  {info.dangerous ? <span className="tag">{far ? 'Far beyond you' : 'Too dangerous'}</span> : (
                    <div className="rates"><span>{fmt(info.xpPerHour)} XP/h</span><span className="gold">{fmt(info.goldPerHour)} ob/h</span></div>
                  )}
                  <button disabled={info.dangerous || on} onClick={() => say(game.act(s => { s.hunt = e.id; s.carry = 0; }))}>
                    {on ? 'Hunting' : 'Hunt'}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <div className="card">
        <h2>Journal</h2>
        <ul className="log">
          {shade.log.slice(0, 14).map((entry, i) => (
            <li key={i} className={entry.kind}><time>{clock(entry.at)}</time> {entry.text}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Current({ game }: { game: Game }) {
  const { shade } = game;
  const enemy = enemyById(shade.hunt!)!;
  const me = combatOf(shade);
  const foe = enemyCombatant(enemy);
  const info = huntInfo(me, enemy, foe);
  const now = phase(info, shade.carry);
  return (
    <div className="card current">
      <div className="row">
        <h2>Hunting {enemy.name} <span className="lvl">Lv {enemy.level}</span></h2>
        <button onClick={() => game.act(s => { s.hunt = null; s.carry = 0; })}>Stop</button>
      </div>
      <div className="duel">
        <Bar label={shade.name} value={now.myHp} max={me.hp} kind="me" />
        <span className={`phase ${now.label.toLowerCase()}`}>{now.label}</span>
        <Bar label={enemy.name} value={now.foeHp} max={foe.hp} kind="foe" />
      </div>
      <div className="cycle"><i style={{ width: `${now.progress * 100}%` }} /></div>
      <dl className="facts">
        <div><dt>Kill cycle</dt><dd>{duration(info.cycle)}</dd></div>
        <div><dt>XP / hour</dt><dd>{fmt(info.xpPerHour)}</dd></div>
        <div><dt>Obols / hour</dt><dd className="gold">{fmt(info.goldPerHour)}</dd></div>
        <div><dt>Kills</dt><dd>{fmt(shade.kills)}</dd></div>
      </dl>
    </div>
  );
}

function Bar({ label, value, max, kind }: { label: string; value: number; max: number; kind: 'me' | 'foe' }) {
  return (
    <div className={`hp ${kind}`}>
      <small>{label}</small>
      <div className="bar"><i style={{ width: `${Math.max(0, value) * 100}%` }} /><span>{Math.max(0, Math.round(value * max))} / {max}</span></div>
    </div>
  );
}
