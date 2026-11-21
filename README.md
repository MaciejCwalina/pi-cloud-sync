# cloud-sessions

Pi extension that syncs pi session files (`~/.pi/agent/sessions`) to Azure Blob Storage, so conversations follow you across devices.

## Behavior

| Trigger | Action |
|---|---|
| `session_start` | pull: download remote blobs missing locally or strictly newer (fire-and-forget, never blocks startup) |
| `session_shutdown` | push: upload local files missing remotely or strictly newer |
| `agent_settled` *(opt-in)* | push after the agent finishes and no continuation is pending — i.e. when you stop typing |
| `/sync` | pull + push on demand |

Conflicts resolve last-write-wins by mtime. Blob `lastModified` has second granularity, so differences within 1 s are treated as equal (prevents ping-pong transfers). Deletions are not propagated.

Blob layout mirrors the local tree, so `/resume` semantics survive a round trip:

```
pi-sessions/--home-maciej--/2026-10-30T02-44-53-...jsonl
```

## Configuration

All via env vars; defaults point at local Azurite:

| Var | Default |
|---|---|
| `CLOUD_SESSIONS_ENDPOINT` | `http://127.0.0.1:10000/devstoreaccount1` |
| `CLOUD_SESSIONS_ACCOUNT` | `devstoreaccount1` |
| `CLOUD_SESSIONS_KEY` | (well-known Azurite key) |
| `CLOUD_SESSIONS_CONTAINER` | `pi-sessions` |
| `PI_SESSIONS_DIR` | `~/.pi/agent/sessions` |
| `CLOUD_SESSIONS_PUSH_ON_SETTLE` | off (`1`/`true`/`yes` enables) |

Production example:

```bash
export CLOUD_SESSIONS_ENDPOINT="https://myacct.blob.core.windows.net"
export CLOUD_SESSIONS_ACCOUNT="myacct"
export CLOUD_SESSIONS_KEY="<storage account key>"
```

## Local dev

```bash
docker compose up -d        # Azurite on :10000, data persisted in ./azurite-data
npm install
npm test                    # unit tests (vitest, no network needed)
npm run typecheck
```

## Structure

- `index.ts` — thin pi glue: registers the hooks and `/sync`. Dependency-injected for testing.
- `sync.ts` — all transfer logic (walk, mtime diff, pull/push). Pure, no pi imports.
- `store.ts` — `BlobStore` interface, Azure SDK adapter, and an in-memory fake for tests.
- `config.ts` — env-var config resolution.
- `*.test.ts` — unit tests for all of the above; the Azure adapter itself is covered by the manual smoke test against Azurite.
