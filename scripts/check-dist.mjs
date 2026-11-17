import { existsSync, readFileSync, readdirSync } from 'node:fs';

function fail(message) {
  console.error(message);
  process.exit(1);
}

const html = readFileSync('dist/index.html', 'utf8');
for (const needle of [
  '/subscription-tracker/assets/',
  '/subscription-tracker/apple-touch-icon.png',
  '/subscription-tracker/manifest.webmanifest',
  'apple-mobile-web-app-capable',
  'viewport-fit=cover',
]) {
  if (!html.includes(needle)) fail(`index.html is missing ${needle}`);
}

const manifest = JSON.parse(readFileSync('dist/manifest.webmanifest', 'utf8'));
if (manifest.start_url !== '/subscription-tracker/') fail(`start_url is ${manifest.start_url}`);
if (manifest.scope !== '/subscription-tracker/') fail(`scope is ${manifest.scope}`);
if (manifest.display !== 'standalone') fail('manifest is not standalone');

for (const file of ['apple-touch-icon.png', 'pwa-192.png', 'pwa-512.png', 'maskable-512.png', 'favicon.svg', 'sw.js']) {
  if (!existsSync(`dist/${file}`)) fail(`dist/${file} was not built`);
}

const sw = readFileSync('dist/sw.js', 'utf8');
if (!sw.includes('NavigationRoute') || !sw.includes('index.html')) {
  fail('service worker is missing the offline navigation fallback');
}

const bundleName = readdirSync('dist/assets').find((name) => name.startsWith('index-') && name.endsWith('.js'));
if (!bundleName) fail('app bundle is missing');
const bundle = readFileSync(`dist/assets/${bundleName}`, 'utf8');
if (!bundle.includes('/subscription-tracker/sw.js')) fail('service worker is not registered under the project path');
if (!bundle.includes('/subscription-tracker/')) fail('service worker scope is missing the project path');

console.log('dist checks passed');
