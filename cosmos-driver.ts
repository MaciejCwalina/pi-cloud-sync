import { CosmosClient, type Container, type PatchRequestBody } from "@azure/cosmos";
import type { CloudSessionsConfig } from "./config.js";
import type { ConversationDriver, ConversationRef } from "./drivers.js";
import { appendTail, decidePull, decidePush, readLocalLines, writeLines } from "./lines.js";

interface ConversationDoc {
  id: string;
  lines: string[];
  updatedAt: string;
}

/** Cosmos document ids cannot contain "/"; encode relative paths for storage. */
const toDocId = (id: string): string => encodeURIComponent(id);

export function createCosmosDriver(config: CloudSessionsConfig): ConversationDriver {
  const client = new CosmosClient({ endpoint: config.cosmosEndpoint, key: config.cosmosKey });
  let container: Container | null = null;

  const requireContainer = (): Container => {
    if (container === null) {
      throw new Error("cosmos driver not ready; call ensureReady first");
    }

    return container;
  };

  return {
    kind: "cosmos",

    async ensureReady() {
      const { database } = await client.databases.createIfNotExists({ id: config.cosmosDatabase });
      const { container: existingContainer } = await database.containers.createIfNotExists({
        id: config.cosmosContainer,
        partitionKey: { paths: ["/id"] },
      });
      container = existingContainer;
    },

    async listConversations() {
      const feed = await requireContainer().items.readAll().fetchAll();
      return feed.resources.map((doc) => {
        const conversation = doc as ConversationDoc;
        return { id: decodeURIComponent(conversation.id), revision: conversation.lines?.length ?? 0 };
      });
    },

    async pull(ref, localPath) {
      const response = await requireContainer().item(toDocId(ref.id), toDocId(ref.id)).read<ConversationDoc>();
      const remoteLines = response.resource?.lines ?? [];
      if (decidePull(readLocalLines(localPath), remoteLines) !== "write") {
        return false;
      }

      writeLines(localPath, remoteLines);
      return true;
    },

    async push(id, ref, localPath) {
      const localLines = readLocalLines(localPath);
      let remoteLines: string[] | null = null;
      if (ref !== null) {
        const response = await requireContainer().item(toDocId(id), toDocId(id)).read<ConversationDoc>();
        remoteLines = response.resource?.lines ?? [];
      }

      const decision = decidePush(localLines, remoteLines);
      if (decision === "skip") {
        return false;
      }

      const now = new Date().toISOString();
      const docId = toDocId(id);
      if (decision === "create") {
        await requireContainer().items.create({ id: docId, lines: localLines, updatedAt: now });
      } else if (decision === "append" && remoteLines !== null) {
        const patches: PatchRequestBody = appendTail(localLines, remoteLines).map((line) => ({
          op: "add",
          path: "/lines/-",
          value: line,
        }));
        patches.push({ op: "replace", path: "/updatedAt", value: now });
        await requireContainer().item(docId, docId).patch(patches);
      } else {
        await requireContainer().item(docId, docId).replace({ id: docId, lines: localLines, updatedAt: now });
      }

      return true;
    },
  };
}
