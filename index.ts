import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { loadConfig, type CloudSessionsConfig } from "./config.js";
import { createBlobDriver } from "./blob-driver.js";
import { createCosmosDriver } from "./cosmos-driver.js";
import type { ConversationDriver } from "./drivers.js";
import { pull, push } from "./sync.js";

export interface ExtensionDeps {
  loadConfig: () => CloudSessionsConfig;
  createDriver: (config: CloudSessionsConfig) => ConversationDriver;
}

function createDefaultDriver(config: CloudSessionsConfig): ConversationDriver {
  return config.driver === "cosmos" ? createCosmosDriver(config) : createBlobDriver(config);
}

interface NotifyContext {
  ui?: { notify?: (message: string, level?: "info" | "warning" | "error") => void };
}

export function createExtension(deps: ExtensionDeps = { loadConfig, createDriver: createDefaultDriver }) {
  const announce = (ctx: unknown, message: string, level: "info" | "error" = "info"): void => {
    const ui = (ctx as NotifyContext | undefined)?.ui;
    if (ui?.notify) {
      ui.notify(message, level);
    }
  };

  const runSync = async (direction: "pull" | "push", ctx: unknown): Promise<void> => {
    try {
      const config = deps.loadConfig();
      const driver = deps.createDriver(config);
      await driver.ensureReady();

      const result =
        direction === "pull"
          ? await pull(driver, config.localSessionsDir)
          : await push(driver, config.localSessionsDir);
      announce(
        ctx,
        `pi-cloud-sync [${driver.kind}]: ${direction}ed ${result.transferred.length} file(s), ${result.upToDate} up to date`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`pi-cloud-sync: ${direction} failed: ${message}`);
      announce(ctx, `pi-cloud-sync: ${direction} failed: ${message}`, "error");
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
      description: "Sync pi sessions with cloud storage",
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
