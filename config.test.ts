import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

describe("loadConfig", () => {
  it("defaults to the blob driver and Azurite dev endpoint", () => {
    const config = loadConfig({});

    expect(config.driver).toBe("blob");
    expect(config.endpoint).toBe("http://127.0.0.1:10000/devstoreaccount1");
    expect(config.accountName).toBe("devstoreaccount1");
    expect(config.containerName).toBe("pi-sessions");
    expect(config.pushOnSettle).toBe(false);
  });

  it("defaults the cosmos driver to the emulator endpoint", () => {
    const config = loadConfig({});

    expect(config.cosmosEndpoint).toBe("http://localhost:8081");
    expect(config.cosmosDatabase).toBe("pi-cloud-sync");
    expect(config.cosmosContainer).toBe("conversations");
  });

  it("selects the cosmos driver from env", () => {
    expect(loadConfig({ CLOUD_SESSIONS_DRIVER: "cosmos" }).driver).toBe("cosmos");
    expect(loadConfig({ CLOUD_SESSIONS_DRIVER: "blob" }).driver).toBe("blob");
    expect(loadConfig({ CLOUD_SESSIONS_DRIVER: "something-else" }).driver).toBe("blob");
  });

  it("honours environment overrides", () => {
    const config = loadConfig({
      CLOUD_SESSIONS_ENDPOINT: "https://prodacct.blob.core.windows.net",
      CLOUD_SESSIONS_ACCOUNT: "prodacct",
      CLOUD_SESSIONS_KEY: "prodkey",
      CLOUD_SESSIONS_CONTAINER: "prod-sessions",
      PI_SESSIONS_DIR: "/custom/sessions",
    });

    expect(config.endpoint).toBe("https://prodacct.blob.core.windows.net");
    expect(config.accountName).toBe("prodacct");
    expect(config.accountKey).toBe("prodkey");
    expect(config.containerName).toBe("prod-sessions");
    expect(config.localSessionsDir).toBe("/custom/sessions");
  });

  it("parses the push-on-settle flag", () => {
    expect(loadConfig({ CLOUD_SESSIONS_PUSH_ON_SETTLE: "1" }).pushOnSettle).toBe(true);
    expect(loadConfig({ CLOUD_SESSIONS_PUSH_ON_SETTLE: "true" }).pushOnSettle).toBe(true);
    expect(loadConfig({ CLOUD_SESSIONS_PUSH_ON_SETTLE: "0" }).pushOnSettle).toBe(false);
    expect(loadConfig({}).pushOnSettle).toBe(false);
  });
});
