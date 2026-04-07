import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { mkdir, writeFile, readFile } from 'node:fs/promises';

export const MEDIA_ROOT = join(homedir(), '.mercruiser', 'images');

export function localAssetImagePath(assetId: string, imageId: string): string {
  return join(MEDIA_ROOT, 'assets', assetId, `${imageId}.jpg`);
}

export function localShotImagePath(shotId: string, imageId: string): string {
  return join(MEDIA_ROOT, 'shots', shotId, `${imageId}.jpg`);
}

export function assetImageApiUrl(assetId: string, imageId: string): string {
  return `/api/media?path=assets/${assetId}/${imageId}.jpg`;
}

export function shotImageApiUrl(shotId: string, imageId: string): string {
  return `/api/media?path=shots/${shotId}/${imageId}.jpg`;
}

export async function saveImageBuffer(localPath: string, data: Buffer): Promise<void> {
  await mkdir(dirname(localPath), { recursive: true });
  await writeFile(localPath, data);
}

export function apiUrlToLocalPath(apiUrl: string): string | null {
  try {
    const u = new URL(apiUrl, 'http://localhost');
    const p = u.searchParams.get('path');
    return p ? join(MEDIA_ROOT, p) : null;
  } catch {
    return null;
  }
}

export async function readLocalImageAsBase64(apiUrl: string): Promise<string | null> {
  const localPath = apiUrlToLocalPath(apiUrl);
  if (!localPath) return null;
  try {
    const buf = await readFile(localPath);
    return `data:image/jpeg;base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}
