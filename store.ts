import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { ContainerClient, StorageSharedKeyCredential } from "@azure/storage-blob";
import type { CloudSessionsConfig } from "./config.js";

export interface RemoteBlob {
  path: string;
  lastModified: Date;
  size: number;
}

export interface BlobStore {
  ensureContainer(): Promise<void>;
  listBlobs(): Promise<RemoteBlob[]>;
  upload(localPath: string, remotePath: string): Promise<void>;
  download(remotePath: string, localPath: string): Promise<void>;
}

export function createAzureStore(config: CloudSessionsConfig): BlobStore {
  const containerClient = new ContainerClient(
    `${config.endpoint}/${config.containerName}`,
    new StorageSharedKeyCredential(config.accountName, config.accountKey),
  );

  return {
    async ensureContainer() {
      if (!(await containerClient.exists())) {
        await containerClient.create();
      }
    },

    async listBlobs() {
      const remoteBlobs: RemoteBlob[] = [];
      for await (const item of containerClient.listBlobsFlat()) {
        remoteBlobs.push({
          path: item.name,
          lastModified: item.properties.lastModified,
          size: item.properties.contentLength ?? 0,
        });
      }
      return remoteBlobs;
    },

    async upload(localPath, remotePath) {
      await containerClient.getBlockBlobClient(remotePath).uploadFile(localPath);
    },

    async download(remotePath, localPath) {
      mkdirSync(dirname(localPath), { recursive: true });
      await containerClient.getBlockBlobClient(remotePath).downloadToFile(localPath);
    },
  };
}

/** In-memory BlobStore for unit tests. */
export class InMemoryStore implements BlobStore {
  private blobs = new Map<string, { data: Buffer; lastModified: Date }>();

  seed(remotePath: string, data: Buffer, lastModified: Date): void {
    this.blobs.set(remotePath, { data, lastModified });
  }

  getBlobData(remotePath: string): Buffer | undefined {
    return this.blobs.get(remotePath)?.data;
  }

  async ensureContainer(): Promise<void> {}

  async listBlobs(): Promise<RemoteBlob[]> {
    return [...this.blobs.entries()].map(([path, blob]) => ({
      path,
      lastModified: blob.lastModified,
      size: blob.data.length,
    }));
  }

  async upload(localPath: string, remotePath: string): Promise<void> {
    this.blobs.set(remotePath, { data: readFileSync(localPath), lastModified: new Date() });
  }

  async download(remotePath: string, localPath: string): Promise<void> {
    const blob = this.blobs.get(remotePath);
    if (!blob) {
      throw new Error(`blob not found: ${remotePath}`);
    }

    mkdirSync(dirname(localPath), { recursive: true });
    writeFileSync(localPath, blob.data);
  }
}
