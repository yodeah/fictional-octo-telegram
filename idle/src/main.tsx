import { createRoot } from 'react-dom/client';
import { App } from './ui/App.tsx';
import './ui/style.css';

createRoot(document.getElementById('root')!).render(<App />);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => { /* offline install is optional */ }));
}
