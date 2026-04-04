import { chromium } from 'playwright';

const base = process.env.BASE_URL || 'http://localhost:3003';
const artifactsDir = '/Users/zh/project/githubProj/Mercruiser/Mercruiser-web/artifacts';
const errors = [];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1512, height: 982 } });

const page = await context.newPage();
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`[console] ${page.url()} :: ${m.text()}`);
});
page.on('pageerror', (e) => {
  errors.push(`[pageerror] ${page.url()} :: ${e.message}`);
});

await page.goto(`${base}/series/glasshouse/episodes/e04/canvas?focus=node-storyboard-panel&panel=chat`, {
  waitUntil: 'networkidle',
});
await page.screenshot({ path: `${artifactsDir}/episode-canvas-initial-desktop.png`, fullPage: true });

await page.getByLabel('节点修改请求').fill('修复 Frame 02 角色服装一致性并保留门口逆光');
await page.getByRole('button', { name: '生成 Diff 预览' }).click();
await page.waitForTimeout(250);
await page.screenshot({ path: `${artifactsDir}/episode-canvas-diff-desktop.png`, fullPage: true });

await page.getByRole('button', { name: '应用变更' }).click();
await page.waitForTimeout(250);
await page.screenshot({ path: `${artifactsDir}/episode-canvas-applied-desktop.png`, fullPage: true });

await page.getByRole('button', { name: '回退上一快照' }).click();
await page.waitForTimeout(250);
await page.screenshot({ path: `${artifactsDir}/episode-canvas-rollback-desktop.png`, fullPage: true });

const queuePage = await context.newPage();
queuePage.on('console', (m) => {
  if (m.type() === 'error') errors.push(`[console] ${queuePage.url()} :: ${m.text()}`);
});
queuePage.on('pageerror', (e) => {
  errors.push(`[pageerror] ${queuePage.url()} :: ${e.message}`);
});

await queuePage.goto(`${base}/queue/Q-2170`, { waitUntil: 'networkidle' });
await queuePage.screenshot({ path: `${artifactsDir}/queue-task-canvas-link-desktop.png`, fullPage: true });

await queuePage.getByRole('link', { name: '打开画布' }).click();
await queuePage.waitForLoadState('networkidle');
await queuePage.screenshot({ path: `${artifactsDir}/queue-task-opened-canvas-desktop.png`, fullPage: true });

await queuePage.close();
await page.close();
await context.close();
await browser.close();

if (errors.length > 0) {
  console.log('ERRORS');
  for (const line of errors) {
    console.log(line);
  }
  process.exitCode = 1;
} else {
  console.log('NO_CONSOLE_ERRORS');
}
