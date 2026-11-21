import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

describe("loadConfig", () => {
  it("defaults to the Azurite dev endpoint", () => {
    const config = loadConfig({});

    expect(config.endpoint).toBe("http://127.0.0.1:10000/devstoreaccount1");
    expect(config.accountName).toBe("devstoreaccount1");
    expect(config.containerName).toBe("pi-sessions");
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
});
