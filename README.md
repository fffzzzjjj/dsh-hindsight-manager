# dsh-hindsight-manager

在 DeepSeek Harness（DSH）里管理本机 Hindsight 记忆：自动启停守护进程、引导式部署，以及浏览和搜索记忆库的页面。  
Manage the local Hindsight memory daemon from inside DeepSeek Harness: lifecycle, guided setup, and a page to browse and search the memory bank.

---

## 中文

### 功能

- **随 DSH 启动、退出随停**：带重试和看门狗，DSH 关掉后不会残留守护进程。
- **引导式部署**：装集成 → 填密钥 → 选缓存目录 → 启动，缺哪步就显示哪步。
- **记忆库概况**：文档 / 事实 / 关联 / 观察数，语义搜索，最近文档。
- **记忆图谱**：实体共现图，默认聚焦高频实体，可切全图，点节点看相关记忆。
- **生长动画**：按记忆写入时间回放，滑杆可拖、可播放暂停。
- **库健康度**：最近写入/整理、待处理与失败操作，以及一次检索的耗时与返回量。
- **库参数**：召回 token 上限、预算策略、检索档位、重排、观察生成、自动整理、抽取模式。
- **清理**：疑似重复 / 长期未动 / 观察 / 已遗忘四组列表；批量失效（两次确认、默认上限 100，可调），重复组默认每组保留一条。
- **观察历史**：图谱抽屉里点 `observation`、清理页里点观察那一行，可看它被 consolidation 改写过的版本和来源。
- **多库切换**：下拉选择查看哪个记忆库（只影响查看，不影响写入）。
- 状态常驻侧栏；无黑框启动；失效代理自动绕过。

### 安装

```powershell
git clone https://github.com/fffzzzjjj/dsh-hindsight-manager.git
dsh plugin --profile <你的 profile> add file:<克隆目录>
```

重启 DSH，侧栏会出现「本地记忆」。

### 更新

插件没有自动更新，`dsh plugin` 只是把 pnpm 转发到 profile 目录；`file:` 安装需要重新装一次：

```powershell
cd <克隆目录>
git pull
dsh plugin --profile <profile> remove dsh-hindsight-manager
dsh plugin --profile <profile> add file:<克隆目录>
```

然后重启 DSH。页面「诊断信息」里有当前版本和「检查更新」，会与 GitHub 上的版本比较并给出上面的命令。

> 只改了 `client.js` 的版本，重装后刷新页面（Ctrl+R）即可；改了 `index.js` 必须重启。

### 首次使用

打开侧栏「本地记忆」，按页面上的快速开始走四步：

1. **安装记忆集成**（`@vectorize-io/hindsight-coding-agents`）——装完重启 DSH，会话里才有 `hindsight_*` 工具。
2. **填写模型密钥**——只存本机 `~/.hindsight/profiles/coding-agent.env`，页面不回显。
3. **选择缓存目录**（可跳过）——换盘就填绝对路径或用「浏览…」。
4. **启动守护进程**——首次要下载本地模型，可能几分钟；之后 20–40 秒。

四步完成后清单收成「环境就绪」。之后每次会话结束会自动写入记忆。

### 页面

- **概览**：概况数字、搜索、最近文档、设置、库健康度、库参数、诊断。
- **图谱**：默认聚焦提及最高的实体（两跳）；点节点换焦点，点空白或 × 回全图；「最少提及」支持自定义；「生长动画」按时间回放；右侧列出该实体的记忆。
- **清理**：四组列表 + 批量失效；「已遗忘」里可恢复。
- **设置**：缓存目录、随 DSH 启动、左下角状态条、侧栏入口（也可在「插件 → 已安装插件 → 本地记忆」里改）。

### 配置

`<DSH_HOME>/storages/dsh-hindsight-manager/config.json`：

| 字段 | 作用 |
|---|---|
| `installDir` | 缓存和模型目录，空为系统默认 |
| `autoStart` | 随 DSH 启动守护进程 |
| `showFooterStatus` / `showSidebarEntry` | 左下角状态条 / 侧栏入口 |
| `bank` | 固定查看的库，空为自动 |
| `searchBudget` | 面板搜索和测速的档位：low / mid / high |

### 常见问题

