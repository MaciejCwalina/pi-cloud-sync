import { existsSync, mkdirSync, statSync } from "node:fs";
import { dirname } from "node:path";
import { ContainerClient, StorageSharedKeyCredential } from "@azure/storage-blob";
import type { CloudSessionsConfig } from "./config.js";
import type { ConversationDriver, ConversationRef } from "./drivers.js";

/**
 * Blob lastModified timestamps have second granularity, so treat
 * differences within this window as "equal" to avoid ping-pong transfers.
 */
const MTIME_EPSILON_MS = 1_000;

export function createBlobDriver(config: CloudSessionsConfig): ConversationDriver {
  const containerClient = new ContainerClient(
    `${config.endpoint}/${config.containerName}`,
    new StorageSharedKeyCredential(config.accountName, config.accountKey),
  );

  return {
    kind: "blob",

    async ensureReady() {
      if (!(await containerClient.exists())) {
        await containerClient.create();
      }
    },

    async listConversations() {
      const refs: ConversationRef[] = [];
      for await (const item of containerClient.listBlobsFlat()) {
        refs.push({ id: item.name, revision: item.properties.lastModified.getTime() });
      }

      return refs;
    },

    async pull(ref, localPath) {
      const localMtime = existsSync(localPath) ? statSync(localPath).mtimeMs : null;
      if (localMtime !== null && ref.revision - localMtime <= MTIME_EPSILON_MS) {
        return false;
      }

      mkdirSync(dirname(localPath), { recursive: true });
      await containerClient.getBlockBlobClient(ref.id).downloadToFile(localPath);
      return true;
    },

    async push(id, ref, localPath) {
      const localMtime = statSync(localPath).mtimeMs;
      if (ref !== null && localMtime - ref.revision <= MTIME_EPSILON_MS) {
        return false;
      }

      await containerClient.getBlockBlobClient(id).uploadFile(localPath);
      return true;
    },
  };
}
