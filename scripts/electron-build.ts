/**
 * Electron build script
 *
 *  1. next build (standalone output)
 *  2. Copy .next/static + public into the standalone tree
 *  3. esbuild: bundle electron/main.ts → electron-dist/main.js
 */

import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const ROOT = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as {
  version: string;
};

// ── 1. Next.js build ─────────────────────────────────────────────────
console.log('🔨 Building Next.js (standalone)…');
execSync('npm run build', {
  cwd: ROOT,
  stdio: 'inherit',
  env: { ...process.env, NEXT_BUILD_STANDALONE: '1' },
});

// ── 2. Copy static assets into standalone tree ────────────────────────
// Next.js standalone puts the minimal server in .next/standalone/
// but does NOT copy static files — we must do it manually.
const standaloneDir = path.join(ROOT, '.next', 'standalone');
const staticSrc = path.join(ROOT, '.next', 'static');
const staticDest = path.join(standaloneDir, '.next', 'static');
const publicSrc = path.join(ROOT, 'public');
const publicDest = path.join(standaloneDir, 'public');

function copyDir(src: string, dest: string): void {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

console.log('📁 Copying static assets into standalone…');
copyDir(staticSrc, staticDest);
copyDir(publicSrc, publicDest);

// ── 3. Bundle Electron main process ──────────────────────────────────
console.log('⚡ Bundling Electron main process…');

const outDir = path.join(ROOT, 'electron-dist');
fs.mkdirSync(outDir, { recursive: true });

await esbuild.build({
  entryPoints: [path.join(ROOT, 'electron', 'main.ts')],
  bundle: true,
  minify: false,
  format: 'cjs',
  platform: 'node',
  target: 'node22',
  outfile: path.join(outDir, 'main.js'),
  allowOverwrite: true,
  external: ['electron'],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  tsconfig: path.join(ROOT, 'tsconfig.json'),
});

console.log('\n🎉 Electron build complete!');
console.log('   standalone : .next/standalone/');
console.log('   main       : electron-dist/main.js');
console.log('\nNext step: npm run electron:dist');
