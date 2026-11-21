import { appendTail, decidePull, decidePush, readLocalLines, writeLines } from "./lines.js";

export interface ConversationRef {
  id: string;
  revision: number;
}

export interface ConversationDriver {
  readonly kind: string;
  ensureReady(): Promise<void>;
  listConversations(): Promise<ConversationRef[]>;
  /** Overwrite the local file with the remote conversation if remote is ahead. */
  pull(ref: ConversationRef, localPath: string): Promise<boolean>;
  /** Upload the local file if it is ahead (full write for blob, tail append for cosmos). */
  push(id: string, ref: ConversationRef | null, localPath: string): Promise<boolean>;
}

/** In-memory driver mirroring the line-based (cosmos) semantics. For unit tests. */
export class InMemoryDriver implements ConversationDriver {
  readonly kind = "memory";
  private conversations = new Map<string, string[]>();

  seed(id: string, lines: string[]): void {
    this.conversations.set(id, [...lines]);
  }

  getLines(id: string): string[] | undefined {
    return this.conversations.get(id);
  }

  async ensureReady(): Promise<void> {}

  async listConversations(): Promise<ConversationRef[]> {
    return [...this.conversations.entries()].map(([id, lines]) => ({ id, revision: lines.length }));
  }

  async pull(ref: ConversationRef, localPath: string): Promise<boolean> {
    const remoteLines = this.conversations.get(ref.id) ?? [];
    if (decidePull(readLocalLines(localPath), remoteLines) !== "write") {
      return false;
    }

    writeLines(localPath, remoteLines);
    return true;
  }

  async push(id: string, ref: ConversationRef | null, localPath: string): Promise<boolean> {
    const localLines = readLocalLines(localPath);
    const remoteLines = ref ? (this.conversations.get(ref.id) ?? []) : null;
    const decision = decidePush(localLines, remoteLines);
    if (decision === "skip") {
      return false;
    }

    if (decision === "create") {
      this.conversations.set(id, [...localLines]);
    } else if (decision === "append") {
      const existing = this.conversations.get(id) ?? [];
      this.conversations.set(id, [...existing, ...appendTail(localLines, existing)]);
    } else {
      this.conversations.set(id, [...localLines]);
    }

    return true;
  }
}
