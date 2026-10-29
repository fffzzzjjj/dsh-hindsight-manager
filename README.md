# dsh-hindsight-manager

[English](README.md) · [中文](README.zh-CN.md)

Manage the local Hindsight memory daemon from inside DeepSeek Harness: lifecycle, guided setup, and a page to browse and search the memory bank.

## Features

- **Starts with DSH, stops with DSH**: retries and a watchdog, so no daemon is left behind.
- **Guided setup**: install the integration → add a model key → pick a cache dir → start; only the missing step is shown.
- **Bank overview**: documents / facts / links / observations, semantic search, recent documents.
- **Memory graph**: entity co-occurrence graph; focused on the busiest entity by default, full graph on demand, click a node for its memories.
- **Growth replay**: replays the graph by memory write time, with a scrubber and play/pause.
- **Bank health**: last write/consolidation, pending and failed operations, plus a timed recall probe.
- **Bank settings**: recall token cap, budget strategy, retrieval tier, rerank, observations, auto consolidation, extraction mode.
- **Cleanup**: near-duplicates / untouched / observations / forgotten lists; bulk invalidation with two confirmations (default batch limit 100, adjustable); duplicate groups keep one copy by default.
- **Observation history**: click `observation` in the graph drawer or an observation row in cleanup to see versions written by consolidation and their sources.
- **Bank switching**: choose which bank to read (read-only; writes still follow the session workspace).
- Status chip in the sidebar; no console window; dead-proxy bypass.

## Install

```powershell
git clone https://github.com/fffzzzjjj/dsh-hindsight-manager.git
dsh plugin --profile <your profile> add file:<cloned dir>
```

Restart DSH; "Local Memory" appears in the sidebar.

## Update

There is no auto-update: `dsh plugin` simply forwards to pnpm, and a `file:` install has to be re-added:

```powershell
cd <cloned dir>
git pull
dsh plugin --profile <profile> remove dsh-hindsight-manager
dsh plugin --profile <profile> add file:<cloned dir>
```

Then restart DSH. Diagnostics shows the current version and a **Check for updates** button that compares against GitHub and prints these commands.

> For client-only (`client.js`) releases, reinstalling plus a page refresh (Ctrl+R) is enough; `index.js` changes require a DSH restart.

## First run

Open "Local Memory" and follow the four steps:

1. **Install the memory integration** (`@vectorize-io/hindsight-coding-agents`), then restart DSH so the `hindsight_*` tools appear.
2. **Add the model key** — stored only in `~/.hindsight/profiles/coding-agent.env`, never echoed back.
3. **Choose a cache directory** (optional) — an absolute path or the Browse… picker.
4. **Start the daemon** — the first start downloads local models (a few minutes); later starts take 20–40 s.

After that the checklist collapses into "Ready", and conversations are written to memory when they end.

## Pages

- **Overview**: stats, search, recent documents, settings, bank health, bank settings, diagnostics.
- **Graph**: focused on the busiest entity (two hops); click to refocus, blank area or × to return to the full graph; custom "min mentions"; growth replay; the drawer lists that entity's memories.
- **Cleanup**: four lists and bulk invalidation; restore from "Forgotten".
- **Usage**: token spend of the extraction/consolidation calls — today and for 24 h / 7 / 30 days, a bar chart with fixed-width bars (by hour for the 24-hour range, by day otherwise), split by operation and by model, plus the latest calls. Read from the daemon's `llm-requests` log; local embeddings and rerank cost nothing and are excluded. Cost is estimated from DeepSeek's published prices with the peak/idle difference applied per call — a calculation, not a bill.
- **Settings**: cache dir, start with DSH, footer status, sidebar entry (also on Plugins → Installed → Local Memory).

## Config

`<DSH_HOME>/storages/dsh-hindsight-manager/config.json`:

| Field | Meaning |
|---|---|
| `installDir` | cache/model directory; empty = system default |
| `autoStart` | start the daemon with DSH |
| `showFooterStatus` / `showSidebarEntry` | footer chip / sidebar entry |
| `bank` | pin a bank to read; empty = automatic |
| `searchBudget` | tier for the panel's search and probe: low / mid / high |

## FAQ

| Symptom | Fix |
|---|---|
| "Start failed" with `Connection error` / `WinError 1225` | The system proxy points at a closed port. The plugin bypasses it automatically; if it still fails, restore the VPN/proxy and retry. |
| "Starting" for over 6 minutes | First-run model download; check `~/.hindsight/profiles/coding-agent.log`; failures retry with backoff. |
| Port 9077 in use | `netstat -ano \| findstr :9077`, then stop that process. |
| No "Local Memory" entry | Restart DSH after install/update. |
| No `hindsight_*` tools in a session | The integration is installed but DSH was not restarted. |
| Slow search | Set the retrieval tier to low, or turn reranking off (faster, less relevant). |

## Limits

- Windows only: process management uses `netstat` / `taskkill`.
- Search uses recall only (no reflect); deleting or exporting documents is not supported yet.

## License

MIT. The watchdog logic is adapted from [Hua1Q1nG/dsh-hindsight-local-optimize](https://github.com/Hua1Q1nG/dsh-hindsight-local-optimize); the memory engine is [Vectorize Hindsight](https://github.com/vectorize-io/hindsight).
