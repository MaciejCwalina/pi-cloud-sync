import { beforeEach, describe, expect, it } from "vitest";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { InMemoryDriver } from "./drivers.js";
import { pull, push } from "./sync.js";
import { makeTempDir } from "./test-utils.js";

describe("sync", () => {
  let localRoot: string;
  let driver: InMemoryDriver;

  beforeEach(() => {
    localRoot = makeTempDir("sync-");
    driver = new InMemoryDriver();
  });

  describe("pull", () => {
    it("downloads missing remote conversations, creating directories", async () => {
      driver.seed("--cwd--/session-a.jsonl", ["line1", "line2"]);

      const result = await pull(driver, localRoot);

      expect(result.transferred).toEqual(["--cwd--/session-a.jsonl"]);
      expect(readFileSync(join(localRoot, "--cwd--/session-a.jsonl"), "utf8")).toBe("line1\nline2\n");
    });

    it("skips conversations that are up to date", async () => {
      driver.seed("session-a.jsonl", ["old"]);
      writeFileSync(join(localRoot, "session-a.jsonl"), "old\n");

      const result = await pull(driver, localRoot);

      expect(result.transferred).toEqual([]);
      expect(result.upToDate).toBe(1);
    });

    it("writes the local copy when the remote conversation is ahead", async () => {
      writeFileSync(join(localRoot, "session-a.jsonl"), "old\n");
      driver.seed("session-a.jsonl", ["old", "newer"]);

      const result = await pull(driver, localRoot);

      expect(result.transferred).toEqual(["session-a.jsonl"]);
      expect(readFileSync(join(localRoot, "session-a.jsonl"), "utf8")).toBe("old\nnewer\n");
    });
  });

  describe("push", () => {
    it("creates remote conversations for local files", async () => {
      writeFileSync(join(localRoot, "session-a.jsonl"), "hello\nworld\n");

      const result = await push(driver, localRoot);

      expect(result.transferred).toEqual(["session-a.jsonl"]);
      expect(driver.getLines("session-a.jsonl")).toEqual(["hello", "world"]);
    });

    it("skips files whose remote copy is up to date", async () => {
      writeFileSync(join(localRoot, "session-a.jsonl"), "same\n");
      driver.seed("session-a.jsonl", ["same"]);

      const result = await push(driver, localRoot);

      expect(result.transferred).toEqual([]);
      expect(result.upToDate).toBe(1);
    });

    it("appends only the new tail when the local copy is ahead", async () => {
      writeFileSync(join(localRoot, "session-a.jsonl"), "old\nnewer\n");
      driver.seed("session-a.jsonl", ["old"]);

      const result = await push(driver, localRoot);

      expect(result.transferred).toEqual(["session-a.jsonl"]);
      expect(driver.getLines("session-a.jsonl")).toEqual(["old", "newer"]);
    });
  });

  it("round-trips: push from one dir, pull into another", async () => {
    const sourceRoot = makeTempDir("source-");
    const targetRoot = makeTempDir("target-");
    mkdirSync(join(sourceRoot, "--cwd--"), { recursive: true });
    writeFileSync(join(sourceRoot, "--cwd--/a.jsonl"), "alpha\nbeta\n");

    await push(driver, sourceRoot);
    const result = await pull(driver, targetRoot);

    expect(result.transferred).toHaveLength(1);
    expect(readFileSync(join(targetRoot, "--cwd--/a.jsonl"), "utf8")).toBe("alpha\nbeta\n");
  });
});
