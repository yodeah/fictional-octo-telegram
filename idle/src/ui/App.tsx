import { useEffect, useState } from 'react';
import { Grind } from './Grind.tsx';

// Two screens share the app: the menu, and the offline grind at #grind. The Fight Sim is its own
// page (fight.html), the Underworld Duel with 1v1 and 2v2 bouts.
export function App() {
  const [route, setRoute] = useState(location.hash);
  useEffect(() => {
    const onHash = () => setRoute(location.hash);
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);
  return route === '#grind' ? <Grind /> : <Menu />;
}

function Menu() {
  return (
    <main className="menu">
      <header>
        <h1>Ash &amp; Obol</h1>
        <p>Dead gladiators fight for coin on the black river.</p>
      </header>
      <nav className="modes">
        <a className="mode" href="./fight.html">
          <strong>Fight Sim</strong>
          <span>Watch 1v1 or 2v2 bouts in the Underworld Duel arena. Pick gear, map and speed.</span>
        </a>
        <a className="mode gold" href="#grind">
          <strong>Ash &amp; Obol <em>offline</em></strong>
          <span>Raise a shade that farms 24/7, even while the app is closed. Level up, shop at the Sutler and climb the highscores past 240 rival shades.</span>
        </a>
      </nav>
      <footer>Everything runs on this device and works offline. Add it to your home screen to install it.</footer>
    </main>
  );
}
