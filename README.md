# pi-cloud-sync

Pi extension that syncs pi session files (`~/.pi/agent/sessions`) to the cloud, so conversations follow you across devices. Two interchangeable drivers:

- **blob** (default) — Azure Blob Storage / Azurite. One blob per conversation, full-file transfers, mtime-based change detection.
- **cosmos** — Azure Cosmos DB (NoSQL) / emulator. One document per conversation; pushes append only the new JSONL tail to the document (true append, no full rewrite).

## Behavior

| Trigger | Action |
|---|---|
| `session_start` | pull: download remote conversations missing locally or ahead (fire-and-forget, never blocks startup) |
| `session_shutdown` | push: upload local files missing remotely or ahead |
| `agent_settled` *(opt-in)* | push after the agent finishes and no continuation is pending — i.e. when you stop typing |
| `/sync` | pull + push on demand |

### Conflict resolution

- **blob**: last-write-wins by mtime. Blob timestamps have second granularity, so differences within 1 s are treated as equal (prevents ping-pong transfers).
- **cosmos**: line-based. If one side extends the other, the longer wins (append/fast-forward). If histories diverged (same length, different lines, or non-prefix), the pushing side wins. Deletions are not propagated by either driver.

Blob layout mirrors the local tree, so `/resume` semantics survive a round trip:

```
pi-sessions/--home-maciej--/2026-10-30T02-44-53-...jsonl
```

Cosmos stores the same relative path percent-encoded as the document id (Cosmos ids cannot contain `/`), in a container partitioned by `/id`.

## Configuration

All via env vars; defaults point at the local emulators:

| Var | Default |
|---|---|
| `CLOUD_SESSIONS_DRIVER` | `blob` (`blob` \| `cosmos`) |
| `CLOUD_SESSIONS_ENDPOINT` | `http://127.0.0.1:10000/devstoreaccount1` (Azurite) |
| `CLOUD_SESSIONS_ACCOUNT` | `devstoreaccount1` |
| `CLOUD_SESSIONS_KEY` | (well-known Azurite key) |
| `CLOUD_SESSIONS_CONTAINER` | `pi-sessions` |
| `CLOUD_SESSIONS_COSMOS_ENDPOINT` | `http://localhost:8081` (emulator) |
| `CLOUD_SESSIONS_COSMOS_KEY` | (well-known emulator key) |
| `CLOUD_SESSIONS_COSMOS_DATABASE` | `pi-cloud-sync` |
| `CLOUD_SESSIONS_COSMOS_CONTAINER` | `conversations` |
| `PI_SESSIONS_DIR` | `~/.pi/agent/sessions` |
| `CLOUD_SESSIONS_PUSH_ON_SETTLE` | off (`1`/`true`/`yes` enables) |

Production example:

```bash
export CLOUD_SESSIONS_DRIVER="cosmos"
export CLOUD_SESSIONS_COSMOS_ENDPOINT="https://myacct.documents.azure.com"
export CLOUD_SESSIONS_COSMOS_KEY="<account key>"
```

## Local dev

```bash
docker compose up -d        # Azurite (:10000) + Cosmos emulator (:8081, explorer :1234)
npm install
npm test                    # unit tests (vitest, no network needed)
npm run typecheck
```

First start of the Cosmos emulator needs a writable data dir:

```bash
mkdir -p cosmos-data && chmod 777 cosmos-data   # container runs as non-root
```

Emulator health probe: `http://localhost:8080/ready`. Data Explorer: `http://localhost:1234`.

## Structure

- `index.ts` — thin pi glue: registers the hooks and `/sync`. Dependency-injected for testing.
- `sync.ts` — generic transfer logic (walk, list, fan-out to driver). No driver imports beyond the interface.
- `drivers.ts` — `ConversationDriver` interface + in-memory driver for tests.
- `blob-driver.ts` — Azure Blob adapter (mtime-based, full-file).
- `cosmos-driver.ts` — Cosmos adapter (line-based, tail append via patch).
- `lines.ts` — pure JSONL parse/format + push/pull decision functions (unit-tested).
- `config.ts` — env-var config resolution.
- `*.test.ts` — unit tests; the real SDK adapters are covered by manual smoke scripts against the emulators.
