import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { listPrecache, computeVersion, renderBlock, ROOT } from '../../tools/update-precache.mjs';

test('precache list contains the core files', () => {
  const list = listPrecache(ROOT);
  for (const f of ['./', './index.html', './manifest.webmanifest', './js/app.js', './css/app.css', './assets/objects/apple.webp', './assets/icons/icon-192.png']) {
    assert.ok(list.includes(f), f);
  }
  assert.ok(!list.some((f) => f.includes('tests/') || f.includes('tools/') || f.includes('node_modules')));
});

test('sw.js precache block is up to date', () => {
  const sw = readFileSync(new URL('../../sw.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const list = listPrecache(ROOT);
  assert.ok(sw.includes(renderBlock(computeVersion(ROOT, list), list)), 'Precache-Liste in sw.js ist veraltet – bitte "npm run precache" ausführen.');
});
