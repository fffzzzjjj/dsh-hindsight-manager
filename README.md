# dsh-hindsight-manager

在 DeepSeek Harness（DSH）里管理本机 Hindsight 记忆：自动启停守护进程、引导式部署，以及浏览和搜索记忆库的页面。

*Manage the local Hindsight memory daemon from inside DeepSeek Harness.*

## 功能

- **随 DSH 启动、退出随停**：带重试和看门狗，DSH 关掉后不会残留守护进程。
- **引导式部署**：装集成 → 填密钥 → 选缓存目录 → 启动，缺哪步就显示哪步。
- **记忆库概况**：文档 / 事实 / 关联 / 观察数，语义搜索，最近文档。
- **记忆图谱**：实体共现图，默认聚焦高频实体，可切全图，点节点看相关记忆。
- **生长动画**：按记忆写入时间回放，滑杆可拖、可播放暂停。
- **库健康度**：最近写入/整理、待处理与失败操作，以及一次检索的耗时与返回量。
- **库参数**：召回 token 上限、预算策略、检索档位、重排、观察生成、自动整理、抽取模式。
- **清理**：疑似重复、长期未动、已失效三类列表；批量失效（两次确认、默认上限 100，可调），失效后可恢复。
- **多库切换**：下拉选择查看哪个记忆库（只影响查看，不影响写入）。
- 状态常驻侧栏、点击打开面板；无黑框启动；失效代理自动绕过。

## 安装

```powershell
git clone https://github.com/fffzzzjjj/dsh-hindsight-manager.git
dsh plugin --profile <你的 profile> add file:<克隆目录>
```

然后**重启 DSH**，侧栏会出现「本地记忆」。

更新时先 `remove` 再 `add`（pnpm 是复制不是软链），同样要重启：

```powershell
dsh plugin --profile <profile> remove dsh-hindsight-manager
dsh plugin --profile <profile> add file:<目录>
```

> 前置：`uv` 在 PATH 上；一个 DeepSeek API key。首次启动会下载约 500 MB 引擎和本地模型。

## 首次使用

点侧栏「本地记忆」，按页面上的快速开始走四步：

1. **安装记忆集成** —— 装完重启 DSH，会话里才会出现 `hindsight_*` 工具。
2. **填写模型密钥** —— 只存在本机 `~/.hindsight/profiles/coding-agent.env`，页面不回显。
3. **选择缓存目录**（可跳过）—— 想换盘就填绝对路径或用「浏览…」。
4. **启动守护进程** —— 首次要下载本地模型，可能几分钟；之后 20–40 秒。

四步完成后清单收成「环境就绪」。之后每次会话结束会自动写入记忆。

## 页面

- **概览**：概况数字、搜索、最近文档、设置、诊断信息。
- **图谱**：默认聚焦提及最高的实体（两跳）；点节点换焦点，点空白或 × 回全图；「最少提及」支持自定义；「生长动画」按时间回放；右侧列出该实体的记忆。
- **库健康度**：「测一次检索」用固定问题跑一次 recall，显示耗时 / 命中数 / 约多少 tokens，用来判断库变大后是否变慢。
- **库参数**：写进 Hindsight 库配置，对之后的检索和写入生效。
- **观察历史**：图谱右侧抽屉、清理页的「长期未动」列表里，观察旁边有「历史」，可看它被 consolidation 改写过的版本和来源。
- **清理**：三组指标（疑似重复 / 长期未动 / 已遗忘）+ 批量失效。选「失效」后从检索和图谱消失，可在「已遗忘」恢复；单次默认 100 条，可调，最多 500。
- **设置**：缓存目录、随 DSH 启动、左下角状态条、侧栏入口（也可在「插件 → 已安装插件 → 本地记忆」里改）。

## 配置

`<DSH_HOME>/storages/dsh-hindsight-manager/config.json`：

| 字段 | 作用 |
|---|---|
| `installDir` | 缓存和模型目录，空为系统默认 |
| `autoStart` | 随 DSH 启动守护进程 |
| `showFooterStatus` / `showSidebarEntry` | 左下角状态条 / 侧栏入口 |
| `bank` | 固定查看的库，空为自动 |
| `searchBudget` | 面板搜索和测速的档位：low / mid / high |

## 常见问题

| 现象 | 处理 |
|---|---|
| 「启动失败」，`Connection error` / `WinError 1225` | 系统代理指向了已关闭的端口。插件会自动改直连；仍失败就先恢复 VPN/代理再启动。 |
| 「启动中」超过 6 分钟 | 首次下载模型，看 `~/.hindsight/profiles/coding-agent.log`；失败会自动退避重试。 |
| 端口 9077 被占用 | `netstat -ano \| findstr :9077` 找到进程并关掉。 |
| 侧栏没有「本地记忆」 | 新装或升级后要重启 DSH。 |
| 会话里没有 `hindsight_*` 工具 | 集成装了但没重启 DSH。 |
| 搜索慢 | 把「检索档位」调到 low，或关掉重排（更快，相关性会差一些）。 |

日志 `~/.hindsight/profiles/coding-agent.log`，密钥 `~/.hindsight/profiles/coding-agent.env`。

## 限制

- 仅 Windows：进程管理用 `netstat` / `taskkill`。
- 搜索只走 recall，不调 reflect；暂不支持删除或导出文档。

## 许可

MIT。看门狗逻辑移植自 [Hua1Q1nG/dsh-hindsight-local-optimize](https://github.com/Hua1Q1nG/dsh-hindsight-local-optimize)，记忆引擎是 [Vectorize Hindsight](https://github.com/vectorize-io/hindsight)。

开发与测试：`npm test`。
