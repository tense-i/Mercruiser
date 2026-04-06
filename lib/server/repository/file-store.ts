import { promises as fs } from 'node:fs';
import path from 'node:path';

import { StudioWorkspaceSchema } from '@/lib/domain/schema';
import type { StudioWorkspace } from '@/lib/domain/types';

const DEFAULT_DATA_PATH = path.join(process.cwd(), 'data', 'studio.json');
const writeQueues = new Map<string, Promise<unknown>>();

export function resolveWorkspacePath(customPath?: string) {
  return customPath ?? process.env.MERCRUISER_DATA_PATH ?? DEFAULT_DATA_PATH;
}

export async function readWorkspace(dataPath?: string): Promise<StudioWorkspace> {
  const targetPath = resolveWorkspacePath(dataPath);
  const raw = await fs.readFile(targetPath, 'utf8');
  const parsed = JSON.parse(raw);
  return StudioWorkspaceSchema.parse(parsed);
}

export async function writeWorkspaceAtomic(workspace: StudioWorkspace, dataPath?: string) {
  const targetPath = resolveWorkspacePath(dataPath);
  const tempPath = `${targetPath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(tempPath, `${JSON.stringify(workspace, null, 2)}\n`, 'utf8');
  await fs.rename(tempPath, targetPath);
}

export async function mutateWorkspaceAtomically<T>(
  mutator: (workspace: StudioWorkspace) => Promise<T> | T,
  dataPath?: string,
): Promise<T> {
  const targetPath = resolveWorkspacePath(dataPath);
  const previous = writeQueues.get(targetPath) ?? Promise.resolve();
  const current = previous.then(async () => {
    const workspace = await readWorkspace(targetPath);
    const result = await mutator(workspace);
    await writeWorkspaceAtomic(workspace, targetPath);
    return result;
  });

  writeQueues.set(
    targetPath,
    current.catch(() => undefined),
  );

  try {
    return await current;
  } finally {
    if (writeQueues.get(targetPath) === current) {
      writeQueues.delete(targetPath);
    }
  }
}
