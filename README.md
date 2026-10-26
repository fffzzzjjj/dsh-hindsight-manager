# dsh-hindsight-manager

在 DeepSeek Harness（DSH）里管理本机 **Hindsight 本地记忆**：守护进程的启停、看门狗、缓存位置，以及一个浏览 / 搜索本仓库记忆库的整页界面。

Manage the local [Hindsight](https://hindsight.vectorize.io) memory daemon from inside DeepSeek Harness — lifecycle, watchdog, cache location, and a page to browse and search this repository's memory bank.

---

## 它解决什么问题

[`@vectorize-io/hindsight-coding-agents`](https://www.npmjs.com/package/@vectorize-io/hindsight-coding-agents) 把记忆指向本机 `127.0.0.1:9077`，但在 **DSH 桌面端**它不负责把守护进程拉起来，也没有界面。于是有三个缺口：

1. **守护进程不自动启动** —— 选「本地」模式后，9077 上没人值班，记忆等于没生效。
2. **看不到状态，也没法操作** —— 不知道它在不在跑、占了多少、记忆库里有什么。
3. **关掉 DSH 后进程还在** —— 守护进程是 detach 的，会一直占着约 1 GB 内存。

本插件把这三件事一次补齐，并且**只做一个生命周期所有者**。

## 功能

| | |
|---|---|
| **随 DSH 启动** | 启动时自动拉起守护进程，带重试；失败原因直接显示在页面上 |
| **退出随停** | 独立看门狗进程盯着 DSH 主进程，DSH 一退就停掉守护进程并释放内存 |
| **状态只读** | 运行状态是**不可点击**的文字 + 颜色点。启动和停止是**两个独立按钮**，各自在不适用的状态下禁用 |
| **记忆库概况** | 文档数、事实数、关联数、观察数 |
| **库健康度** | 最近写入/整理时间、待处理与失败操作、事实构成，以及「测一次检索」的耗时/命中数/约多少 token |
| **库参数** | 召回 token 上限、预算策略（固定/自适应）、重排开关、观察生成、自动整理、抽取模式——写进 Hindsight 库配置，可随时改回 |
| **选择记忆库** | 「记忆库」卡片里可以直接切换查看哪个库（自动/医药集团/DSH/…）；切换只影响查看，写记忆仍按会话工作区走 |
| **记忆图谱** | 实体共现图：默认聚焦最高频实体、两跳径向；可切「全图」看整张网络；点节点在右侧列出它的记忆 |
| **搜索记忆** | 语义检索（recall），结果就地展示 |
| **文档列表** | 最近 20 篇，含字符数、事实数、写入距今 |
| **缓存可搬家** | 设置里填一个绝对路径，就能把 uv 缓存和本地模型放到别的盘 |
| **引导式部署** | 页面上四步走：装记忆集成 → 填模型密钥 → 选缓存目录 → 启动守护进程；缺什么就只显示那一步的按钮 |
| **侧栏常驻状态** | 用户头像上方常驻「● 本地记忆 · 运行中/启动中/自动重试中/失败」，点一下直接打开面板 |
| **缓存目录浏览** | 设置里的「浏览…」拉起系统文件夹选择框，不用手抄路径 |
| **无黑框启动** | 守护进程以隐藏控制台方式启动，不再弹出黑色命令行窗口 |
| **启动失败自愈** | 网络 / 代理 / 端口占用这类瞬时失败按 5s→5min 退避自动重试，并显示倒计时 |
| **失效代理自动绕过** | 检测到系统代理指向已关闭的端口时，守护进程对 LLM 直连（Python 会读注册表代理，curl 不会） |

### 为什么状态不做成开关

最初的实现把状态和动作合成了一个控件，显示「运行中」的按钮点下去是**停止**。结果是「看一眼现在什么状态」和「关掉它」长得完全一样——实测被误点关掉、又点回来，还因此多生成了一个看门狗进程。

所以这里的状态**永远点不动**，动作只出现在明确的「启动」「停止」按钮上。

## 快速开始（装好插件之后）

打开侧栏「本地记忆」，页面顶部就是**快速开始**清单。按顺序做完四步即可，缺哪一步就只显示哪一步的按钮：

1. **安装记忆集成** — 缺 `@vectorize-io/hindsight-coding-agents` 时显示「安装」。点一下会调用 DSH 自带 CLI 把它装进当前 profile；装完提示重启 DSH，重启后会话里才会出现 `hindsight_*` 记忆工具。
2. **填写模型密钥** — 粘贴 DeepSeek API key（`sk-…`）。它只写到本机 `~/.hindsight/profiles/coding-agent.env`，供 Hindsight 抽取事实；页面上只显示「已配置」和来源，不会回显。
3. **选择缓存目录**（可跳过）— 不填就用默认位置；点「浏览…」直接选文件夹，也可以手填 `D:\hindsight` 这类绝对路径。
4. **启动守护进程** — 第一次要下载 uv 依赖和两个本地模型（约 500 MB），需要联网；之后 20–40 秒。状态点变绿、显示「运行中」即成功。

四步都完成后，清单会收成一行「环境就绪」，页面继续显示记忆库统计、搜索、最近文档。之后的会话结束时会自动写入记忆；`hindsight_sync_status` 显示 `synced` 后，知识页也会自动生成。

> 状态区的绿点/黄点/红点就是运行标识：**运行中 / 启动中（自动重试中） / 启动失败**。下面还会给出失败原因和下一步建议。
>
> 页面根节点自带滚动容器，内容超过一屏可正常向下滚动（设置、诊断信息在底部）。

## 记忆图谱

页面顶部有「概览 / 图谱」两个 tab。图谱的数据来自 Hindsight 的 `/entities/graph`（实体共现），而不是把几百条记忆直接画出来——记忆图有上万条边，画出来是一团毛线。

- **默认聚焦**：打开时以提及次数最高的实体为中心，第一圈是直接共现实体，第二圈是两跳。点任意节点把它变成新中心；点空白处或右上角「×」回到全图。
- **全图**：所有实体，节点大小按提及次数；社区分色，如果整张图退化成一个大连通簇（这个库里很常见），自动改用提及次数着色。工具栏的「最少提及」可以砍掉低频节点。
- **右侧抽屉**：实体的提及次数、首次/最近时间、最近 5 条记忆；「查看全部」一次拉 100 条，点单条展开全文。
- **搜索**：按实体名即时高亮（不区分大小写），右边显示命中数。
- **最少提及**：预设 1/2/3/5/10，选「自定义…」可以输入任意正整数。
- **生长动画**：工具栏点「生长动画」，按记忆写入时间回放——节点和连线在各自首次出现时点亮，连线随时间变粗；底部滑杆可拖拽到任意时刻，可播放/暂停，再点一次退出。时间轴来自实体的 `first_seen` 和记忆里“哪几个实体一起出现”，边是近似到首次共现。
- 交互：拖拽平移、滚轮缩放、悬停高亮邻居；节点可用 Tab 聚焦、回车打开。
- 全图最多画 160 个实体、1400 条边（按提及次数/权重取前），超出部分在左下角如实标注。

## 安装

从 GitHub 直接装：

```powershell
git clone https://github.com/fffzzzjjj/dsh-hindsight-manager.git
dsh plugin --profile <你的 profile 名> add file:<克隆下来的目录>
```

或者用本地目录装：

```powershell
dsh plugin --profile <你的 profile 名> add file:<本仓库绝对路径>
```

然后重启 DSH。侧栏出现「本地记忆」，点进去按页面上的「快速开始」四步走即可。

> **改了代码必须重装。** pnpm 会把包**复制**进 profile，不是符号链接；而且要 `remove` + `add` 才会重新复制（版本没变的 `file:` 依赖，`add` 只会说 "Already up to date"）：
>
> ```powershell
> dsh plugin --profile <profile> remove dsh-hindsight-manager
> dsh plugin --profile <profile> add file:<目录>
> ```
>
> 只改 `client.js` 的话，重装后按 F5 刷新页面就够；改 `index.js`（Host 半边）需要重启 DSH。

> Desktop 版的 profile 归应用自己的插件管理器所有。如果 `dsh plugin` 报 profile 被占用，请在应用的「设置 → 插件」里安装。

## 前置条件

| | |
|---|---|
| **uv** | `uv` / `uvx` 要在 PATH 上（首次启动会下载引擎，约 500 MB） |
| **一个 LLM key** | 事实抽取需要一个模型。本插件按顺序找：DSH 凭证里的 `DEEPSEEK_API_KEY` → 环境变量 `HINDSIGHT_API_LLM_API_KEY` → `DEEPSEEK_API_KEY` |
| **模型名** | 默认 `deepseek-flash`，用 `HINDSIGHT_API_LLM_MODEL` 覆盖 |

embedding 和 rerank 是**本地模型**，随引擎一起下载，不产生 API 费用。只有抽取（retain）和 reflect 会调 LLM。

## 配置

界面上的「设置」写在 `<DSH_HOME>/storages/dsh-hindsight-manager/config.json`：

```json
{
  "installDir": "D:\\hindsight",
  "autoStart": true,
  "showFooterStatus": true,
  "showSidebarEntry": true
}
```

- `installDir`：非空时把 `UV_CACHE_DIR` 指向 `<installDir>/uv-cache`、`HF_HOME` 指向 `<installDir>/hf-models`。**只有在这些目录真的已经有内容时**才追加 `UV_OFFLINE=1` / `HF_HUB_OFFLINE=1` —— 在空目录上强行脱机会把「慢下载」变成「莫名失败」。
- `autoStart`：`false` 就只靠页面上的按钮手动开。
- `showFooterStatus`：左下角（头像上方）是否显示常驻运行状态条。
- `bank`：`""` 表示自动（优先当前目录推导的库，否则最近写入的库）；填 `coding-agent::xxx` 则固定查看该库。只影响本面板读取，不改变 memory 集成写入的库。
- `showSidebarEntry`：左上角任务栏是否显示「本地记忆」入口。关闭后入口消失，但主面板仍可从状态条打开；也可随时在「插件 → 已安装插件 → 本地记忆」里重新打开（那里有同一组开关和「打开面板」按钮）。

模型密钥（快速开始第 2 步）写在 `~/.hindsight/profiles/coding-agent.env` 的 `HINDSIGHT_API_LLM_API_KEY`，和 Hindsight 引擎自己读的是同一份；同时把 `HINDSIGHT_API_PORT=9077` 固定下来（`hindsight-embed` 1.x 默认会随机分配端口，插件和记忆集成都需要固定的 9077）。

Hindsight 自己的配置仍在 `~/.hindsight/coding-agent.json`（本插件启动时会写入 `serverMode: "daemon"`）。

## HTTP 接口

Host 半边在 Harness 的 web server 上注册（`ctx.inject(['webServer'])` + `ctx.effect`，卸载即摘除）：

| 路由 | 作用 |
|---|---|
| `GET  /hindsight-manager/api/overview` | 状态 + 配置 + 记忆库统计 + 版本 |
| `GET  /hindsight-manager/api/setup` | 引导式部署清单：集成 / 密钥 / 端口 / 模型 / 网络 / 是否就绪 |
| `POST /hindsight-manager/api/setup` | `{"action":"install-integration"}` 或 `{"action":"save-key","apiKey":"…"}` |
| `POST /hindsight-manager/api/daemon` | `{"action":"start"\|"stop"}` |
| `GET  /hindsight-manager/api/documents?limit=N` | 文档列表 |
| `GET  /hindsight-manager/api/banks` | 可查看的记忆库列表 + 当前选中 |
| `GET  /hindsight-manager/api/health` | 库健康度：stats + 最近一次测速 |
| `POST /hindsight-manager/api/health/probe` | 用固定问题跑一次 recall，返回耗时/命中数/字符数 |
| `GET/PATCH /hindsight-manager/api/bank-config` | 读写库级参数（白名单：recall_max_tokens、recall_budget_function、enable_reranking、enable_observations、enable_auto_consolidation、retain_extraction_mode） |
| `GET  /hindsight-manager/api/graph` | 实体共现图（`nodes`/`edges` 扁平化，带 `firstSeen` 与 `span` 时间跨度，5 秒缓存） |
| `GET  /hindsight-manager/api/entity?id=…&limit=N` | 单个实体 + 提及它的记忆 |
| `POST /hindsight-manager/api/search` | `{"query":"…","budget":"low"}` |
| `GET/POST /hindsight-manager/api/config` | 读 / 写 `installDir`、`autoStart` |

记忆库名按 `coding-agent::{gitProject}` 解析：在 git 仓库里用仓库名，否则用目录名兜底。Host 进程的 cwd 不是会话工作区，所以这里**问 daemon 要 bank 列表**再挑，而不是用 `process.cwd()`。

## 开发

```powershell
npm test        # 两个冒烟测试（浏览器半边 + Host 半边）
npm run check   # 三个 Node 文件的语法检查
```

**`test/client-smoke.mjs`** 把 `client.js` 放进假的 `__ModuleLoader__` 环境执行，用 stub React 跑通 factory → `apply(ctx)` → 真的渲染一次页面，然后断言：

- 模块 id 与包名一致，`inject` 是 `slots,locale`
- 注册了 `main` 与 `sidebar.panellist`，且两者的 key/id 相同（否则点侧栏那一行选不中面板）
- 页面渲染出标题和**两个独立动作按钮**
- **没有非按钮元素带 `onClick`** —— 状态区不可点，这是最初那个缺陷的回归测试
- 所有 API 路径都在 `/hindsight-manager/api` 前缀下

**`test/host-smoke.mjs`** 导入 `index.js`，用假 ctx 调 `apply()`，再把每个路由 handler 真的执行一遍（`DSH_HOME` 指向临时目录、`autoStart` 关掉，所以不碰真实 profile，也不拉起守护进程）。它抓的是「页面能加载、handler 一调就炸」这类错误 —— 这套测试第一次运行就抓到了提交前的这个 bug：

```js
async function status() {
  const health = await health();   // 局部变量遮蔽同名函数 → TDZ 报错
```

## 设计约束（如果你想改代码）

- 浏览器半边**不 import 任何 host client 包**（`dsh-client-ui-primitives` 之类）。那些包会变、没有类型检查，组件一崩整个槽位就白屏。样式只用 `--dsw-alias-*` 主题 token，所以深浅色自动跟随。
- 所有资源都在 `ctx.effect` / `ctx.slots.inject` 里注册，返回的清理函数负责摘除。
- 看门狗**每个 Harness 进程最多一个**（模块级标志），避免重复实例。
- 停止守护进程按端口找 PID：守护进程是从启动器上 detach 的，端口是唯一可靠的手柄。

## 故障排查

| 现象 | 原因 / 处理 |
|---|---|
| 启动后显示「启动失败」，错误含 `Connection error` / `WinError 1225` | Python 读的是 **WinINET 系统代理**（`HKCU\…\Internet Settings`）。代理软件退出后 `ProxyServer` 可能仍指向 `127.0.0.1:7890`，于是守护进程连 DeepSeek 也会被拒。插件会检测该端口是否可达；不可达就自动加 `NO_PROXY=*` 直连（页面诊断信息里会写明）。VPN 恢复后重新启动即可。 |
| 状态一直「启动中」，超过 6 分钟 | 首次启动要下载 uv 依赖和 `bge-small` / `ms-marco` 两个模型，受网络影响。看 `~/.hindsight/profiles/coding-agent.log` 末尾；失败后会自动退避重试。 |
| 端口 9077 被占用 | 插件会尝试重试；也可先关掉占用进程（`netstat -ano \| findstr :9077`）。 |
| 侧栏没有「本地记忆」 | 新装插件后需要重启 DSH（Host 与客户端模块都在启动时装配）。 |
| 会话里没有 `hindsight_*` 工具 | 记忆集成装了但没重启 DSH；快速开始第 1 步会提示。 |
| 页面空白 / 不能滚动 | 1.1.0 之前的版本根节点没有高度和 `overflow`；升级并重启后正常。 |

日志与环境文件：

- 守护进程日志：`~/.hindsight/profiles/coding-agent.log`
- 环境变量（含密钥与端口）：`~/.hindsight/profiles/coding-agent.env`
- 插件配置：`<DSH_HOME>/storages/dsh-hindsight-manager/config.json`

## 已知限制

- 只支持 Windows（用 `netstat` / `taskkill` 管理进程）；其他平台会退化成「退出后守护进程可能继续跑」。
- 搜索只调 recall，不调 reflect（reflect 要几十秒，放列表页会像卡死）。
- 不支持删除文档、导出。

## 致谢与许可

MIT。看门狗逻辑移植自 [Hua1Q1nG/dsh-hindsight-local-optimize](https://github.com/Hua1Q1nG/dsh-hindsight-local-optimize)（同样 MIT），版权声明保留在 [LICENSE](LICENSE) 中。

记忆引擎本身是 [Vectorize Hindsight](https://github.com/vectorize-io/hindsight)（MIT）。