| 现象 | 处理 |
|---|---|
| 「启动失败」，`Connection error` / `WinError 1225` | 系统代理指向了已关闭的端口。插件会自动改直连；仍失败就先恢复 VPN/代理再启动。 |
| 「启动中」超过 6 分钟 | 首次下载模型，看 `~/.hindsight/profiles/coding-agent.log`；失败会自动退避重试。 |
| 端口 9077 被占用 | `netstat -ano \| findstr :9077` 找到进程并关掉。 |
| 侧栏没有「本地记忆」 | 新装或升级后要重启 DSH。 |
| 会话里没有 `hindsight_*` 工具 | 集成装了但没重启 DSH。 |
| 搜索慢 | 把「检索档位」调到 low，或关掉重排（更快，相关性会差一些）。 |

### 限制

- 仅 Windows：进程管理用 `netstat` / `taskkill`。
- 搜索只走 recall，不调 reflect；暂不支持删除或导出文档。

### 许可

MIT。看门狗逻辑移植自 [Hua1Q1nG/dsh-hindsight-local-optimize](https://github.com/Hua1Q1nG/dsh-hindsight-local-optimize)，记忆引擎是 [Vectorize Hindsight](https://github.com/vectorize-io/hindsight)。

---

## English

### Features

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

### Install

```powershell
git clone https://github.com/fffzzzjjj/dsh-hindsight-manager.git
dsh plugin --profile <your profile> add file:<cloned dir>
```

Restart DSH; "Local Memory" appears in the sidebar.

### Update

There is no auto-update: `dsh plugin` simply forwards to pnpm, and a `file:` install has to be re-added:

```powershell
cd <cloned dir>
git pull
dsh plugin --profile <profile> remove dsh-hindsight-manager
dsh plugin --profile <profile> add file:<cloned dir>
```

Then restart DSH. Diagnostics shows the current version and a **Check for updates** button that compares against GitHub and prints these commands.

> For client-only (`client.js`) releases, reinstalling plus a page refresh (Ctrl+R) is enough; `index.js` changes require a DSH restart.

### First run

Open "Local Memory" and follow the four steps:

1. **Install the memory integration** (`@vectorize-io/hindsight-coding-agents`), then restart DSH so the `hindsight_*` tools appear.
2. **Add the model key** — stored only in `~/.hindsight/profiles/coding-agent.env`, never echoed back.
3. **Choose a cache directory** (optional) — an absolute path or the Browse… picker.
4. **Start the daemon** — the first start downloads local models (a few minutes); later starts take 20–40 s.

After that the checklist collapses into "Ready", and conversations are written to memory when they end.

### Pages

- **Overview**: stats, search, recent documents, settings, bank health, bank settings, diagnostics.
- **Graph**: focused on the busiest entity (two hops); click to refocus, blank area or × to return to the full graph; custom "min mentions"; growth replay; the drawer lists that entity's memories.
- **Cleanup**: four lists and bulk invalidation; restore from "Forgotten".
- **Settings**: cache dir, start with DSH, footer status, sidebar entry (also on Plugins → Installed → Local Memory).

### Config

`<DSH_HOME>/storages/dsh-hindsight-manager/config.json`:

| Field | Meaning |
|---|---|
| `installDir` | cache/model directory; empty = system default |
| `autoStart` | start the daemon with DSH |
| `showFooterStatus` / `showSidebarEntry` | footer chip / sidebar entry |
| `bank` | pin a bank to read; empty = automatic |
| `searchBudget` | tier for the panel's search and probe: low / mid / high |

### FAQ

| Symptom | Fix |
|---|---|
| "Start failed" with `Connection error` / `WinError 1225` | The system proxy points at a closed port. The plugin bypasses it automatically; if it still fails, restore the VPN/proxy and retry. |
| "Starting" for over 6 minutes | First-run model download; check `~/.hindsight/profiles/coding-agent.log`; failures retry with backoff. |
| Port 9077 in use | `netstat -ano \| findstr :9077`, then stop that process. |
| No "Local Memory" entry | Restart DSH after install/update. |
| No `hindsight_*` tools in a session | The integration is installed but DSH was not restarted. |
| Slow search | Set the retrieval tier to low, or turn reranking off (faster, less relevant). |

### Limits

- Windows only: process management uses `netstat` / `taskkill`.
- Search uses recall only (no reflect); deleting or exporting documents is not supported yet.

### License

MIT. The watchdog logic is adapted from [Hua1Q1nG/dsh-hindsight-local-optimize](https://github.com/Hua1Q1nG/dsh-hindsight-local-optimize); the memory engine is [Vectorize Hindsight](https://github.com/vectorize-io/hindsight).
