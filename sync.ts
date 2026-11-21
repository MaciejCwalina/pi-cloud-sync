import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import type { BlobStore } from "./store.js";

/**
 * Blob lastModified timestamps have second granularity, so treat
 * differences within this window as "equal" to avoid ping-pong transfers.
 */
export const MTIME_EPSILON_MS = 1_000;

export interface SyncResult {
  transferred: string[];
  upToDate: number;
}

function collectLocalFiles(rootDir: string): Map<string, Date> {
  const localFiles = new Map<string, Date>();

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const entryPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(entryPath);
      } else if (entry.isFile()) {
        localFiles.set(relative(rootDir, entryPath), statSync(entryPath).mtime);
      }
    }
  };

  if (existsSync(rootDir)) {
    walk(rootDir);
  }

  return localFiles;
}

/** Download remote blobs that are missing locally or strictly newer. */
export async function pull(store: BlobStore, rootDir: string): Promise<SyncResult> {
  const remoteBlobs = await store.listBlobs();
  const transferred: string[] = [];
  let upToDate = 0;

  for (const remoteBlob of remoteBlobs) {
    const localPath = join(rootDir, remoteBlob.path);
    const localMtime = existsSync(localPath) ? statSync(localPath).mtime : null;
    if (localMtime !== null && remoteBlob.lastModified.getTime() - localMtime.getTime() <= MTIME_EPSILON_MS) {
      upToDate += 1;
      continue;
    }

    mkdirSync(dirname(localPath), { recursive: true });
    await store.download(remoteBlob.path, localPath);
    transferred.push(remoteBlob.path);
  }

  return { transferred, upToDate };
}

/** Upload local files that are missing remotely or strictly newer. */
export async function push(store: BlobStore, rootDir: string): Promise<SyncResult> {
  const remoteBlobs = await store.listBlobs();
  const remoteMtimes = new Map(remoteBlobs.map((remoteBlob) => [remoteBlob.path, remoteBlob.lastModified]));
  const localFiles = collectLocalFiles(rootDir);
  const transferred: string[] = [];
  let upToDate = 0;

  for (const [relativePath, localMtime] of localFiles) {
    const remoteMtime = remoteMtimes.get(relativePath);
    if (remoteMtime !== undefined && localMtime.getTime() - remoteMtime.getTime() <= MTIME_EPSILON_MS) {
      upToDate += 1;
      continue;
    }

    await store.upload(join(rootDir, relativePath), relativePath);
    transferred.push(relativePath);
  }

  return { transferred, upToDate };
}
