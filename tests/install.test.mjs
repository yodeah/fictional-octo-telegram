import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root));
// Width and height sit at fixed offsets in a PNG header.
const size = path => { const png = read(path); return png.readUInt32BE(16) + 'x' + png.readUInt32BE(20); };

test('home screen icons and manifest are in place', () => {
  const html = read('index.html').toString();
  assert.match(html, /rel="manifest" href="\.\/manifest\.webmanifest"/);
  assert.match(html, /rel="apple-touch-icon" href="\.\/icons\/icon-180\.png"/);
  assert.equal(size('icons/icon-180.png'), '180x180');
  const manifest = JSON.parse(read('manifest.webmanifest'));
  assert.equal(manifest.display, 'standalone');
  // GitHub Pages serves the game from a subfolder, so every path must be relative.
  for (const path of [manifest.start_url, manifest.scope, ...manifest.icons.map(icon => icon.src)]) assert.doesNotMatch(path, /^\/|:/);
  for (const icon of manifest.icons) assert.equal(size(icon.src), icon.sizes);
});
