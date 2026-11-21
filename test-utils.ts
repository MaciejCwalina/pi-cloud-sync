import { mkdirSync, mkdtempSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const scratchRoot = join(here, ".test-tmp");
mkdirSync(scratchRoot, { recursive: true });

/** Create a temp dir inside the project (never /tmp on this machine). */
export function makeTempDir(prefix: string): string {
  return mkdtempSync(join(scratchRoot, prefix));
}
