/**
 * Dev launcher: bundles electron/main.ts then spawns Electron.
 * Run `npm run dev` first in a separate terminal so Next.js is on port 3000.
 */

import esbuild from 'esbuild';
import path from 'path';
import { spawn } from 'child_process';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const ROOT = process.cwd();

const outFile = path.join(ROOT, 'electron-dist', 'main.js');

const ctx = await esbuild.context({
  entryPoints: [path.join(ROOT, 'electron', 'main.ts')],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node22',
  outfile: outFile,
  allowOverwrite: true,
  external: ['electron'],
  define: { __APP_VERSION__: '"dev"' },
  tsconfig: path.join(ROOT, 'tsconfig.json'),
});

await ctx.rebuild();
console.log('✅ electron/main.ts bundled');

// Spawn electron pointing to this project root
// Expects `npm run dev` to already be running on port 3000
const electronBin = require.resolve('electron') as string;
const child = spawn(electronBin, ['.'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'development',
    // In dev mode, main.ts will skip spawning a Next.js server and
    // instead open http://localhost:3000 directly.
    ELECTRON_DEV_NEXT_URL: 'http://localhost:3000',
  },
});

child.on('close', (code) => {
  ctx.dispose();
  process.exit(code ?? 0);
});
