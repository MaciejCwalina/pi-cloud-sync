import { existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import type { ConversationDriver } from "./drivers.js";

export interface SyncResult {
  transferred: string[];
  upToDate: number;
}

function collectLocalFiles(rootDir: string): string[] {
  const localFiles: string[] = [];

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const entryPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(entryPath);
      } else if (entry.isFile()) {
        localFiles.push(relative(rootDir, entryPath));
      }
    }
  };

  if (existsSync(rootDir)) {
    walk(rootDir);
  }

  return localFiles;
}

/** Download remote conversations that are ahead of their local copies. */
export async function pull(driver: ConversationDriver, rootDir: string): Promise<SyncResult> {
  const refs = await driver.listConversations();
  const transferred: string[] = [];
  let upToDate = 0;

  for (const ref of refs) {
    if (await driver.pull(ref, join(rootDir, ref.id))) {
      transferred.push(ref.id);
    } else {
      upToDate += 1;
    }
  }

  return { transferred, upToDate };
}

/** Upload local files that are ahead of their remote copies. */
export async function push(driver: ConversationDriver, rootDir: string): Promise<SyncResult> {
  const refs = await driver.listConversations();
  const refById = new Map(refs.map((ref) => [ref.id, ref]));
  const transferred: string[] = [];
  let upToDate = 0;

  for (const relativePath of collectLocalFiles(rootDir)) {
    const ref = refById.get(relativePath) ?? null;
    if (await driver.push(relativePath, ref, join(rootDir, relativePath))) {
      transferred.push(relativePath);
    } else {
      upToDate += 1;
    }
  }

  return { transferred, upToDate };
}
