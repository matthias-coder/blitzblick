import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const svg = readFileSync(new URL('../assets/icons/icon.svg', import.meta.url), 'utf8');
const targets = [[192, 'icon-192.png'], [512, 'icon-512.png'], [180, 'apple-touch-icon.png']];
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [size, name] of targets) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:#6B42DE">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: fileURLToPath(new URL(`../assets/icons/${name}`, import.meta.url)) });
}
await browser.close();
console.log('Icons gerendert.');
