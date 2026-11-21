import { homedir } from "node:os";
import { join } from "node:path";

export type DriverKind = "blob" | "cosmos";

export interface CloudSessionsConfig {
  driver: DriverKind;
  endpoint: string;
  accountName: string;
  accountKey: string;
  containerName: string;
  cosmosEndpoint: string;
  cosmosKey: string;
  cosmosDatabase: string;
  cosmosContainer: string;
  localSessionsDir: string;
  pushOnSettle: boolean;
}

const AZURITE_ENDPOINT = "http://127.0.0.1:10000/devstoreaccount1";
const AZURITE_ACCOUNT_NAME = "devstoreaccount1";
const AZURITE_ACCOUNT_KEY =
  "Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==";

const COSMOS_EMULATOR_ENDPOINT = "http://localhost:8081";
const COSMOS_EMULATOR_KEY =
  "C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==";

function parseBoolFlag(value: string | undefined): boolean {
  return value === "1" || value === "true" || value === "yes";
}

function parseDriver(value: string | undefined): DriverKind {
  return value === "cosmos" ? "cosmos" : "blob";
}

export function loadConfig(env: Record<string, string | undefined> = process.env): CloudSessionsConfig {
  return {
    driver: parseDriver(env.CLOUD_SESSIONS_DRIVER),
    endpoint: env.CLOUD_SESSIONS_ENDPOINT ?? AZURITE_ENDPOINT,
    accountName: env.CLOUD_SESSIONS_ACCOUNT ?? AZURITE_ACCOUNT_NAME,
    accountKey: env.CLOUD_SESSIONS_KEY ?? AZURITE_ACCOUNT_KEY,
    containerName: env.CLOUD_SESSIONS_CONTAINER ?? "pi-sessions",
    cosmosEndpoint: env.CLOUD_SESSIONS_COSMOS_ENDPOINT ?? COSMOS_EMULATOR_ENDPOINT,
    cosmosKey: env.CLOUD_SESSIONS_COSMOS_KEY ?? COSMOS_EMULATOR_KEY,
    cosmosDatabase: env.CLOUD_SESSIONS_COSMOS_DATABASE ?? "pi-cloud-sync",
    cosmosContainer: env.CLOUD_SESSIONS_COSMOS_CONTAINER ?? "conversations",
    localSessionsDir: env.PI_SESSIONS_DIR ?? join(homedir(), ".pi", "agent", "sessions"),
    pushOnSettle: parseBoolFlag(env.CLOUD_SESSIONS_PUSH_ON_SETTLE),
  };
}
