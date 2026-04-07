import { app, BrowserWindow, protocol } from 'electron';
import path from 'path';
import fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
import http from 'http';
import net from 'net';

// ── speed up startup ──────────────────────────────────────────────────
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');

declare const __APP_VERSION__: string | undefined;

// ── find a free TCP port ──────────────────────────────────────────────
function findFreePort(start = 3710): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(start, '127.0.0.1', () => {
      const { port } = srv.address() as net.AddressInfo;
      srv.close(() => resolve(port));
    });
    srv.on('error', () => findFreePort(start + 1).then(resolve).catch(reject));
  });
}

// ── poll until Next.js server responds ───────────────────────────────
function waitForServer(port: number, timeout = 30_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeout;
    function poll() {
      http
        .get(`http://127.0.0.1:${port}/`, (res) => {
          res.resume();
          resolve();
        })
        .on('error', () => {
          if (Date.now() > deadline) reject(new Error('Next.js server startup timeout'));
          else setTimeout(poll, 400);
        });
    }
    poll();
  });
}

// ── copy seed studio.json to userData on first launch ────────────────
function initDataDir(): string {
  const userDataDir = path.join(app.getPath('userData'), 'data');
  const studioJson = path.join(userDataDir, 'studio.json');
  if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });
  if (!fs.existsSync(studioJson)) {
    const seed = app.isPackaged
      ? path.join(process.resourcesPath, 'data', 'studio.json')
      : path.join(process.cwd(), 'data', 'studio.json');
    if (fs.existsSync(seed)) fs.copyFileSync(seed, studioJson);
  }
  return studioJson;
}

// ── protocol for native window controls ──────────────────────────────
const SCHEME = 'mercruiser';
protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

// ─────────────────────────────────────────────────────────────────────
let mainWindow: BrowserWindow | null = null;
let loadingWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;

// Dark-themed inline loading screen
const loadingHtml = `data:text/html;charset=utf-8,${encodeURIComponent(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;
  background:#09090b;color:#a1a1aa;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  user-select:none;-webkit-app-region:drag}
.logo{font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.5px;margin-bottom:28px}
.logo span{color:#8b5cf6}
.spinner{width:36px;height:36px;border:3px solid rgba(139,92,246,.2);
  border-top-color:#8b5cf6;border-radius:50%;animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
p{margin-top:14px;font-size:12px;opacity:.4}
</style></head><body>
<div class="logo">Mer<span>cruiser</span></div>
<div class="spinner"></div>
<p>正在启动服务…</p>
</body></html>`)}`;

function showLoading(): void {
  loadingWindow = new BrowserWindow({
    width: 380,
    height: 240,
    frame: false,
    resizable: false,
    show: true,
    backgroundColor: '#09090b',
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
  });
  loadingWindow.setMenuBarVisibility(false);
  loadingWindow.removeMenu();
  loadingWindow.on('closed', () => { loadingWindow = null; });
  void loadingWindow.loadURL(loadingHtml);
}

function closeLoading(): void {
  if (loadingWindow && !loadingWindow.isDestroyed()) {
    loadingWindow.close();
    loadingWindow = null;
  }
}

function createMainWindow(url: string): Promise<void> {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 1440,
      height: 900,
      minWidth: 1080,
      minHeight: 640,
      show: false,
      backgroundColor: '#09090b',
      autoHideMenuBar: true,
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
      ...(process.platform !== 'darwin' && {
        titleBarOverlay: { color: '#09090b', symbolColor: '#71717a', height: 36 },
      }),
    });
    mainWindow = win;
    win.setMenuBarVisibility(false);
    win.removeMenu();
    win.on('closed', () => { mainWindow = null; });
    win.once('ready-to-show', () => { closeLoading(); win.show(); resolve(); });
    void win.loadURL(url);
  });
}

// ── app lifecycle ─────────────────────────────────────────────────────
app.whenReady().then(async () => {
  showLoading();

  try {
    const port = await findFreePort(3710);
    const dataJsonPath = initDataDir();

    // ── dev mode: Next.js dev server already running externally ──
    const devNextUrl = process.env.ELECTRON_DEV_NEXT_URL;
    let appUrl: string;

    if (devNextUrl) {
      console.log(`[mercruiser] dev mode — loading ${devNextUrl}`);
      appUrl = devNextUrl;
      await waitForServer(parseInt(new URL(devNextUrl).port || '3000', 10));
    } else {
      // Resolve Next.js standalone server
      const serverJs = app.isPackaged
        ? path.join((process as NodeJS.Process & { resourcesPath: string }).resourcesPath, 'nextapp', 'server.js')
        : path.join(process.cwd(), '.next', 'standalone', 'server.js');

      serverProcess = spawn(process.execPath, [serverJs], {
        env: {
          ...process.env,
          NODE_ENV: 'production',
          PORT: String(port),
          HOSTNAME: '127.0.0.1',
          MERCRUISER_DATA_PATH: dataJsonPath,
          MERCRUISER_AI_MODE: process.env.MERCRUISER_AI_MODE ?? 'mock',
        },
        stdio: 'inherit',
      });

      serverProcess.on('error', (err) => console.error('[mercruiser:server]', err));
      await waitForServer(port);
      appUrl = `http://127.0.0.1:${port}`;
    }

    // Register window-control protocol
    protocol.handle(SCHEME, (request: Request) => {
      const url = new URL(request.url);
      const cmd = url.hostname.toLowerCase();
      type Handler = () => object;
      const handlers: Record<string, Handler> = {
        minimize: () => { mainWindow?.minimize(); return { ok: true }; },
        maximize: () => {
          if (mainWindow?.isMaximized()) mainWindow.unmaximize();
          else mainWindow?.maximize();
          return { ok: true };
        },
        close: () => { setTimeout(() => app.exit(0), 100); return { ok: true }; },
        ismaximized: () => ({ maximized: mainWindow?.isMaximized() ?? false }),
        devtools: () => { mainWindow?.webContents.openDevTools(); return { ok: true }; },
        version: () => ({
          app: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : app.getVersion(),
        }),
      };
      const fn = handlers[cmd];
      return new Response(JSON.stringify(fn ? fn() : { error: 'unknown command' }), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      });
    });

    await createMainWindow(appUrl);
  } catch (err) {
    console.error('[mercruiser:startup]', err);
    closeLoading();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  // macOS: re-open main window when dock icon is clicked
  if (BrowserWindow.getAllWindows().length === 0) {
    const port = process.env.PORT ?? '3710';
    void createMainWindow(`http://127.0.0.1:${port}`);
  }
});

app.on('before-quit', () => {
  if (serverProcess && !serverProcess.killed) serverProcess.kill();
});
