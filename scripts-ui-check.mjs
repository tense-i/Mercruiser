import { chromium } from 'playwright';

const base = process.env.BASE_URL || 'http://localhost:3000';
const pages = [
  ['workspace', '/workspace'],
  ['series', '/series/glasshouse'],
  ['episode', '/series/glasshouse/episodes/e04'],
  ['queue', '/queue'],
  ['settings', '/settings'],
];

const errors = [];

const browser = await chromium.launch({ headless: true });
const desktop = await browser.newContext({ viewport: { width: 1512, height: 982 } });

for (const [name, path] of pages) {
  const page = await desktop.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`[console] ${page.url()} :: ${m.text()}`);
  });
  page.on('pageerror', (e) => {
    errors.push(`[pageerror] ${page.url()} :: ${e.message}`);
  });
  await page.goto(base + path, { waitUntil: 'networkidle' });
  await page.screenshot({
    path: `/Users/zh/project/githubProj/Mercruiser/Mercruiser-web/artifacts/${name}-toonflow-style-desktop.png`,
    fullPage: true,
  });
  await page.close();
}

const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
for (const [name, path] of [
  ['workspace', '/workspace'],
  ['episode', '/series/glasshouse/episodes/e04'],
]) {
  const page = await mobile.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`[console] ${page.url()} :: ${m.text()}`);
  });
  page.on('pageerror', (e) => {
    errors.push(`[pageerror] ${page.url()} :: ${e.message}`);
  });
  await page.goto(base + path, { waitUntil: 'networkidle' });
  await page.screenshot({
    path: `/Users/zh/project/githubProj/Mercruiser/Mercruiser-web/artifacts/${name}-toonflow-style-mobile.png`,
    fullPage: true,
  });
  await page.close();
}

await mobile.close();
await desktop.close();
await browser.close();

if (errors.length) {
  console.log('ERRORS');
  for (const e of errors) console.log(e);
} else {
  console.log('NO_CONSOLE_ERRORS');
}
