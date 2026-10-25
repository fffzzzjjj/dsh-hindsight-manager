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
| **搜索记忆** | 语义检索（recall），结果就地展示 |
| **文档列表** | 最近 20 篇，含字符数、事实数、写入距今 |
| **缓存可搬家** | 设置里填一个绝对路径，就能把 uv 缓存和本地模型放到别的盘 |
| **隐藏黑框** | 隐藏 `uv.exe` 的控制台窗口（Windows 11 会把 `windowsHide` 变成 Windows Terminal 窗口） |

### 为什么状态不做成开关

最初的实现把状态和动作合成了一个控件，显示「运行中」的按钮点下去是**停止**。结果是「看一眼现在什么状态」和「关掉它」长得完全一样——实测被误点关掉、又点回来，还因此多生成了一个看门狗进程。

所以这里的状态**永远点不动**，动作只出现在明确的「启动」「停止」按钮上。

## 安装

```powershell
dsh plugin --profile <你的 profile 名> add file:<本仓库绝对路径>
```

然后重启 DSH。侧栏出现「本地记忆」，点进去就是管理页。

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
  "autoStart": true
}
```

- `installDir`：非空时把 `UV_CACHE_DIR` 指向 `<installDir>/uv-cache`、`HF_HOME` 指向 `<installDir>/hf-models`。**只有在这些目录真的已经有内容时**才追加 `UV_OFFLINE=1` / `HF_HUB_OFFLINE=1` —— 在空目录上强行脱机会把「慢下载」变成「莫名失败」。
- `autoStart`：`false` 就只靠页面上的按钮手动开。

Hindsight 自己的配置仍在 `~/.hindsight/coding-agent.json`（本插件启动时会写入 `serverMode: "daemon"`）。

## HTTP 接口

Host 半边在 Harness 的 web server 上注册（`ctx.inject(['webServer'])` + `ctx.effect`，卸载即摘除）：

| 路由 | 作用 |
|---|---|
| `GET  /hindsight-manager/api/overview` | 状态 + 配置 + 记忆库统计 + 版本 |
| `POST /hindsight-manager/api/daemon` | `{"action":"start"\|"stop"}` |
| `GET  /hindsight-manager/api/documents?limit=N` | 文档列表 |
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

## 已知限制

- 只支持 Windows（用了 `netstat` / `taskkill` / `powershell`）。其他平台上会退化成「不隐藏窗口、退出后守护进程继续跑」。
- 搜索只调 recall，不调 reflect（reflect 要几十秒，放列表页会像卡死）。
- 不支持删除文档、导出。

## 致谢与许可

MIT。看门狗与隐藏窗口两段逻辑移植自 [Hua1Q1nG/dsh-hindsight-local-optimize](https://github.com/Hua1Q1nG/dsh-hindsight-local-optimize)（同样 MIT），版权声明保留在 [LICENSE](LICENSE) 中。

记忆引擎本身是 [Vectorize Hindsight](https://github.com/vectorize-io/hindsight)（MIT）。
