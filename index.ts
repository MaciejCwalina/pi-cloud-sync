import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { loadConfig, type CloudSessionsConfig } from "./config.js";
import { createAzureStore, type BlobStore } from "./store.js";
import { pull, push } from "./sync.js";

export interface ExtensionDeps {
  loadConfig: () => CloudSessionsConfig;
  createStore: (config: CloudSessionsConfig) => BlobStore;
}

interface NotifyContext {
  ui?: { notify?: (message: string, level?: "info" | "warning" | "error") => void };
}

export function createExtension(deps: ExtensionDeps = { loadConfig, createStore: createAzureStore }) {
  const announce = (ctx: unknown, message: string, level: "info" | "error" = "info"): void => {
    const ui = (ctx as NotifyContext | undefined)?.ui;
    if (ui?.notify) {
      ui.notify(message, level);
    }
  };

  const runSync = async (direction: "pull" | "push", ctx: unknown): Promise<void> => {
    try {
      const config = deps.loadConfig();
      const store = deps.createStore(config);
      await store.ensureContainer();

      const result =
        direction === "pull"
          ? await pull(store, config.localSessionsDir)
          : await push(store, config.localSessionsDir);
      announce(ctx, `cloud-sessions: ${direction}ed ${result.transferred.length} file(s), ${result.upToDate} up to date`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`cloud-sessions: ${direction} failed: ${message}`);
      announce(ctx, `cloud-sessions: ${direction} failed: ${message}`, "error");
    }
  };

  return function cloudSessionsExtension(pi: ExtensionAPI): void {
    const config = deps.loadConfig();

    pi.on("session_start", async (_event, ctx) => {
      void runSync("pull", ctx);
    });

    pi.on("session_shutdown", async (_event, ctx) => {
      await runSync("push", ctx);
    });

    if (config.pushOnSettle) {
      pi.on("agent_settled", async (_event, ctx) => {
        void runSync("push", ctx);
      });
    }

    pi.registerCommand("sync", {
      description: "Sync pi sessions with cloud blob storage",
      handler: async (_name, ctx) => {
        await runSync("pull", ctx);
        await runSync("push", ctx);
      },
    });
  };
}

export default function (pi: ExtensionAPI): void {
  createExtension()(pi);
}
