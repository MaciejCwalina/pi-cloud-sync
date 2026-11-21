import { homedir } from "node:os";
import { join } from "node:path";

export interface CloudSessionsConfig {
  endpoint: string;
  accountName: string;
  accountKey: string;
  containerName: string;
  localSessionsDir: string;
  pushOnSettle: boolean;
}

const AZURITE_ENDPOINT = "http://127.0.0.1:10000/devstoreaccount1";
const AZURITE_ACCOUNT_NAME = "devstoreaccount1";
const AZURITE_ACCOUNT_KEY =
  "Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==";

function parseBoolFlag(value: string | undefined): boolean {
  return value === "1" || value === "true" || value === "yes";
}

export function loadConfig(env: Record<string, string | undefined> = process.env): CloudSessionsConfig {
  return {
    endpoint: env.CLOUD_SESSIONS_ENDPOINT ?? AZURITE_ENDPOINT,
    accountName: env.CLOUD_SESSIONS_ACCOUNT ?? AZURITE_ACCOUNT_NAME,
    accountKey: env.CLOUD_SESSIONS_KEY ?? AZURITE_ACCOUNT_KEY,
    containerName: env.CLOUD_SESSIONS_CONTAINER ?? "pi-sessions",
    localSessionsDir: env.PI_SESSIONS_DIR ?? join(homedir(), ".pi", "agent", "sessions"),
    pushOnSettle: parseBoolFlag(env.CLOUD_SESSIONS_PUSH_ON_SETTLE),
  };
}
