import { describe, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionContextLike } from "@earendil-works/pi-coding-agent";
import { createExtension } from "./index.js";
import { InMemoryDriver, type ConversationDriver } from "./drivers.js";
import type { CloudSessionsConfig } from "./config.js";
import { makeTempDir } from "./test-utils.js";

interface CapturedHandler {
  (event: unknown, ctx: ExtensionContextLike): unknown;
}

interface CapturedCommand {
  description: string;
  handler: (name: string | undefined, ctx: ExtensionContextLike) => unknown;
}

function mockPi() {
  const handlers = new Map<string, CapturedHandler>();
  const commands = new Map<string, CapturedCommand>();

  return {
    handlers,
    commands,
    pi: {
      on: (event: string, handler: CapturedHandler) => {
        handlers.set(event, handler);
      },
      registerCommand: (name: string, definition: CapturedCommand) => {
        commands.set(name, definition);
      },
    },
  };
}

function makeDeps(sessionsDir: string, driver: ConversationDriver, pushOnSettle = false) {
  const config: CloudSessionsConfig = {
    driver: "cosmos",
    endpoint: "http://127.0.0.1:10000/devstoreaccount1",
    accountName: "devstoreaccount1",
    accountKey: "test-key",
    containerName: "pi-sessions",
    cosmosEndpoint: "http://localhost:8081",
    cosmosKey: "test-key",
    cosmosDatabase: "pi-cloud-sync",
    cosmosContainer: "conversations",
    localSessionsDir: sessionsDir,
    pushOnSettle,
  };

  return { loadConfig: () => config, createDriver: () => driver };
}

describe("extension glue", () => {
  it("registers session hooks and the /sync command", () => {
    const { handlers, commands, pi } = mockPi();

    createExtension(makeDeps(makeTempDir("ext-"), new InMemoryDriver()))(pi);

    expect(handlers.has("session_start")).toBe(true);
    expect(handlers.has("session_shutdown")).toBe(true);
    expect(commands.has("sync")).toBe(true);
  });

  it("session_shutdown pushes local sessions to the driver", async () => {
    const sessionsDir = makeTempDir("sessions-");
    mkdirSync(join(sessionsDir, "--cwd--"), { recursive: true });
    writeFileSync(join(sessionsDir, "--cwd--/a.jsonl"), "alpha\n");
    const driver = new InMemoryDriver();
    const { handlers, pi } = mockPi();

    createExtension(makeDeps(sessionsDir, driver))(pi);
    const notify = vi.fn();

    await handlers.get("session_shutdown")!({}, { ui: { notify } });

    expect(driver.getLines("--cwd--/a.jsonl")).toEqual(["alpha"]);
    expect(notify).toHaveBeenCalledWith(expect.stringContaining("pushed 1"), "info");
  });

  it("session_start pulls remote sessions locally", async () => {
    const sessionsDir = makeTempDir("sessions-");
    const driver = new InMemoryDriver();
    driver.seed("--cwd--/a.jsonl", ["alpha"]);
    const { handlers, pi } = mockPi();

    createExtension(makeDeps(sessionsDir, driver))(pi);

    await handlers.get("session_start")!({}, { ui: {} });
    // session_start is fire-and-forget in production, so wait for the file
    await vi.waitFor(() => {
      expect(existsSync(join(sessionsDir, "--cwd--/a.jsonl"))).toBe(true);
    });

    expect(readFileSync(join(sessionsDir, "--cwd--/a.jsonl"), "utf8")).toBe("alpha\n");
  });

  it("swallows driver failures instead of throwing", async () => {
    const failingDriver: ConversationDriver = {
      kind: "failing",
      ensureReady: async () => {
        throw new Error("boom");
      },
      listConversations: async () => [],
      pull: async () => false,
      push: async () => false,
    };
    const { handlers, pi } = mockPi();

    createExtension(makeDeps(makeTempDir("sessions-"), failingDriver))(pi);
    const notify = vi.fn();

    await expect(handlers.get("session_shutdown")!({}, { ui: { notify } })).resolves.toBeUndefined();
    expect(notify).toHaveBeenCalledWith(expect.stringContaining("failed"), "error");
  });

  it("does not register agent_settled when push-on-settle is disabled", () => {
    const { handlers, pi } = mockPi();

    createExtension(makeDeps(makeTempDir("sessions-"), new InMemoryDriver()))(pi);

    expect(handlers.has("agent_settled")).toBe(false);
  });

  it("agent_settled pushes local sessions when push-on-settle is enabled", async () => {
    const sessionsDir = makeTempDir("sessions-");
    mkdirSync(join(sessionsDir, "--cwd--"), { recursive: true });
    writeFileSync(join(sessionsDir, "--cwd--/a.jsonl"), "alpha\n");
    const driver = new InMemoryDriver();
    const { handlers, pi } = mockPi();

    createExtension(makeDeps(sessionsDir, driver, true))(pi);

    await handlers.get("agent_settled")!({}, { ui: {} });
    // fire-and-forget in production, so wait for the upload
    await vi.waitFor(() => {
      expect(driver.getLines("--cwd--/a.jsonl")).toEqual(["alpha"]);
    });
  });
});
