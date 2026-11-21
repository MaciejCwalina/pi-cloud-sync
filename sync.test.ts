import { beforeEach, describe, expect, it } from "vitest";
import { mkdirSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { InMemoryStore } from "./store.js";
import { pull, push } from "./sync.js";
import { makeTempDir } from "./test-utils.js";

describe("sync", () => {
  let localRoot: string;
  let store: InMemoryStore;

  beforeEach(() => {
    localRoot = makeTempDir("sync-");
    store = new InMemoryStore();
  });

  describe("pull", () => {
    it("downloads missing remote files, creating directories", async () => {
      store.seed("--cwd--/session-a.jsonl", Buffer.from("line1\n"), new Date("2026-01-01T00:00:00Z"));

      const result = await pull(store, localRoot);

      expect(result.transferred).toEqual(["--cwd--/session-a.jsonl"]);
      expect(readFileSync(join(localRoot, "--cwd--/session-a.jsonl"), "utf8")).toBe("line1\n");
    });

    it("skips files that are up to date", async () => {
      const sameTime = new Date("2026-01-01T00:00:00Z");
      store.seed("session-a.jsonl", Buffer.from("old\n"), sameTime);
      writeFileSync(join(localRoot, "session-a.jsonl"), "old\n");
      utimesSync(join(localRoot, "session-a.jsonl"), sameTime, sameTime);

      const result = await pull(store, localRoot);

      expect(result.transferred).toEqual([]);
      expect(result.upToDate).toBe(1);
    });

    it("re-downloads when the remote copy is strictly newer", async () => {
      const localTime = new Date("2026-01-01T00:00:00Z");
      writeFileSync(join(localRoot, "session-a.jsonl"), "old\n");
      utimesSync(join(localRoot, "session-a.jsonl"), localTime, localTime);
      store.seed("session-a.jsonl", Buffer.from("new\n"), new Date("2026-01-01T00:00:05Z"));

      const result = await pull(store, localRoot);

      expect(result.transferred).toEqual(["session-a.jsonl"]);
      expect(readFileSync(join(localRoot, "session-a.jsonl"), "utf8")).toBe("new\n");
    });
  });

  describe("push", () => {
    it("uploads local files missing remotely", async () => {
      writeFileSync(join(localRoot, "session-a.jsonl"), "hello\n");

      const result = await push(store, localRoot);

      expect(result.transferred).toEqual(["session-a.jsonl"]);
      expect(store.getBlobData("session-a.jsonl")?.toString()).toBe("hello\n");
    });

    it("skips files whose remote copy is up to date", async () => {
      const sameTime = new Date("2026-01-01T00:00:00Z");
      writeFileSync(join(localRoot, "session-a.jsonl"), "same\n");
      utimesSync(join(localRoot, "session-a.jsonl"), sameTime, sameTime);
      store.seed("session-a.jsonl", Buffer.from("same\n"), sameTime);

      const result = await push(store, localRoot);

      expect(result.transferred).toEqual([]);
      expect(result.upToDate).toBe(1);
    });

    it("uploads when the local copy is strictly newer", async () => {
      const localTime = new Date("2026-01-01T00:00:05Z");
      writeFileSync(join(localRoot, "session-a.jsonl"), "newer\n");
      utimesSync(join(localRoot, "session-a.jsonl"), localTime, localTime);
      store.seed("session-a.jsonl", Buffer.from("older\n"), new Date("2026-01-01T00:00:00Z"));

      const result = await push(store, localRoot);

      expect(result.transferred).toEqual(["session-a.jsonl"]);
      expect(store.getBlobData("session-a.jsonl")?.toString()).toBe("newer\n");
    });
  });

  it("round-trips: push from one dir, pull into another", async () => {
    const sourceRoot = makeTempDir("source-");
    const targetRoot = makeTempDir("target-");
    mkdirSync(join(sourceRoot, "--cwd--"), { recursive: true });
    writeFileSync(join(sourceRoot, "--cwd--/a.jsonl"), "alpha\n");

    await push(store, sourceRoot);
    const result = await pull(store, targetRoot);

    expect(result.transferred).toHaveLength(1);
    expect(readFileSync(join(targetRoot, "--cwd--/a.jsonl"), "utf8")).toBe("alpha\n");
  });
});
