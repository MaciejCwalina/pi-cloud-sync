import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/** Parse a JSONL file into lines (empty file -> empty array). */
export function parseLines(content: string): string[] {
  return content.split("\n").filter((line) => line.length > 0);
}

export function formatLines(lines: string[]): string {
  if (lines.length === 0) {
    return "";
  }

  return lines.join("\n") + "\n";
}

export function readLocalLines(localPath: string): string[] {
  if (!existsSync(localPath)) {
    return [];
  }

  return parseLines(readFileSync(localPath, "utf8"));
}

export function writeLines(localPath: string, lines: string[]): void {
  mkdirSync(dirname(localPath), { recursive: true });
  writeFileSync(localPath, formatLines(lines));
}

export function isPrefix(prefix: string[], candidate: string[]): boolean {
  if (prefix.length > candidate.length) {
    return false;
  }

  for (let index = 0; index < prefix.length; index += 1) {
    if (prefix[index] !== candidate[index]) {
      return false;
    }
  }

  return true;
}

/** Should the local copy be overwritten with the remote lines? */
export function decidePull(localLines: string[], remoteLines: string[]): "skip" | "write" {
  return remoteLines.length > localLines.length ? "write" : "skip";
}

export type PushDecision = "skip" | "create" | "append" | "replace";

/** How to sync local lines to remote (null = no remote document yet). */
export function decidePush(localLines: string[], remoteLines: string[] | null): PushDecision {
  if (remoteLines === null) {
    return localLines.length > 0 ? "create" : "skip";
  }

  if (localLines.length <= remoteLines.length) {
    return isPrefix(localLines, remoteLines) ? "skip" : "replace";
  }

  if (isPrefix(remoteLines, localLines)) {
    return "append";
  }

  // Diverged histories: local wins (last-write-wins).
  return "replace";
}

/** The local lines that are not yet present remotely. */
export function appendTail(localLines: string[], remoteLines: string[]): string[] {
  return localLines.slice(remoteLines.length);
}
