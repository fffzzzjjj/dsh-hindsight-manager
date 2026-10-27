/**
 * dsh-hindsight-manager — browser half.
 *
 * One page under the sidebar. Three ideas kept apart on purpose:
 *   - the setup checklist says what is missing and offers the one action that
 *     fixes it, so a fresh install never dead-ends at "启动失败";
 *   - the daemon's status is READ-ONLY text, so reading it can never change it;
 *   - start and stop are separate buttons, each disabled unless it applies.
 */
window.__ModuleLoader__.load({
  id: 'dsh-hindsight-manager',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useCallback, useRef } = React;

    const NS = 'hindsight-manager';
    const PANEL_ID = 'hindsight-manager';
    const BUNDLE_KEY = 'dsh-hindsight-manager';
    const CONFIG_EVENT = 'dsh-hindsight-manager:config';
    const API = '/hindsight-manager/api';

    const zh = {
      nav: '本地记忆',
      title: '本地记忆',
      subtitle: '在这台机器上部署并管理 Hindsight 记忆库',
      quickStart: '快速开始',
      quickStartHint: '四步搭好本地记忆库',
      ready: '环境就绪',
      readyDetail: '集成、密钥、守护进程都已就绪',
      showSteps: '查看安装步骤',
      hideSteps: '收起步骤',
      stepIntegration: '安装记忆集成',
      stepIntegrationDetail: '把 Hindsight 记忆接入当前 DSH profile',
      stepKey: '填写模型密钥',
      stepKeyDetail: '用于事实抽取的 DeepSeek API key',
      stepCache: '选择缓存目录',
      stepCacheDetail: '可跳过，默认放在用户目录',
      stepDaemon: '启动守护进程',
      stepDaemonDetail: '启动后会创建第一个记忆库',
      install: '安装',
      installing: '安装中…',
      installed: '已安装',
      installedDisabled: '已安装（未启用）',
      installDone: '已安装。重启 DSH 后，会话里才会出现记忆工具。',
      installFailed: '安装失败',
      keyPlaceholder: '粘贴 DeepSeek API key（sk-…）',
      saveKey: '保存密钥',
      savingKey: '保存中…',
      changeKey: '更换',
      cancel: '取消',
      keySaved: '密钥已保存',
      keySavedRestart: '已保存，正在重启守护进程以应用新密钥…',
      keySource: '来源',
      keySourcePanel: '本面板',
      keySourceHarness: 'Harness 凭据',
      keySourceEnv: '环境变量',
      keyHint: '只保存在本机 ~/.hindsight/profiles/coding-agent.env，供 Hindsight 抽取事实使用。',
      goSettings: '去设置',
      start: '启动',
      stop: '停止',
      stateRunning: '运行中',
      stateStopped: '未运行',
      stateStarting: '启动中',
      stateRetrying: '自动重试中',
      stateFailed: '启动失败',
      stateUnknown: '读取中…',
      port: '端口',
      version: '版本',
      bank: '记忆库',
      bankNone: '尚未创建',
      bankPending: '还没有记忆库，第一次对话结束后会自动创建。',
      bankAuto: '自动（最近写入）',
      bankSelectHint: '切换只影响这里查看的库；写记忆仍然按当前会话的工作区走。',
      bankHealth: '库健康度',
      bankHealthHint: '检索速度与后台整理的实时状态',
      lastWrite: '最近写入',
      lastConsolidated: '最近整理',
      pendingOps: '待处理操作',
      failedOps: '失败操作',
      factBreakdown: '事实构成',
      probe: '测一次检索',
      probing: '检索中…',
      probeHint: '用固定问题跑一次 recall，比较不同时期的耗时和返回量；不会改动记忆。',
      probeResult: '{budget} · {ms} ms · {results} 条 · 约 {tokens} tokens',
      probeFailed: '测速失败',
      bankConfig: '库参数',
      bankConfigHint: '写进 Hindsight 库配置的设置，不是插件配置',
      bankMaxTokens: '召回 token 上限（默认值）',
      bankMaxTokensHint: '只对没有显式传 max_tokens 的调用生效；memory 集成会自己传值，探针固定用 1024。',
      searchBudget: '检索档位',
      searchBudgetHint: '面板的「搜索记忆」和「测一次检索」用这个档位；memory 集成按每次调用自己选。',
      bankBudget: '预算策略',
      budgetFixed: '固定',
      budgetAdaptive: '自适应',
      bankExtraction: '抽取模式',
      bankReranking: '启用重排',
      bankRerankingHint: '关掉更快，但相关性会变差',
      bankObservations: '生成观察',
      bankObservationsHint: '后台用 LLM 把事实压缩成观察；关掉省钱，但失去高层结论',
      bankAutoConsolidation: '自动整理',
      bankAutoConsolidationHint: '关闭后新记忆不会自动整合',
      bankConfigSaved: '已保存',
      bankConfigFailed: '保存失败',
      extrasMissing: '当前 host 还没加载这个接口，重启 DSH 后可用。',
      tabCleanup: '清理',
      cleanupTitle: '清理',
      cleanupHint: '只做“失效”（可恢复），不删除数据',
      cleanupRescan: '重新扫描',
      cleanupScanning: '扫描中…',
      cleanupScanned: '扫描 {scanned} / {total} 条',
      cleanupTruncated: '（仅最近 {scanned} 条）',
      cleanupDuplicates: '疑似重复',
      cleanupStale: '长期未动',
      cleanupForgotten: '已遗忘',
      cleanupGroups: ' 组',
      cleanupObservations: '观察',
      cleanupKeepHint: '建议保留',
      cleanupKeepOne: '保留 1 条',
      cleanupGroupFull: '有 {n} 组会被整组失效，等于把这条记忆删掉',
      cleanupFixKeep: '每组保留一条',
      cleanupDays: '天',
      cleanupEmptyDup: '没有发现文本高度相似的记忆。',
      cleanupEmptyStale: '没有超过 {days} 天未变动的记忆。',
      cleanupEmptyForgotten: '还没有失效的记忆。',
      cleanupEmptyObservations: '还没有观察。',
      cleanupSelectAll: '全选可选',
      cleanupClear: '清空选择',
      cleanupInvalidate: '失效选中（{n}）',
      cleanupRestore: '恢复选中（{n}）',
      cleanupReason: '原因',
      cleanupReasonPlaceholder: '例如：重复、过时、导入错误',
      cleanupLimit: '单次上限',
      cleanupNext: '继续',
      cleanupBack: '返回',
      cleanupCancel: '取消',
      cleanupConfirmTitle: '确认失效 {n} 条？',
      cleanupConfirmBody: '失效后它们会从检索、图谱和 consolidation 中消失，但可以在「已遗忘」里恢复。',
      cleanupConfirm: '确认执行',
      cleanupWorking: '处理中…',
      cleanupResult: '成功 {ok} 条，失败 {failed} 条',
      cleanupReasonRequired: '请填写原因',
      cleanupOverLimit: '选了 {n} 条，超过单次上限 {limit}',
      cleanupObservation: '观察是派生数据，不能直接失效',
      cleanupOpen: '打开清理',
      cleanupPending: '待清理',
      cleanupScanFailed: '扫描失败',
      versionLabel: '插件版本',
      checkUpdate: '检查更新',
      checkingUpdate: '检查中…',
      updateLatest: '已是最新版本',
      updateAvailable: '有新版本',
      updateFailed: '检查更新失败',
      updateHow: '更新：git pull 后重新安装，再重启 DSH',
      provider: '抽取模型',
      cache: '缓存位置',
      systemDefault: '系统默认位置',
      network: '网络',
      direct: '直连（已绕过失效的系统代理）',
      normalNetwork: '正常',
      stats: '记忆库概况',
      documents: '文档',
      facts: '事实',
      links: '关联',
      observations: '观察',
      tabOverview: '概览',
      tabGraph: '图谱',
      graphTitle: '记忆图谱',
      graphCounts: '{entities} 个实体 · {edges} 条关联',
      graphHidden: '已按提及次数隐藏 {n} 个低频实体',
      graphHint: '拖拽平移 · 滚轮缩放 · 点击节点聚焦',
      graphBack: '返回全图',
      graphFocus: '聚焦',
      graphSearch: '搜索实体…',
      graphMatches: '{n} 个匹配',
      graphMin: '最少提及',
      graphMinUnit: '次',
      graphLoading: '正在加载…',
      graphEmpty: '记忆库里还没有实体，对话结束后会自动抽取。',
      graphLoadFailed: '图谱加载失败',
      graphRetry: '重试',
      graphRefresh: '刷新',
      graphDetailHint: '点一个节点，这里会列出它关联的记忆。',
      graphTopEntities: '高频实体',
      graphMentions: '{n} 次提及',
      graphMemories: '相关记忆',
      graphFirstSeen: '首次出现',
      graphLastSeen: '最近更新',
      graphViewAll: '查看全部 {n} 条',
      graphCollapse: '收起',
      history: '历史',
      historyClick: '点击查看历史',
      historyTitle: '观察历史',
      historyEmpty: '这条观察还没有版本记录。',
      historyLoading: '加载中…',
      historyChangedAt: '变更于',
      historySources: '{n} 条来源',
      historyClose: '关闭',
      graphNoMemories: '这个实体还没有关联记忆。',
      graphDetailFailed: '读取实体详情失败',
      graphLegendFocus: '焦点',
      graphLegendNear: '直接关联',
      graphLegendFar: '两跳',
      graphCustom: '自定义…',
      growth: '生长动画',
      growthPlay: '播放',
      growthPause: '暂停',
      growthExit: '退出动画',
      growthHint: '按写入时间回放',
      growthShown: '已出现 {shown} / {total} 个实体',
      growthUnavailable: '图谱还没有时间信息，暂时不能播放',
      recent: '最近的文档',
      recentEmpty: '还没有任何文档。对话结束后会自动写入，也可以让我手动存一篇。',
      recentHint: '按写入时间倒序，最多 20 篇',
      search: '搜索记忆',
      searchPlaceholder: '例如：daemon 用哪个端口',
      searchButton: '搜索',
      searching: '搜索中…',
      searchEmpty: '没有命中。换个说法，或者先确认记忆库里有内容。',
      searchHint: '语义检索，不是关键词匹配，通常要 5–15 秒',
      results: '命中',
      errorTitle: '出了问题',
      retry: '重试',
      retryNow: '立即重试',
      retryIn: '将在 {n} 秒后自动重试',
      downHint: '记忆服务没在运行，这时候不会有任何记忆被写入。',
      startHint: '首次启动要下载并加载本地模型，可能需要几分钟；之后只需 20–40 秒。',
      hintNetwork: '网络不通：请确认 VPN/代理可用后重试。若是系统代理指向了已关闭的端口，可在下面「诊断信息」查看并让守护进程直连。',
      hintKey: '模型密钥缺失或无效：请在第 2 步填写。',
      hintPort: '端口 9077 被占用：先停止占用它的进程，或重启 DSH。',
      hintSlow: '首次启动需要下载本地模型，可能超过 6 分钟；请保持网络，稍后重试。',
      settings: '设置',
      settingsHint: '保存在本机，作用于这个 profile',
      installDir: '缓存目录',
      installDirHint: '留空用系统默认位置。填 D:\\hindsight 这类绝对路径可以把 uv 缓存和模型放到别的盘。',
      browse: '浏览…',
      picking: '选择中…',
      pickerUnavailable: '当前环境不支持系统目录选择，请手动填写路径。',
      autoStart: '随 DSH 启动',
      autoStartHint: '打开后每次启动 DSH 都会自动拉起守护进程，失败会自动重试。',
      footerStatus: '左下角显示运行状态',
      footerStatusHint: '在用户头像上方常驻显示本地记忆状态，点击可打开面板。',
      sidebarEntry: '侧栏显示「本地记忆」入口',
      sidebarEntryHint: '关闭后左上角任务栏不再显示入口。可随时在「插件 → 已安装插件 → 本地记忆」里重新打开，或点下方「打开面板」。',
      bundleSettingsTitle: '侧栏与状态条',
      bundleSettingsHint: '设置立即生效，并与「本地记忆」页面里的开关同步。',
      openPanel: '打开面板',
      save: '保存',
      saving: '保存中…',
      saved: '已保存',
      configNote: '改动在下次启动守护进程时生效。',
      chars: '字符',
      factsShort: '条事实',
      diagnostics: '诊断信息',
      logPath: '守护进程日志',
      envPath: '环境文件',
      dataDir: '数据目录',
      modelsLabel: '本地模型',
      modelsOk: '已下载',
      modelsMissing: '未下载（首次启动会自动下载）',
      proxyNote: '系统代理 {proxy} 不可达，守护进程已自动改为直连。',
      proxyOk: '系统代理 {proxy} 可用。',
      integrationLabel: '记忆集成',
      profileLabel: 'Profile',
      installLog: '安装输出',
      unknown: '未知',
    };

    const en = {
      nav: 'Memory',
      title: 'Local Memory',
      subtitle: 'Deploy and manage this machine’s Hindsight memory bank',
      quickStart: 'Quick start',
      quickStartHint: 'Four steps to a local memory bank',
      ready: 'Ready',
      readyDetail: 'Integration, key and daemon are all set',
      showSteps: 'Show setup steps',
      hideSteps: 'Hide steps',
      stepIntegration: 'Install the memory integration',
      stepIntegrationDetail: 'Wire Hindsight memory into this DSH profile',
      stepKey: 'Add a model key',
      stepKeyDetail: 'DeepSeek API key used for fact extraction',
      stepCache: 'Choose a cache directory',
      stepCacheDetail: 'Optional; the user directory is fine',
      stepDaemon: 'Start the daemon',
      stepDaemonDetail: 'Creates the first memory bank',
      install: 'Install',
      installing: 'Installing…',
      installed: 'Installed',
      installedDisabled: 'Installed (disabled)',
      installDone: 'Installed. Restart DSH so the memory tools appear in sessions.',
      installFailed: 'Install failed',
      keyPlaceholder: 'Paste the DeepSeek API key (sk-…)',
      saveKey: 'Save key',
      savingKey: 'Saving…',
      changeKey: 'Replace',
      cancel: 'Cancel',
      keySaved: 'Key saved',
      keySavedRestart: 'Saved. Restarting the daemon to apply it…',
      keySource: 'Source',
      keySourcePanel: 'this panel',
      keySourceHarness: 'Harness credentials',
      keySourceEnv: 'environment',
      keyHint: 'Stored only on this machine in ~/.hindsight/profiles/coding-agent.env, used for fact extraction.',
      goSettings: 'Open settings',
      start: 'Start',
      stop: 'Stop',
      stateRunning: 'Running',
      stateStopped: 'Stopped',
      stateStarting: 'Starting',
      stateRetrying: 'Retrying',
      stateFailed: 'Failed to start',
      stateUnknown: 'Reading…',
      port: 'Port',
      version: 'Version',
      bank: 'Memory bank',
      bankNone: 'not created yet',
      bankPending: 'No bank yet — the first finished conversation creates it.',
      bankAuto: 'Auto (most recent)',
      bankSelectHint: 'Switching only changes what this page reads; writes still follow the session workspace.',
      bankHealth: 'Bank health',
      bankHealthHint: 'Live retrieval speed and background consolidation state',
      lastWrite: 'Last write',
      lastConsolidated: 'Last consolidated',
      pendingOps: 'Pending operations',
      failedOps: 'Failed operations',
      factBreakdown: 'Fact mix',
      probe: 'Time a retrieval',
      probing: 'Retrieving…',
      probeHint: 'Runs one recall with a fixed question so timings stay comparable; nothing is written.',
      probeResult: '{budget} · {ms} ms · {results} hits · ~{tokens} tokens',
      probeFailed: 'Probe failed',
      bankConfig: 'Bank settings',
      bankConfigHint: 'Written into the Hindsight bank config, not the plugin config',
      bankMaxTokens: 'Recall token cap (default)',
      bankMaxTokensHint: 'Only applies when the caller omits max_tokens; the memory integration passes its own, and the probe uses 1024.',
      searchBudget: 'Retrieval tier',
      searchBudgetHint: 'Used by this panel\'s search and probe; the memory integration chooses per call.',
      bankBudget: 'Budget strategy',
      budgetFixed: 'Fixed',
      budgetAdaptive: 'Adaptive',
      bankExtraction: 'Extraction mode',
      bankReranking: 'Rerank',
      bankRerankingHint: 'Turning it off is faster but less relevant',
      bankObservations: 'Observations',
      bankObservationsHint: 'Background LLM compresses facts into observations',
      bankAutoConsolidation: 'Auto consolidation',
      bankAutoConsolidationHint: 'When off, new memories stay raw',
      bankConfigSaved: 'Saved',
      bankConfigFailed: 'Could not save',
      extrasMissing: 'The host has not loaded this endpoint yet; restart DSH.',
      tabCleanup: 'Cleanup',
      cleanupTitle: 'Cleanup',
      cleanupHint: 'Invalidation only — nothing is deleted, everything is restorable',
      cleanupRescan: 'Rescan',
      cleanupScanning: 'Scanning…',
      cleanupScanned: 'Scanned {scanned} / {total}',
      cleanupTruncated: ' (newest {scanned} only)',
      cleanupDuplicates: 'Near-duplicates',
      cleanupStale: 'Untouched',
      cleanupForgotten: 'Forgotten',
      cleanupGroups: ' groups',
      cleanupObservations: 'Observations',
      cleanupKeepHint: 'keep this',
      cleanupKeepOne: 'keep 1',
      cleanupGroupFull: '{n} groups would be invalidated entirely — that deletes the fact',
      cleanupFixKeep: 'Keep one per group',
      cleanupDays: 'd',
      cleanupEmptyDup: 'No highly similar memories found.',
      cleanupEmptyStale: 'Nothing untouched for over {days} days.',
      cleanupEmptyForgotten: 'Nothing invalidated yet.',
      cleanupEmptyObservations: 'No observations yet.',
      cleanupSelectAll: 'Select all',
      cleanupClear: 'Clear',
      cleanupInvalidate: 'Invalidate selected ({n})',
      cleanupRestore: 'Restore selected ({n})',
      cleanupReason: 'Reason',
      cleanupReasonPlaceholder: 'e.g. duplicate, outdated, imported by mistake',
      cleanupLimit: 'Batch limit',
      cleanupNext: 'Continue',
      cleanupBack: 'Back',
      cleanupCancel: 'Cancel',
      cleanupConfirmTitle: 'Invalidate {n} memories?',
      cleanupConfirmBody: 'They disappear from recall, the graph and consolidation, but can be restored from Forgotten.',
      cleanupConfirm: 'Confirm',
      cleanupWorking: 'Working…',
      cleanupResult: '{ok} succeeded, {failed} failed',
      cleanupReasonRequired: 'A reason is required',
      cleanupOverLimit: '{n} selected, over the batch limit of {limit}',
      cleanupObservation: 'Observations are derived and cannot be invalidated',
      cleanupOpen: 'Open cleanup',
      cleanupPending: 'Pending cleanup',
      cleanupScanFailed: 'Scan failed',
      versionLabel: 'Plugin version',
      checkUpdate: 'Check for updates',
      checkingUpdate: 'Checking…',
      updateLatest: 'Up to date',
      updateAvailable: 'New version',
      updateFailed: 'Update check failed',
      updateHow: 'Update: git pull, reinstall, restart DSH',
      provider: 'Extraction model',
      cache: 'Cache location',
      systemDefault: 'system default',
      network: 'Network',
      direct: 'direct (dead system proxy bypassed)',
      normalNetwork: 'normal',
      stats: 'Bank overview',
      documents: 'Documents',
      facts: 'Facts',
      links: 'Links',
      observations: 'Observations',
      tabOverview: 'Overview',
      tabGraph: 'Graph',
      graphTitle: 'Memory graph',
      graphCounts: '{entities} entities · {edges} links',
      graphHidden: '{n} low-mention entities hidden',
      graphHint: 'Drag to pan · scroll to zoom · click a node to focus',
      graphBack: 'All entities',
      graphFocus: 'Focus',
      graphSearch: 'Search entities…',
      graphMatches: '{n} matches',
      graphMin: 'Min mentions',
      graphMinUnit: '',
      graphLoading: 'Loading…',
      graphEmpty: 'No entities yet — they are extracted after conversations end.',
      graphLoadFailed: 'Could not load the graph',
      graphRetry: 'Retry',
      graphRefresh: 'Refresh',
      graphDetailHint: 'Click a node to list the memories behind it.',
      graphTopEntities: 'Top entities',
      graphMentions: '{n} mentions',
      graphMemories: 'Related memories',
      graphFirstSeen: 'First seen',
      graphLastSeen: 'Last seen',
      graphViewAll: 'Show all {n}',
      graphCollapse: 'Collapse',
      history: 'History',
      historyClick: 'click to view history',
      historyTitle: 'Observation history',
      historyEmpty: 'This observation has no recorded versions yet.',
      historyLoading: 'Loading…',
      historyChangedAt: 'changed',
      historySources: '{n} sources',
      historyClose: 'Close',
      graphNoMemories: 'No memories mention this entity yet.',
      graphDetailFailed: 'Could not load this entity',
      graphLegendFocus: 'focus',
      graphLegendNear: 'direct',
      graphLegendFar: 'two hops',
      graphCustom: 'Custom…',
      growth: 'Growth',
      growthPlay: 'Play',
      growthPause: 'Pause',
      growthExit: 'Exit',
      growthHint: 'Replay by write time',
      growthShown: '{shown} / {total} entities so far',
      growthUnavailable: 'No timestamps in this graph yet',
      recent: 'Recent documents',
      recentEmpty: 'No documents yet. Conversations are written after they end.',
      recentHint: 'Newest first, up to 20',
      search: 'Search memory',
      searchPlaceholder: 'e.g. which port does the daemon use',
      searchButton: 'Search',
      searching: 'Searching…',
      searchEmpty: 'Nothing matched. Try different words, or check the bank has content.',
      searchHint: 'Semantic retrieval, not keywords; usually 5–15 seconds',
      results: 'hits',
      errorTitle: 'Something went wrong',
      retry: 'Retry',
      retryNow: 'Retry now',
      retryIn: 'Retrying in {n}s',
      downHint: 'Memory is not running, so nothing is being remembered right now.',
      startHint: 'The first start downloads and loads local models; afterwards 20–40 seconds.',
      hintNetwork: 'Network unreachable: check the VPN/proxy, then retry. A system proxy pointing at a closed port is a common cause — see Diagnostics below.',
      hintKey: 'The model key is missing or invalid: fill it in step 2.',
      hintPort: 'Port 9077 is in use: stop the process holding it, or restart DSH.',
      hintSlow: 'The first start downloads local models and can exceed six minutes; keep the network up and retry later.',
      settings: 'Settings',
      settingsHint: 'Stored locally, applies to this profile',
      installDir: 'Cache directory',
      installDirHint: 'Leave empty for the system default. An absolute path moves the uv cache and models.',
      browse: 'Browse…',
      picking: 'Choosing…',
      pickerUnavailable: 'This environment cannot open a directory chooser; type the path instead.',
      autoStart: 'Start with DSH',
      autoStartHint: 'Start the daemon on every DSH launch, retrying transient failures.',
      footerStatus: 'Show status in the sidebar foot',
      footerStatusHint: 'A persistent status chip above the account row; click it to open the panel.',
      sidebarEntry: 'Show the Memory entry in the sidebar',
      sidebarEntryHint: 'Hides the top-left entry. Reopen it any time from Plugins → Installed → Local Memory, or with Open panel below.',
      bundleSettingsTitle: 'Sidebar and status',
      bundleSettingsHint: 'Applies immediately and stays in sync with the switches on the Local Memory page.',
      openPanel: 'Open panel',
      save: 'Save',
      saving: 'Saving…',
      saved: 'Saved',
      configNote: 'Changes apply the next time the daemon starts.',
      chars: 'chars',
      factsShort: 'facts',
      diagnostics: 'Diagnostics',
      logPath: 'Daemon log',
      envPath: 'Environment file',
      dataDir: 'Data directory',
      modelsLabel: 'Local models',
      modelsOk: 'downloaded',
      modelsMissing: 'missing (the first start downloads them)',
      proxyNote: 'System proxy {proxy} is unreachable; the daemon bypasses it.',
      proxyOk: 'System proxy {proxy} is reachable.',
      integrationLabel: 'Memory integration',
      profileLabel: 'Profile',
      installLog: 'Install output',
      unknown: 'unknown',
    };

    /** Locale tables, also used when the host injects no translator. */
    function fallbackT(key) {
      const lang = (typeof navigator !== 'undefined' && navigator.language) || 'en';
      const table = lang.toLowerCase().startsWith('zh') ? zh : en;
      return table[key] ?? key;
    }

    /**
     * Resolve a translator from the Client locale service. The host may hand back
     * a bound translator, nothing at all, or something non-callable on another
     * build; only a function may reach the render path.
     */
    function localeTranslator(ctx) {
      try {
        const candidate = ctx?.locale?.t?.(NS);
        if (typeof candidate === 'function') return candidate;
      } catch {
        // fall through
      }
      return fallbackT;
    }

    const C = {
      text: 'var(--dsw-alias-label-primary, #e6e6e6)',
      text2: 'var(--dsw-alias-label-secondary, #a8adb5)',
      text3: 'var(--dsw-alias-label-tertiary, #7c828b)',
      border: 'var(--dsw-alias-border-l1, rgba(128,128,128,0.25))',
      border2: 'var(--dsw-alias-border-l2, rgba(128,128,128,0.35))',
      surface: 'var(--dsw-alias-bg-layer-1, rgba(127,127,127,0.08))',
      surface2: 'var(--dsw-alias-bg-layer-2, rgba(127,127,127,0.14))',
      base: 'var(--dsw-alias-bg-base, transparent)',
      ok: 'var(--dsw-alias-state-success-primary, #2ecc71)',
      warn: 'var(--dsw-alias-state-warn-primary, #f5b944)',
      err: 'var(--dsw-alias-state-error-primary, #e5484d)',
      btnFill: 'var(--dsw-alias-button-primary-fill, #247bbf)',
      btnText: 'var(--dsw-alias-label-primary-foreground, #ffffff)',
    };

    const stateColor = {
      running: C.ok,
      starting: C.warn,
      retrying: C.warn,
      failed: C.err,
      stopped: C.text3,
      unknown: C.text3,
    };
    const fmt = (n) => (typeof n === 'number' ? n.toLocaleString() : '—');
    const mono = { fontFamily: 'ui-monospace, monospace', fontSize: 11.5, color: C.text };
    const inputStyle = {
      flex: 1,
      minWidth: 0,
      boxSizing: 'border-box',
      padding: '7px 11px',
      borderRadius: 8,
      border: `1px solid ${C.border2}`,
      background: C.base,
      color: C.text,
      fontSize: 12.5,
      outline: 'none',
    };

    function timeAgo(iso) {
      if (!iso) return '';
      const then = new Date(iso).getTime();
      if (Number.isNaN(then)) return '';
      const minutes = Math.round((Date.now() - then) / 60000);
      if (minutes < 1) return 'now';
      if (minutes < 60) return `${minutes}m`;
      const hours = Math.round(minutes / 60);
      if (hours < 24) return `${hours}h`;
      return `${Math.round(hours / 24)}d`;
    }

    function Dot({ color, glow, size = 8 }) {
      return h('span', {
        style: {
          width: size,
          height: size,
          flex: 'none',
          borderRadius: '50%',
          background: color,
          boxShadow: glow ? `0 0 6px ${color}` : 'none',
        },
      });
    }

    function Card({ children, style }) {
      return h(
        'div',
        {
          style: {
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            background: C.surface,
            padding: 16,
            ...style,
          },
        },
        children,
      );
    }

    function SectionTitle({ children, hint, right }) {
      return h(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'baseline',
            gap: 8,
            marginBottom: 12,
            flexWrap: 'wrap',
            justifyContent: right ? 'space-between' : 'flex-start',
          },
        },
        h(
          'div',
          { style: { display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' } },
          h('div', { style: { fontSize: 13, fontWeight: 600, color: C.text } }, children),
          hint ? h('div', { style: { fontSize: 11, color: C.text3 } }, hint) : null,
        ),
        right ?? null,
      );
    }

    function Button({ children, onClick, disabled, primary, busy }) {
      return h(
        'button',
        {
          type: 'button',
          onClick,
          disabled: disabled || busy,
          style: {
            appearance: 'none',
            border: primary ? 'none' : `1px solid ${C.border2}`,
            background: primary ? C.btnFill : 'transparent',
            color: primary ? C.btnText : C.text,
            borderRadius: 8,
            padding: '6px 14px',
            fontSize: 12,
            fontWeight: 500,
            cursor: disabled || busy ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.45 : 1,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            whiteSpace: 'nowrap',
          },
        },
        busy
          ? h('span', {
              style: {
                width: 10,
                height: 10,
                borderRadius: '50%',
                border: `2px solid ${primary ? C.btnText : C.text2}`,
                borderTopColor: 'transparent',
                animation: 'dsh-hm-spin 0.8s linear infinite',
              },
            })
          : null,
        children,
      );
    }

    function ViewTab({ active, children, onClick }) {
      return h(
        'button',
        {
          type: 'button',
          onClick,
          style: {
            appearance: 'none',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            padding: '7px 12px',
            marginBottom: -1,
            fontSize: 12.5,
            fontWeight: active ? 600 : 400,
            color: active ? C.text : C.text3,
            borderBottom: `2px solid ${active ? C.btnFill : 'transparent'}`,
          },
        },
        children,
      );
    }

    function Badge({ children, color = C.text2, done }) {
      return h(
        'span',
        {
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 11.5,
            color,
            background: done ? 'rgba(46,204,113,0.12)' : C.surface2,
            border: `1px solid ${done ? 'rgba(46,204,113,0.35)' : C.border}`,
            borderRadius: 999,
            padding: '2px 9px',
            whiteSpace: 'nowrap',
          },
        },
        done ? h(Dot, { color: C.ok, size: 6 }) : null,
        children,
      );
    }

    function Stat({ label, value }) {
      return h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 72 } },
        h('div', { style: { fontSize: 18, fontWeight: 600, color: C.text, fontVariantNumeric: 'tabular-nums' } }, value),
        h('div', { style: { fontSize: 11, color: C.text3 } }, label),
      );
    }

    function Row({ label, children }) {
      return h(
        'div',
        { style: { display: 'flex', gap: 8, fontSize: 12, alignItems: 'baseline' } },
        h('span', { style: { color: C.text3, flex: 'none', minWidth: 72 } }, label),
        h(
          'span',
          { style: { color: C.text, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' } },
          children,
        ),
      );
    }

    function Step({ index, title, detail, done, optional, children }) {
      return h(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            padding: '9px 0',
            borderTop: index === 1 ? 'none' : `1px solid ${C.border}`,
          },
        },
        h(
          'span',
          {
            style: {
              width: 20,
              height: 20,
              flex: 'none',
              marginTop: 1,
              borderRadius: '50%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 600,
              color: done ? '#fff' : C.text3,
              background: done ? C.ok : C.surface2,
              border: done ? 'none' : `1px solid ${C.border2}`,
            },
          },
          done ? '✓' : String(index),
        ),
        h(
          'div',
          { style: { flex: 1, minWidth: 0 } },
          h(
            'div',
            { style: { display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' } },
            h('span', { style: { fontSize: 12.5, fontWeight: 600, color: C.text } }, title),
            optional ? h('span', { style: { fontSize: 10.5, color: C.text3 } }, '(可选)') : null,
          ),
          h('div', { style: { fontSize: 11.5, color: C.text3, marginTop: 2, wordBreak: 'break-word' } }, detail),
        ),
        h('div', { style: { flex: 'none', display: 'flex', alignItems: 'center', gap: 8 } }, children),
      );
    }

    function StatusPill({ status, t }) {
      const label =
        status === 'running'
          ? t('stateRunning')
          : status === 'starting'
            ? t('stateStarting')
            : status === 'retrying'
              ? t('stateRetrying')
              : status === 'failed'
                ? t('stateFailed')
                : status === 'stopped'
                  ? t('stateStopped')
                  : t('stateUnknown');
      const color = stateColor[status] ?? C.text3;
      return h(
        'span',
        {
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            padding: '4px 11px',
            borderRadius: 999,
            background: C.surface2,
            border: `1px solid ${C.border}`,
            fontSize: 12,
            fontWeight: 600,
            color,
          },
        },
        h(Dot, { color, glow: status === 'running', size: 9 }),
        label,
      );
    }

    function errorHint(message, t) {
      const text = String(message ?? '');
      if (/connection error|connecterror|refused|winerror|10060|10061|timed out|timeout|unreachable|proxy|network/i.test(text)) {
        return t('hintNetwork');
      }
      if (/api key/i.test(text)) return t('hintKey');
      if (/address already in use|EADDRINUSE|port/i.test(text)) return t('hintPort');
      if (/did not complete within/i.test(text)) return t('hintSlow');
      return null;
    }

    function ManagerPanel(props) {
      const t = typeof props?.t === 'function' ? props.t : fallbackT;
      const pickDirectoryProp = typeof props?.pickDirectory === 'function' ? props.pickDirectory : null;
      const applyUiConfigProp = typeof props?.applyUiConfig === 'function' ? props.applyUiConfig : null;

      const [data, setData] = useState(null);
      const [setup, setSetup] = useState(null);
      const [loadError, setLoadError] = useState(null);
      const [busy, setBusy] = useState(null);
      const [actionError, setActionError] = useState(null);
      const [documents, setDocuments] = useState(null);
      const [view, setView] = useState('overview');
      const [banks, setBanks] = useState(null);
      const [bankChoice, setBankChoice] = useState('');
      const [bankBusy, setBankBusy] = useState(false);
      const [bankMessage, setBankMessage] = useState(null);
      const [health, setHealth] = useState(null);
      const [probe, setProbe] = useState(null);
      const [probing, setProbing] = useState(false);
      const [bankConfig, setBankConfig] = useState(null);
      const [bankDraft, setBankDraft] = useState({});
      const [searchBudget, setSearchBudget] = useState('low');
      const [bankConfigBusy, setBankConfigBusy] = useState(false);
      const [bankConfigMessage, setBankConfigMessage] = useState(null);
      const [extrasMissing, setExtrasMissing] = useState(false);
      const [update, setUpdate] = useState(null);
      const [checkingUpdate, setCheckingUpdate] = useState(false);
      const [cleanup, setCleanup] = useState(null);
      const [cleanupLoading, setCleanupLoading] = useState(false);
      const [staleDays, setStaleDays] = useState(90);
      const [query, setQuery] = useState('');
      const [results, setResults] = useState(null);
      const [searching, setSearching] = useState(false);
      const [installDir, setInstallDir] = useState('');
      const [autoStart, setAutoStart] = useState(true);
      const [showFooterStatus, setShowFooterStatus] = useState(true);
      const [showSidebarEntry, setShowSidebarEntry] = useState(true);
      const [savingConfig, setSavingConfig] = useState(false);
      const [picking, setPicking] = useState(false);
      const [configMessage, setConfigMessage] = useState(null);
      const [keyEditing, setKeyEditing] = useState(false);
      const [keyInput, setKeyInput] = useState('');
      const [keyMessage, setKeyMessage] = useState(null);
      const [savingKey, setSavingKey] = useState(false);
      const [stepsExpanded, setStepsExpanded] = useState(false);
      const [now, setNow] = useState(Date.now());
      const alive = useRef(true);
      const configLoaded = useRef(false);
      const settingsRef = useRef(null);

      useEffect(() => {
        alive.current = true;
        return () => {
          alive.current = false;
        };
      }, []);

      const loadOverview = useCallback(async () => {
        try {
          const res = await fetch(`${API}/overview`, { cache: 'no-store' });
          const body = await res.json();
          if (!alive.current) return;
          if (!res.ok || body.ok === false) throw new Error(body.error ?? res.statusText);
          setData(body);
          setLoadError(null);
          // Seed the settings form once; never overwrite what the user is typing.
          if (!configLoaded.current && body.config) {
            configLoaded.current = true;
            setInstallDir(body.config.installDir ?? '');
            setAutoStart(body.config.autoStart !== false);
            setShowFooterStatus(body.config.showFooterStatus !== false);
            setShowSidebarEntry(body.config.showSidebarEntry !== false);
            setBankChoice(typeof body.config.bank === 'string' ? body.config.bank : '');
            setSearchBudget(['low', 'mid', 'high'].includes(body.config.searchBudget) ? body.config.searchBudget : 'low');
          }
        } catch (error) {
          if (alive.current) setLoadError(error.message ?? String(error));
        }
      }, []);

      const loadSetup = useCallback(async () => {
        try {
          const res = await fetch(`${API}/setup`, { cache: 'no-store' });
          const body = await res.json();
          if (!alive.current) return;
          if (res.ok && body.ok !== false) setSetup(body);
        } catch {
          // the status card already reports service trouble
        }
      }, []);

      const loadBanks = useCallback(async () => {
        try {
          const res = await fetch(`${API}/banks`, { cache: 'no-store' });
          const body = await res.json().catch(() => ({}));
          if (!alive.current) return;
          if (!res.ok || body.ok === false) return;
          setBanks(Array.isArray(body.banks) ? body.banks : []);
        } catch {
          // the status card already reports service trouble
        }
      }, []);

      const loadHealth = useCallback(async () => {
        try {
          const res = await fetch(`${API}/health`, { cache: 'no-store' });
          if (res.status === 404) {
            if (alive.current) setExtrasMissing(true);
            return;
          }
          const body = await res.json().catch(() => ({}));
          if (!alive.current) return;
          if (!res.ok || body.ok === false) return;
          setExtrasMissing(false);
          setHealth(body);
          if (body.probe) setProbe(body.probe);
        } catch {
          // the status card already reports service trouble
        }
      }, []);

      const loadBankConfig = useCallback(async () => {
        try {
          const res = await fetch(`${API}/bank-config`, { cache: 'no-store' });
          if (res.status === 404) {
            if (alive.current) {
              setExtrasMissing(true);
              setBankConfig(null);
            }
            return;
          }
          const body = await res.json().catch(() => ({}));
          if (!alive.current) return;
          if (!res.ok || body.ok === false) {
            setBankConfig(null);
            return;
          }
          setBankConfig(body.config ?? {});
          setBankDraft(body.config ?? {});
        } catch {
          if (alive.current) setBankConfig(null);
        }
      }, []);

      const loadCleanup = useCallback(async () => {
        setCleanupLoading(true);
        try {
          const res = await fetch(`${API}/cleanup?staleDays=${staleDays}&scan=800`, { cache: 'no-store' });
          const body = await res.json().catch(() => ({}));
          if (!alive.current) return;
          if (!res.ok || body.ok === false) throw new Error(body.error ?? res.statusText);
          setCleanup(body);
        } catch (error) {
          if (alive.current) setCleanup({ error: error.message ?? String(error) });
        } finally {
          if (alive.current) setCleanupLoading(false);
        }
      }, [staleDays]);

      const loadDocuments = useCallback(async () => {
        try {
          const res = await fetch(`${API}/documents?limit=20`, { cache: 'no-store' });
          const body = await res.json();
          if (!alive.current) return;
          if (!res.ok || body.ok === false) return;
          setDocuments(body.items ?? []);
        } catch {
          // the status card already reports service trouble
        }
      }, []);

      useEffect(() => {
        loadOverview();
        loadSetup();
        loadBanks();
        const timer = setInterval(loadOverview, 4000);
        const setupTimer = setInterval(loadSetup, 5000);
        const tick = setInterval(() => {
          if (alive.current) setNow(Date.now());
        }, 1000);
        return () => {
          clearInterval(timer);
          clearInterval(setupTimer);
          clearInterval(tick);
        };
      }, [loadOverview, loadSetup]);

      useEffect(() => {
        if (data?.running) loadBanks();
      }, [data?.running, loadBanks]);

      useEffect(() => {
        if (!data?.running) {
          setHealth(null);
          setBankConfig(null);
          setCleanup(null);
          return;
        }
        loadHealth();
        loadBankConfig();
        loadCleanup();
      }, [data?.running, data?.bank, loadHealth, loadBankConfig, loadCleanup]);

      useEffect(() => {
        if (data?.running) loadDocuments();
        else setDocuments(null);
      }, [data?.running, loadDocuments]);

      const refreshAll = useCallback(() => {
        loadOverview();
        loadSetup();
      }, [loadOverview, loadSetup]);

      const runAction = useCallback(
        async (action) => {
          setBusy(action);
          setActionError(null);
          try {
            const res = await fetch(`${API}/daemon`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              cache: 'no-store',
              body: JSON.stringify({ action }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok || body.ok === false) throw new Error(body.error ?? res.statusText);
            if (body.error) setActionError(body.error);
            setTimeout(refreshAll, action === 'start' ? 1200 : 300);
          } catch (error) {
            setActionError(error.message ?? String(error));
          } finally {
            if (alive.current) setBusy(null);
          }
        },
        [refreshAll],
      );

      const installIntegration = useCallback(async () => {
        setBusy('install');
        setActionError(null);
        try {
          const res = await fetch(`${API}/setup`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            cache: 'no-store',
            body: JSON.stringify({ action: 'install-integration' }),
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok || body.ok === false) throw new Error(body.error ?? res.statusText);
          let waited = 0;
          const poll = setInterval(async () => {
            waited += 2000;
            await loadSetup();
            if (!alive.current) {
              clearInterval(poll);
              return;
            }
            if (waited > 10 * 60 * 1000) clearInterval(poll);
          }, 2000);
          setTimeout(() => clearInterval(poll), 10 * 60 * 1000);
        } catch (error) {
          setActionError(error.message ?? String(error));
        } finally {
          if (alive.current) setBusy(null);
        }
      }, [loadSetup]);

      const changeBank = useCallback(
        async (value) => {
          setBankBusy(true);
          setBankMessage(null);
          try {
            const res = await fetch(`${API}/config`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              cache: 'no-store',
              body: JSON.stringify({ bank: value }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok || body.ok === false) throw new Error(body.error ?? res.statusText);
            if (alive.current) setBankChoice(value);
            refreshAll();
            loadBanks();
          } catch (error) {
            if (alive.current) setBankMessage(`${t('errorTitle')}: ${error.message ?? String(error)}`);
          } finally {
            if (alive.current) setBankBusy(false);
          }
        },
        [refreshAll, loadBanks, t],
      );

      const changeSearchBudget = useCallback(
        async (value) => {
          const previous = searchBudget;
          setSearchBudget(value);
          setBankConfigMessage(null);
          try {
            const res = await fetch(`${API}/config`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              cache: 'no-store',
              body: JSON.stringify({ searchBudget: value }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok || body.ok === false) throw new Error(body.error ?? res.statusText);
            if (alive.current) setBankConfigMessage(t('bankConfigSaved'));
          } catch (error) {
            if (alive.current) {
              setSearchBudget(previous);
              setBankConfigMessage(`${t('bankConfigFailed')}: ${error.message ?? String(error)}`);
            }
          }
        },
        [searchBudget, t],
      );

      const checkUpdate = useCallback(async () => {
        setCheckingUpdate(true);
        setUpdate(null);
        try {
          const res = await fetch(`${API}/update`, { cache: 'no-store' });
          const body = await res.json().catch(() => ({}));
          if (!res.ok || body.ok === false) throw new Error(body.error ?? res.statusText);
          if (alive.current) setUpdate(body);
        } catch (error) {
          if (alive.current) setUpdate({ error: error.message ?? String(error) });
        } finally {
          if (alive.current) setCheckingUpdate(false);
        }
      }, []);

      const runProbe = useCallback(async () => {
        setProbing(true);
        setProbe(null);
        try {
          const res = await fetch(`${API}/health/probe`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            cache: 'no-store',
            body: JSON.stringify({}),
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok || body.ok === false) throw new Error(body.error ?? res.statusText);
          if (alive.current) setProbe(body.probe ?? null);
        } catch (error) {
          if (alive.current) setProbe({ error: error.message ?? String(error), at: Date.now() });
        } finally {
          if (alive.current) setProbing(false);
        }
      }, []);

      const saveBankConfig = useCallback(async () => {
        if (bankConfig === null) return;
        setBankConfigBusy(true);
        setBankConfigMessage(null);
        try {
          const updates = {
            recall_max_tokens: Math.min(8192, Math.max(256, Math.round(Number(bankDraft.recall_max_tokens) || 2048))),
            recall_budget_function: bankDraft.recall_budget_function === 'adaptive' ? 'adaptive' : 'fixed',
            enable_reranking: bankDraft.enable_reranking !== false,
            enable_observations: bankDraft.enable_observations !== false,
            enable_auto_consolidation: bankDraft.enable_auto_consolidation !== false,
            retain_extraction_mode: ['concise', 'verbose', 'verbatim', 'chunks'].includes(bankDraft.retain_extraction_mode)
              ? bankDraft.retain_extraction_mode
              : 'concise',
          };
          const res = await fetch(`${API}/bank-config`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            cache: 'no-store',
            body: JSON.stringify({ updates }),
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok || body.ok === false) throw new Error(body.error ?? res.statusText);
          if (alive.current) {
            setBankConfig(body.config ?? {});
            setBankDraft(body.config ?? {});
            setBankConfigMessage(t('bankConfigSaved'));
          }
          loadHealth();
        } catch (error) {
          if (alive.current) setBankConfigMessage(`${t('bankConfigFailed')}: ${error.message ?? String(error)}`);
        } finally {
          if (alive.current) setBankConfigBusy(false);
        }
      }, [bankConfig, bankDraft, loadHealth, t]);

      const pickCacheDir = useCallback(async () => {
        if (pickDirectoryProp === null) {
          setConfigMessage(`${t('errorTitle')}: ${t('pickerUnavailable')}`);
          return;
        }
        setPicking(true);
        setConfigMessage(null);
        try {
          const picked = await pickDirectoryProp();
          if (typeof picked === 'string' && picked !== '') setInstallDir(picked);
          else if (picked && typeof picked.path === 'string') setInstallDir(picked.path);
        } catch (error) {
          setConfigMessage(`${t('errorTitle')}: ${error?.message ?? String(error)}`);
        } finally {
          if (alive.current) setPicking(false);
        }
      }, [pickDirectoryProp, t]);

      const saveSettings = useCallback(async () => {
        setSavingConfig(true);
        setConfigMessage(null);
        try {
          const res = await fetch(`${API}/config`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            cache: 'no-store',
            body: JSON.stringify({ installDir, autoStart, showFooterStatus, showSidebarEntry }),
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok || body.ok === false) throw new Error(body.error ?? res.statusText);
          setConfigMessage(t('saved'));
          applyUiConfigProp?.(body);
          if (typeof window?.dispatchEvent === 'function') {
            try {
              window.dispatchEvent(new CustomEvent(CONFIG_EVENT, { detail: body }));
            } catch {
              // CustomEvent may be unavailable in an old host
            }
          }
          refreshAll();
        } catch (error) {
          setConfigMessage(`${t('errorTitle')}: ${error.message ?? String(error)}`);
        } finally {
          if (alive.current) setSavingConfig(false);
        }
      }, [installDir, autoStart, showFooterStatus, showSidebarEntry, applyUiConfigProp, refreshAll, t]);

      const saveKey = useCallback(async () => {
        const value = keyInput.trim();
        if (value === '') return;
        setSavingKey(true);
        setKeyMessage(null);
        try {
          const res = await fetch(`${API}/setup`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            cache: 'no-store',
            body: JSON.stringify({ action: 'save-key', apiKey: value }),
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok || body.ok === false) throw new Error(body.error ?? res.statusText);
          setKeyInput('');
          setKeyEditing(false);
          setKeyMessage(data?.running ? t('keySavedRestart') : t('keySaved'));
          await loadSetup();
          if (data?.running) {
            await fetch(`${API}/daemon`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              cache: 'no-store',
              body: JSON.stringify({ action: 'stop' }),
            }).catch(() => {});
            await fetch(`${API}/daemon`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              cache: 'no-store',
              body: JSON.stringify({ action: 'start' }),
            }).catch(() => {});
          }
          refreshAll();
        } catch (error) {
          setKeyMessage(`${t('errorTitle')}: ${error.message ?? String(error)}`);
        } finally {
          if (alive.current) setSavingKey(false);
        }
      }, [keyInput, data?.running, loadSetup, refreshAll, t]);

      const submitSearch = useCallback(async () => {
        const q = query.trim();
        if (q === '' || searching) return;
        setSearching(true);
        setResults(null);
        try {
          const res = await fetch(`${API}/search`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            cache: 'no-store',
            body: JSON.stringify({ query: q, budget: 'low' }),
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok || body.ok === false) throw new Error(body.error ?? res.statusText);
          if (alive.current) setResults(body.results ?? []);
        } catch (error) {
          if (alive.current) setResults({ error: error.message ?? String(error) });
        } finally {
          if (alive.current) setSearching(false);
        }
      }, [query, searching]);

      const status = data?.status ?? 'unknown';
      const running = status === 'running';
      const stats = data?.stats ?? null;
      const setupReady = setup?.ready === true;
      // Open by itself until setup completes; once ready it starts collapsed and
      // the toggle is the only thing that expands it.
      const stepsOpen = !setupReady || stepsExpanded;
      const retryIn =
        typeof data?.retryAt === 'number' && data.retryAt > 0
          ? Math.max(0, Math.ceil((data.retryAt - now) / 1000))
          : 0;
      const failure = data?.error ?? actionError;
      const hint = failure ? errorHint(failure, t) : null;
      const integration = setup?.integration ?? null;
      const apiKey = setup?.apiKey ?? null;
      const installing = setup?.install?.running === true || busy === 'install';
      const installDone = setup?.install?.ok === true;
      const proxy = setup?.network ?? data?.network ?? null;

      const goSettings = () => {
        try {
          settingsRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
        } catch {
          // cosmetic
        }
      };

      const bankSelectStyle = {
        border: `1px solid ${C.border2}`,
        background: C.base,
        color: C.text,
        borderRadius: 7,
        padding: '4px 6px',
        fontSize: 11.5,
      };
      const bankToggle = (label, key, hint) =>
        h(
          'label',
          { style: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' } },
          h('input', {
            type: 'checkbox',
            checked: bankDraft[key] === true,
            onChange: (event) => setBankDraft({ ...bankDraft, [key]: event.target.checked }),
            style: { width: 14, height: 14, cursor: 'pointer' },
          }),
          h('span', null, label),
          h('span', { style: { color: C.text3, fontSize: 11 } }, hint),
        );

      return h(
        'div',
        {
          style: {
            height: '100%',
            maxHeight: '100%',
            minHeight: 0,
            width: '100%',
            boxSizing: 'border-box',
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '20px clamp(16px, 4vw, 48px) 48px',
            color: C.text,
            fontSize: 13,
            lineHeight: 1.5,
          },
        },
        h(
          'div',
          { style: { maxWidth: 920, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 } },
          h('style', null, '@keyframes dsh-hm-spin{to{transform:rotate(360deg)}}'),

          // header + status
          h(
            'div',
            {
              style: {
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 16,
                flexWrap: 'wrap',
              },
            },
            h(
              'div',
              { style: { flex: '1 1 320px', minWidth: 0 } },
              h(
                'div',
                { style: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' } },
                h('div', { style: { fontSize: 20, fontWeight: 600 } }, t('title')),
                h(StatusPill, { status, t }),
                data?.bankExists === false ? h(Badge, null, t('bankNone')) : null,
              ),
              h('div', { style: { fontSize: 12, color: C.text2, marginTop: 4 } }, t('subtitle')),
            ),
            h(
              'div',
              { style: { display: 'flex', alignItems: 'center', gap: 8, paddingTop: 4 } },
              h(
                Button,
                { onClick: () => runAction('start'), disabled: running, busy: busy === 'start', primary: true },
                t('start'),
              ),
              h(Button, { onClick: () => runAction('stop'), disabled: !running, busy: busy === 'stop' }, t('stop')),
            ),
          ),

          // failure banner
          failure
            ? h(
                Card,
                { style: { borderColor: 'rgba(229,72,77,0.5)', background: 'rgba(229,72,77,0.08)' } },
                h(
                  'div',
                  { style: { display: 'flex', gap: 10, alignItems: 'flex-start' } },
                  h(Dot, { color: C.err, size: 9 }),
                  h(
                    'div',
                    { style: { flex: 1, minWidth: 0 } },
                    h('div', { style: { fontSize: 12.5, fontWeight: 600, color: C.err } }, t('errorTitle')),
                    h('div', { style: { fontSize: 12, color: C.text2, marginTop: 4, wordBreak: 'break-word' } }, failure),
                    hint ? h('div', { style: { fontSize: 11.5, color: C.text3, marginTop: 6 } }, hint) : null,
                    retryIn > 0
                      ? h('div', { style: { fontSize: 11.5, color: C.warn, marginTop: 6 } }, t('retryIn').replace('{n}', String(retryIn)))
                      : null,
                  ),
                  h(
                    Button,
                    { onClick: () => runAction('start'), busy: busy === 'start' },
                    retryIn > 0 ? t('retryNow') : t('retry'),
                  ),
                ),
              )
            : null,

          h(
            'div',
            { style: { display: 'flex', gap: 2, borderBottom: `1px solid ${C.border}`, marginTop: 2 } },
            h(ViewTab, { active: view === 'overview', onClick: () => setView('overview') }, t('tabOverview')),
            h(ViewTab, { active: view === 'graph', onClick: () => setView('graph') }, t('tabGraph')),
            h(ViewTab, { active: view === 'cleanup', onClick: () => setView('cleanup') }, t('tabCleanup')),
          ),

          view === 'graph'
            ? h(GraphPanel, { t, running, bank: data?.bank ?? null })
            : view === 'cleanup'
              ? h(CleanupPanel, {
                  t,
                  running,
                  data: cleanup,
                  loading: cleanupLoading,
                  staleDays,
                  onChangeStaleDays: setStaleDays,
                  onRefresh: loadCleanup,
                })
            : h('div', { style: { display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 } },
              // quick start / setup
              h(
                Card,
                null,
                h(
                  SectionTitle,
                  {
                    hint: setupReady && !stepsOpen ? t('readyDetail') : t('quickStartHint'),
                    right:
                      setupReady
                        ? h(
                            Button,
                            { onClick: () => setStepsExpanded(!stepsExpanded) },
                            stepsOpen ? t('hideSteps') : t('showSteps'),
                          )
                        : null,
                  },
                  setupReady && !stepsOpen ? `${t('quickStart')} · ${t('ready')}` : t('quickStart'),
                ),
                !setup
                  ? h('div', { style: { fontSize: 12, color: C.text3 } }, t('stateUnknown'))
                  : setupReady && !stepsOpen
                    ? h(
                        'div',
                        { style: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 12 } },
                        h(Dot, { color: C.ok, glow: true, size: 9 }),
                        h('span', { style: { color: C.ok, fontWeight: 600 } }, t('ready')),
                        h('span', { style: { color: C.text2 } }, data?.bank ?? ''),
                      )
                    : h(
                        'div',
                        null,
                        h(
                          Step,
                          {
                            index: 1,
                            title: t('stepIntegration'),
                            detail: integration?.installed
                              ? `${t('installed')}${integration.version ? ` v${integration.version}` : ''}`
                              : t('stepIntegrationDetail'),
                            done: integration?.installed === true,
                          },
                          integration?.installed
                            ? h(Badge, { done: true }, integration.enabled ? t('installed') : t('installedDisabled'))
                            : h(
                                Button,
                                { onClick: installIntegration, busy: installing, primary: true },
                                installing ? t('installing') : t('install'),
                              ),
                        ),
                        installDone
                          ? h('div', { style: { fontSize: 11.5, color: C.ok, paddingLeft: 30, paddingBottom: 6 } }, t('installDone'))
                          : null,
                        setup?.install?.error
                          ? h(
                              'div',
                              { style: { fontSize: 11.5, color: C.err, paddingLeft: 30, paddingBottom: 6, wordBreak: 'break-word' } },
                              `${t('installFailed')}: ${setup.install.error}`,
                            )
                          : null,

                        h(
                          Step,
                          {
                            index: 2,
                            title: t('stepKey'),
                            detail: apiKey?.configured
                              ? `${t('keySource')}: ${
                                  apiKey.source === 'panel'
                                    ? t('keySourcePanel')
                                    : apiKey.source === 'harness'
                                      ? t('keySourceHarness')
                                      : t('keySourceEnv')
                                }`
                              : t('stepKeyDetail'),
                            done: apiKey?.configured === true,
                          },
                          apiKey?.configured && !keyEditing
                            ? h(
                                'div',
                                { style: { display: 'flex', gap: 8, alignItems: 'center' } },
                                h(Badge, { done: true }, t('keySaved')),
                                h(Button, { onClick: () => setKeyEditing(true) }, t('changeKey')),
                              )
                            : h(
                                'div',
                                { style: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' } },
                                h('input', {
                                  type: 'password',
                                  value: keyInput,
                                  placeholder: t('keyPlaceholder'),
                                  onChange: (event) => setKeyInput(event.target.value),
                                  onKeyDown: (event) => {
                                    if (event.key === 'Enter') saveKey();
                                  },
                                  style: { ...inputStyle, width: 240, flex: 'none' },
                                  autoComplete: 'off',
                                  spellCheck: false,
                                }),
                                h(
                                  Button,
                                  { onClick: saveKey, busy: savingKey, disabled: keyInput.trim() === '', primary: true },
                                  savingKey ? t('savingKey') : t('saveKey'),
                                ),
                                keyEditing && apiKey?.configured
                                  ? h(Button, { onClick: () => setKeyEditing(false) }, t('cancel'))
                                  : null,
                              ),
                        ),
                        h('div', { style: { fontSize: 11, color: C.text3, paddingLeft: 30, paddingBottom: 6, wordBreak: 'break-word' } }, t('keyHint')),
                        keyMessage
                          ? h('div', { style: { fontSize: 11.5, color: keyMessage.startsWith(t('errorTitle')) ? C.err : C.ok, paddingLeft: 30, paddingBottom: 6 } }, keyMessage)
                          : null,

                        h(
                          Step,
                          {
                            index: 3,
                            title: t('stepCache'),
                            detail: setup?.config?.installDir || t('systemDefault'),
                            done: Boolean(setup?.config?.installDir),
                            optional: true,
                          },
                          h(Button, { onClick: goSettings }, t('goSettings')),
                        ),

                        h(
                          Step,
                          {
                            index: 4,
                            title: t('stepDaemon'),
                            detail:
                              status === 'running'
                                ? `${t('stateRunning')} · ${data?.bank ?? ''}`
                                : status === 'starting'
                                  ? t('startHint')
                                  : t('stepDaemonDetail'),
                            done: running,
                          },
                          running
                            ? h(Badge, { done: true }, t('stateRunning'))
                            : h(
                                Button,
                                { onClick: () => runAction('start'), busy: busy === 'start', primary: !running },
                                status === 'starting' ? t('stateStarting') : t('start'),
                              ),
                        ),
                      ),
              ),

              // runtime status
              h(
                Card,
                null,
                h(SectionTitle, { hint: data?.running ? '' : t('downHint') }, t('bank')),
                data
                  ? h(
                      'div',
                      { style: { display: 'flex', flexDirection: 'column', gap: 7 } },
                      h(
                        Row,
                        { label: t('bank') },
                        h(
                          'select',
                          {
                            value: bankChoice,
                            disabled: bankBusy || !data.running,
                            onChange: (event) => changeBank(event.target.value),
                            style: {
                              maxWidth: 330,
                              border: `1px solid ${C.border2}`,
                              background: C.base,
                              color: C.text,
                              borderRadius: 7,
                              padding: '3px 6px',
                              fontSize: 11.5,
                            },
                          },
                          h(
                            'option',
                            { value: '' },
                            `${t('bankAuto')}${data.bank ? ` · ${String(data.bank).replace(/^coding-agent::/, '')}` : ''}`,
                          ),
                          ...(banks ?? []).map((bank) =>
                            h(
                              'option',
                              { key: bank.id, value: bank.id },
                              `${String(bank.id).replace(/^coding-agent::/, '')} · ${fmt(bank.facts)} ${t('factsShort')} · ${timeAgo(bank.lastWriteAt)}`,
                            ),
                          ),
                        ),
                      ),
                      h('div', { style: { fontSize: 11, color: C.text3 } }, t('bankSelectHint')),
                      bankMessage ? h('div', { style: { fontSize: 11.5, color: C.err } }, bankMessage) : null,
                      h(Row, { label: t('port') }, String(data.daemonPort)),
                      h(Row, { label: t('version') }, data.apiVersion ?? '—'),
                      data.env ? h(Row, { label: t('provider') }, `${data.env.provider} / ${data.env.model}`) : null,
                      h(Row, { label: t('cache') }, data.config?.installDir || t('systemDefault')),
                      h(
                        Row,
                        { label: t('network') },
                        proxy?.bypassProxy ? t('direct') : t('normalNetwork'),
                      ),
                    )
                  : h('div', { style: { fontSize: 12, color: C.text3 } }, t('stateUnknown')),
                data?.bankExists === false && data?.running
                  ? h('div', { style: { marginTop: 10, fontSize: 11.5, color: C.text3 } }, t('bankPending'))
                  : null,
                loadError
                  ? h(
                      'div',
                      { style: { marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: C.err } },
                      `${t('errorTitle')}: ${loadError}`,
                      h(Button, { onClick: refreshAll }, t('retry')),
                    )
                  : null,
              ),

              // stats
              h(
                Card,
                null,
                h(SectionTitle, null, t('stats')),
                h(
                  'div',
                  { style: { display: 'flex', gap: 28, flexWrap: 'wrap' } },
                  h(Stat, { label: t('documents'), value: fmt(stats?.total_documents) }),
                  h(Stat, { label: t('facts'), value: fmt(stats?.total_nodes) }),
                  h(Stat, { label: t('links'), value: fmt(stats?.total_links) }),
                  h(Stat, { label: t('observations'), value: fmt(stats?.total_observations) }),
                ),
                data?.bankExists === false && data?.running
                  ? h('div', { style: { marginTop: 10, fontSize: 11.5, color: C.text3 } }, t('bankPending'))
                  : null,
              ),

              // search
              h(
                Card,
                null,
                h(SectionTitle, { hint: t('searchHint') }, t('search')),
                h(
                  'div',
                  { style: { display: 'flex', gap: 8 } },
                  h('input', {
                    type: 'search',
                    value: query,
                    placeholder: t('searchPlaceholder'),
                    disabled: !running,
                    onChange: (event) => setQuery(event.target.value),
                    onKeyDown: (event) => {
                      if (event.key === 'Enter') submitSearch();
                    },
                    style: inputStyle,
                  }),
                  h(
                    Button,
                    { onClick: submitSearch, disabled: !running || query.trim() === '', busy: searching },
                    searching ? t('searching') : t('searchButton'),
                  ),
                ),
                results === null
                  ? null
                  : Array.isArray(results) && results.length === 0
                    ? h('div', { style: { marginTop: 12, fontSize: 12, color: C.text3 } }, t('searchEmpty'))
                    : results?.error
                      ? h('div', { style: { marginTop: 12, fontSize: 12, color: C.err } }, results.error)
                      : h(
                          'div',
                          { style: { marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 } },
                          h('div', { style: { fontSize: 11, color: C.text3 } }, `${results.length} ${t('results')}`),
                          ...results.slice(0, 12).map((item, index) =>
                            h(
                              'div',
                              {
                                key: index,
                                style: { padding: '8px 10px', borderRadius: 8, background: C.surface2, fontSize: 12, color: C.text },
                              },
                              item.text ?? JSON.stringify(item),
                            ),
                          ),
                        ),
              ),

              // documents
              h(
                Card,
                null,
                h(SectionTitle, { hint: t('recentHint') }, t('recent')),
                documents === null
                  ? h('div', { style: { fontSize: 12, color: C.text3 } }, '—')
                  : documents.length === 0
                    ? h('div', { style: { fontSize: 12, color: C.text3 } }, t('recentEmpty'))
                    : h(
                        'div',
                        { style: { display: 'flex', flexDirection: 'column', gap: 1 } },
                        ...documents.map((doc, index) =>
                          h(
                            'div',
                            {
                              key: doc.id ?? index,
                              style: {
                                display: 'flex',
                                alignItems: 'baseline',
                                gap: 12,
                                padding: '8px 0',
                                borderTop: index === 0 ? 'none' : `1px solid ${C.border}`,
                                fontSize: 12,
                              },
                            },
                            h(
                              'code',
                              {
                                title: doc.id,
                                style: {
                                  flex: 1,
                                  minWidth: 0,
                                  fontFamily: 'ui-monospace, monospace',
                                  fontSize: 11,
                                  color: C.text2,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                },
                              },
                              String(doc.id ?? '').slice(0, 48),
                            ),
                            h('span', { style: { flex: 'none', color: C.text3 } }, `${fmt(doc.text_length)} ${t('chars')}`),
                            h('span', { style: { flex: 'none', color: C.text3 } }, `${fmt(doc.memory_unit_count)} ${t('factsShort')}`),
                            h('span', { style: { flex: 'none', color: C.text3, minWidth: 32, textAlign: 'right' } }, timeAgo(doc.created_at)),
                          ),
                        ),
                      ),
              ),

              // settings
              h(
                'div',
                { ref: settingsRef },
                h(
                  Card,
                  null,
                  h(SectionTitle, { hint: t('settingsHint') }, t('settings')),
                  h(
                    'div',
                    { style: { display: 'flex', flexDirection: 'column', gap: 14 } },
                    h(
                      'div',
                      { style: { display: 'flex', flexDirection: 'column', gap: 4 } },
                      h('span', { style: { fontSize: 12, color: C.text } }, t('installDir')),
                      h(
                        'div',
                        { style: { display: 'flex', gap: 8, alignItems: 'center' } },
                        h('input', {
                          type: 'text',
                          value: installDir,
                          placeholder: 'e.g. D:\\hindsight',
                          onChange: (event) => setInstallDir(event.target.value),
                          style: inputStyle,
                        }),
                        h(
                          Button,
                          { onClick: pickCacheDir, busy: picking, disabled: !pickDirectoryProp },
                          picking ? t('picking') : t('browse'),
                        ),
                      ),
                      h('span', { style: { fontSize: 11, color: C.text3 } }, t('installDirHint')),
                    ),
                    h(
                      'label',
                      { style: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' } },
                      h('input', {
                        type: 'checkbox',
                        checked: autoStart,
                        onChange: (event) => setAutoStart(event.target.checked),
                        style: { width: 14, height: 14, cursor: 'pointer' },
                      }),
                      h('span', null, t('autoStart')),
                      h('span', { style: { color: C.text3, fontSize: 11 } }, t('autoStartHint')),
                    ),
                    h(
                      'label',
                      { style: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' } },
                      h('input', {
                        type: 'checkbox',
                        checked: showFooterStatus,
                        onChange: (event) => setShowFooterStatus(event.target.checked),
                        style: { width: 14, height: 14, cursor: 'pointer' },
                      }),
                      h('span', null, t('footerStatus')),
                      h('span', { style: { color: C.text3, fontSize: 11 } }, t('footerStatusHint')),
                    ),
                    h(
                      'label',
                      { style: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' } },
                      h('input', {
                        type: 'checkbox',
                        checked: showSidebarEntry,
                        onChange: (event) => setShowSidebarEntry(event.target.checked),
                        style: { width: 14, height: 14, cursor: 'pointer' },
                      }),
                      h('span', null, t('sidebarEntry')),
                      h('span', { style: { color: C.text3, fontSize: 11 } }, t('sidebarEntryHint')),
                    ),
                    h(
                      'div',
                      { style: { display: 'flex', alignItems: 'center', gap: 12 } },
                      h(Button, { onClick: saveSettings, primary: true, busy: savingConfig }, savingConfig ? t('saving') : t('save')),
                      configMessage
                        ? h('span', { style: { fontSize: 11, color: configMessage.startsWith(t('errorTitle')) ? C.err : C.ok } }, configMessage)
                        : h('span', { style: { fontSize: 11, color: C.text3 } }, t('configNote')),
                    ),
                  ),
                ),
              ),

              // bank health
              data?.running
                ? h(
                    Card,
                    null,
                    h(SectionTitle, { hint: t('bankHealthHint') }, t('bankHealth')),
                    extrasMissing
                      ? h('div', { style: { fontSize: 12, color: C.text3 } }, t('extrasMissing'))
                      : health
                      ? h(
                          'div',
                          { style: { display: 'flex', flexDirection: 'column', gap: 7 } },
                          h(
                            Row,
                            { label: t('lastWrite') },
                            health.stats?.last_memory_write_at
                              ? `${timeAgo(health.stats.last_memory_write_at)} · ${shortDate(health.stats.last_memory_write_at)}`
                              : '—',
                          ),
                          h(
                            Row,
                            { label: t('lastConsolidated') },
                            health.stats?.last_consolidated_at
                              ? `${timeAgo(health.stats.last_consolidated_at)} · ${shortDate(health.stats.last_consolidated_at)}`
                              : '—',
                          ),
                          h(
                            Row,
                            { label: t('pendingOps') },
                            `${fmt(health.stats?.pending_operations ?? 0)} / ${t('failedOps')} ${fmt(health.stats?.failed_operations ?? 0)}`,
                          ),
                          h(
                            Row,
                            { label: t('cleanupPending') },
                            cleanupLoading && cleanup === null
                              ? h('span', { style: { fontSize: 11.5, color: C.text3 } }, t('cleanupScanning'))
                              : cleanup && cleanup.error === undefined
                                ? h(
                                    'div',
                                    { style: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: 11.5, color: C.text2 } },
                                    h('span', null, `${t('cleanupForgotten')} ${fmt(cleanup.counts?.invalidated ?? 0)}`),
                                    h('span', null, `${t('cleanupDuplicates')} ${fmt(cleanup.counts?.duplicateGroups ?? 0)}`),
                                    h('span', null, `${t('cleanupStale')} ${fmt(cleanup.counts?.stale ?? 0)}`),
                                    h(Button, { onClick: () => setView('cleanup') }, t('cleanupOpen')),
                                  )
                                : h('span', { style: { fontSize: 11.5, color: C.text3 } }, '—'),
                          ),
                          h(
                            Row,
                            { label: t('factBreakdown') },
                            h(
                              'span',
                              { style: { fontSize: 11.5, color: C.text2 } },
                              `world ${fmt(health.stats?.nodes_by_fact_type?.world ?? 0)} · experience ${fmt(
                                health.stats?.nodes_by_fact_type?.experience ?? 0,
                              )} · observation ${fmt(health.stats?.nodes_by_fact_type?.observation ?? 0)}`,
                            ),
                          ),
                        )
                      : h('div', { style: { fontSize: 12, color: C.text3 } }, t('stateUnknown')),
                    extrasMissing
                      ? null
                      : h(
                      'div',
                      { style: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' } },
                      h(Button, { onClick: runProbe, busy: probing }, probing ? t('probing') : t('probe')),
                      probe?.error
                        ? h('span', { style: { fontSize: 11.5, color: C.err } }, `${t('probeFailed')}: ${probe.error}`)
                        : probe
                          ? h(
                              'span',
                              { style: { fontSize: 11.5, color: C.text3 } },
                              `${fill(t('probeResult'), {
                                budget: probe.budget ?? searchBudget,
                                ms: probe.ms,
                                results: probe.results,
                                tokens: fmt(probe.tokens),
                              })} · ${timeAgo(new Date(probe.at).toISOString())}`,
                            )
                          : null,
                    ),
                    extrasMissing ? null : h('div', { style: { fontSize: 10.5, color: C.text3, marginTop: 6 } }, t('probeHint')),
                  )
                : null,

              // bank settings
              data?.running
                ? h(
                    Card,
                    null,
                    h(SectionTitle, { hint: t('bankConfigHint') }, t('bankConfig')),
                    extrasMissing
                      ? h('div', { style: { fontSize: 12, color: C.text3 } }, t('extrasMissing'))
                      : bankConfig === null
                      ? h('div', { style: { fontSize: 12, color: C.text3 } }, t('stateUnknown'))
                      : h(
                          'div',
                          { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
                          h(
                            'div',
                            { style: { display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-end' } },
                            h(
                              'label',
                              { style: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 } },
                              h('span', { style: { color: C.text2 } }, t('bankMaxTokens')),
                              h('input', {
                                type: 'number',
                                min: 256,
                                max: 8192,
                                step: 128,
                                value: bankDraft.recall_max_tokens ?? '',
                                onChange: (event) =>
                                  setBankDraft({ ...bankDraft, recall_max_tokens: Number(event.target.value) }),
                                style: { ...inputStyle, width: 110, flex: 'none' },
                              }),
                            ),
                            h(
                              'label',
                              { style: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 } },
                              h('span', { style: { color: C.text2 } }, t('bankBudget')),
                              h(
                                'select',
                                {
                                  value: bankDraft.recall_budget_function ?? 'fixed',
                                  onChange: (event) =>
                                    setBankDraft({ ...bankDraft, recall_budget_function: event.target.value }),
                                  style: bankSelectStyle,
                                },
                                h('option', { value: 'fixed' }, t('budgetFixed')),
                                h('option', { value: 'adaptive' }, t('budgetAdaptive')),
                              ),
                            ),
                            h(
                              'label',
                              { style: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 } },
                              h('span', { style: { color: C.text2 } }, t('searchBudget')),
                              h(
                                'select',
                                {
                                  value: searchBudget,
                                  onChange: (event) => changeSearchBudget(event.target.value),
                                  style: bankSelectStyle,
                                  title: t('searchBudgetHint'),
                                },
                                ['low', 'mid', 'high'].map((tier) => h('option', { key: tier, value: tier }, tier)),
                              ),
                            ),
                            h(
                              'label',
                              { style: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 } },
                              h('span', { style: { color: C.text2 } }, t('bankExtraction')),
                              h(
                                'select',
                                {
                                  value: bankDraft.retain_extraction_mode ?? 'concise',
                                  onChange: (event) =>
                                    setBankDraft({ ...bankDraft, retain_extraction_mode: event.target.value }),
                                  style: bankSelectStyle,
                                },
                                ['concise', 'verbose', 'verbatim', 'chunks'].map((mode) =>
                                  h('option', { key: mode, value: mode }, mode),
                                ),
                              ),
                            ),
                          ),
                          h('div', { style: { fontSize: 10.5, color: C.text3, marginTop: -4 } }, t('bankMaxTokensHint')),
                          bankToggle(t('bankReranking'), 'enable_reranking', t('bankRerankingHint')),
                          bankToggle(t('bankObservations'), 'enable_observations', t('bankObservationsHint')),
                          bankToggle(t('bankAutoConsolidation'), 'enable_auto_consolidation', t('bankAutoConsolidationHint')),
                          h(
                            'div',
                            { style: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' } },
                            h(
                              Button,
                              { onClick: saveBankConfig, primary: true, busy: bankConfigBusy },
                              bankConfigBusy ? t('saving') : t('save'),
                            ),
                            bankConfigMessage
                              ? h(
                                  'span',
                                  {
                                    style: {
                                      fontSize: 11,
                                      color: bankConfigMessage.startsWith(t('bankConfigFailed')) ? C.err : C.ok,
                                    },
                                  },
                                  bankConfigMessage,
                                )
                              : null,
                          ),
                        ),
                  )
                : null,

              // diagnostics
              setup
                ? h(
                    Card,
                    null,
                    h(SectionTitle, null, t('diagnostics')),
                    h(
                      'div',
                      { style: { display: 'flex', flexDirection: 'column', gap: 7 } },
                      h(
                        Row,
                        { label: t('versionLabel') },
                        h(
                          'div',
                          { style: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' } },
                          h('span', { style: mono }, `v${data?.pluginVersion ?? '—'}`),
                          h(Button, { onClick: checkUpdate, busy: checkingUpdate }, checkingUpdate ? t('checkingUpdate') : t('checkUpdate')),
                        ),
                      ),
                      update?.error
                        ? h('div', { style: { fontSize: 11.5, color: C.err } }, `${t('updateFailed')}: ${update.error}`)
                        : update
                          ? h(
                              'div',
                              { style: { fontSize: 11.5, lineHeight: 1.6, color: update.updateAvailable ? C.warn : C.ok } },
                              update.updateAvailable
                                ? `${t('updateAvailable')} v${update.latest}（${t('versionLabel')} v${update.current}）`
                                : `${t('updateLatest')}（v${update.current}）`,
                              update.updateAvailable
                                ? h(
                                    'div',
                                    { style: { ...mono, marginTop: 4, whiteSpace: 'pre-wrap', fontSize: 10.5, color: C.text2 } },
                                    `${t('updateHow')}\n` +
                                      `git pull\n` +
                                      `dsh plugin --profile ${setup.profile ?? 'desktop'} remove dsh-hindsight-manager\n` +
                                      `dsh plugin --profile ${setup.profile ?? 'desktop'} add file:<仓库目录>`,
                                  )
                                : null,
                            )
                          : null,
                      h(Row, { label: t('profileLabel') }, setup.profile ?? '—'),
                      h(
                        Row,
                        { label: t('integrationLabel') },
                        setup.integration?.installed
                          ? `${t('installed')}${setup.integration.version ? ` v${setup.integration.version}` : ''}`
                          : t('stateStopped'),
                      ),
                      h(Row, { label: t('modelsLabel') }, setup.models?.embeddings && setup.models?.reranker ? t('modelsOk') : t('modelsMissing')),
                      h(Row, { label: t('logPath') }, h('code', { style: mono }, `~/.hindsight/profiles/${'coding-agent'}.log`)),
                      h(Row, { label: t('envPath') }, h('code', { style: mono }, '~/.hindsight/profiles/coding-agent.env')),
                      h(Row, { label: t('dataDir') }, h('code', { style: mono }, setup.config?.installDir || '~/.hindsight')),
                      proxy?.systemProxy
                        ? h(
                            'div',
                            { style: { fontSize: 11.5, color: proxy.bypassProxy ? C.warn : C.text3, marginTop: 2 } },
                            (proxy.bypassProxy ? t('proxyNote') : t('proxyOk')).replace('{proxy}', proxy.systemProxy),
                          )
                        : null,
                    ),
                  )
                : null,
            ),
        ),
      );
    }

    // ── graph view ───────────────────────────────────────────────────────────
    // The bank's entity co-occurrence graph, drawn as SVG without a chart
    // library: one radial layout for a focused entity, one force layout for the
    // whole bank. Layouts are cached by stamp so panning and hovering never
    // recompute them.

    const GRAPH_PALETTE = ['#5b8def', '#43b38a', '#c99a3f', '#9b7ede', '#3fa7b8', '#c96b7a'];
    const FACT_COLORS = { world: '#9b7ede', experience: '#43b38a', observation: '#c99a3f', fact: '#5b8def' };
    const graphLayouts = new Map();

    const fill = (template, values) =>
      String(template).replace(/\{(\w+)\}/g, (match, key) => (values[key] === undefined ? match : String(values[key])));
    const formatMoment = (ms) => {
      const date = new Date(ms);
      const pad = (value) => String(value).padStart(2, '0');
      return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };
    const shortDate = (iso) => (typeof iso === 'string' && iso.length >= 10 ? iso.slice(5, 10) : '—');

    function buildAdjacency(edges) {
      const map = new Map();
      for (const edge of edges) {
        if (!map.has(edge.source)) map.set(edge.source, []);
        if (!map.has(edge.target)) map.set(edge.target, []);
        map.get(edge.source).push({ id: edge.target, weight: edge.weight ?? 1 });
        map.get(edge.target).push({ id: edge.source, weight: edge.weight ?? 1 });
      }
      return map;
    }

    function nodeRadius(mentions, maxMentions) {
      const ratio = maxMentions > 0 ? Math.min(1, Math.max(0, (mentions ?? 1) / maxMentions)) : 0;
      return 4 + 9 * Math.sqrt(ratio);
    }

    function textWidth(text, size) {
      let width = 0;
      for (const character of String(text)) {
        width += /[\u2e80-\u9fff\uff00-\uffef]/.test(character) ? size : size * 0.56;
      }
      return width;
    }

    /** Clip a label to the space left in the canvas, so narrow windows never cut text. */
    function fitText(text, maxWidth, size) {
      if (maxWidth <= 24) return null;
      if (textWidth(text, size) <= maxWidth) return text;
      let out = '';
      for (const character of String(text)) {
        if (textWidth(out + character + '…', size) > maxWidth) break;
        out += character;
      }
      return out === '' ? null : out + '…';
    }

    function makeRandom(seed) {
      let state = seed >>> 0;
      return () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 4294967296;
      };
    }

    function heatColor(ratio) {
      const from = [77, 124, 255];
      const to = [240, 163, 67];
      const channel = (index) => Math.round(from[index] + (to[index] - from[index]) * Math.max(0, Math.min(1, ratio)));
      return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
    }

    /**
     * Focus mode: the selected entity in the middle, everything it co-occurs
     * with on the first ring, and their neighbours on the second. Radial by
     * construction, so it never collapses into a hairball.
     */
    function focusLayout(nodes, edges, focusId, width, height) {
      const byId = new Map(nodes.map((node) => [node.id, node]));
      const hub = byId.get(focusId);
      if (!hub) return null;
      const adjacency = buildAdjacency(edges);
      const maxMentions = Math.max(1, ...nodes.map((node) => node.mentions ?? 1));
      const neighbours = [...(adjacency.get(hub.id) ?? [])]
        .filter((entry) => byId.has(entry.id))
        .sort((left, right) => right.weight - left.weight)
        .slice(0, 16);
      const ring1Ids = new Set(neighbours.map((entry) => entry.id));

      const outerGroups = new Map();
      for (const entry of neighbours) {
        const group = [];
        for (const other of adjacency.get(entry.id) ?? []) {
          if (other.id === hub.id || ring1Ids.has(other.id) || !byId.has(other.id)) continue;
          group.push(other);
        }
        group.sort((left, right) => right.weight - left.weight);
        outerGroups.set(entry.id, group.slice(0, 6));
      }

      const centerX = width / 2;
      const centerY = height / 2;
      const base = Math.min(width, height);
      const radius1 = Math.max(82, Math.min(170, base * 0.33));
      const radius2 = Math.max(radius1 + 42, Math.min(240, base * 0.46));

      const positions = new Map();
      const ring = new Map();
      positions.set(hub.id, { x: centerX, y: centerY });
      ring.set(hub.id, 0);

      const ring1 = neighbours.map((entry, position) => {
        const angle = (position / Math.max(1, neighbours.length)) * Math.PI * 2 - Math.PI / 2;
        positions.set(entry.id, {
          x: centerX + Math.cos(angle) * radius1,
          y: centerY + Math.sin(angle) * radius1,
        });
        ring.set(entry.id, 1);
        return { id: entry.id, angle };
      });

      const outer = [];
      const placedOuter = new Set();
      for (const parent of ring1) {
        const group = (outerGroups.get(parent.id) ?? []).filter((entry) => !placedOuter.has(entry.id));
        group.forEach((entry, position) => {
          placedOuter.add(entry.id);
          const offset = group.length <= 1 ? 0 : (position - (group.length - 1) / 2) * 0.24;
          const angle = parent.angle + offset;
          positions.set(entry.id, {
            x: centerX + Math.cos(angle) * radius2,
            y: centerY + Math.sin(angle) * radius2,
          });
          ring.set(entry.id, 2);
          outer.push({ id: entry.id, parent: parent.id, weight: entry.weight });
        });
      }

      const visible = neighbours.map((entry) => ({
        source: hub.id,
        target: entry.id,
        weight: entry.weight,
        kind: 'hub',
      }));
      for (const entry of outer) {
        visible.push({ source: entry.parent, target: entry.id, weight: entry.weight, kind: 'outer' });
      }
      for (const edge of edges) {
        if (!ring1Ids.has(edge.source) || !ring1Ids.has(edge.target)) continue;
        visible.push({ source: edge.source, target: edge.target, weight: edge.weight, kind: 'peer' });
      }

      const labelIds = new Set([hub.id, ...ring1Ids]);

      return {
        mode: 'focus',
        focusId: hub.id,
        positions,
        ring,
        labelIds,
        visible,
        adjacency,
        hidden: 0,
        maxMentions,
      };
    }

    /**
     * Whole-bank mode: every entity above the mention threshold, a deterministic
     * force layout, lighter edges, and colours from communities — or, when the
     * bank is one big hub cluster, a mention heat scale so the map still reads.
     */
    function fullLayout(nodes, edges, width, height, minCount, stamp) {
      const cacheKey = `full|${stamp}|${width}x${height}|${minCount}`;
      const cached = graphLayouts.get(cacheKey);
      if (cached) return cached;

      const kept = [...nodes]
        .filter((node) => (node.mentions ?? 1) >= minCount)
        .sort((left, right) => (right.mentions ?? 1) - (left.mentions ?? 1))
        .slice(0, 160);
      const keptIds = new Set(kept.map((node) => node.id));
      const pairs = new Map();
      for (const edge of edges) {
        if (!keptIds.has(edge.source) || !keptIds.has(edge.target)) continue;
        const pairKey = edge.source < edge.target ? `${edge.source}|${edge.target}` : `${edge.target}|${edge.source}`;
        const previous = pairs.get(pairKey);
        if (!previous || (edge.weight ?? 1) > previous.weight) {
          pairs.set(pairKey, { source: edge.source, target: edge.target, weight: edge.weight ?? 1, kind: 'peer' });
        }
      }
      const visible = [...pairs.values()].sort((left, right) => right.weight - left.weight).slice(0, 1400);
      const adjacency = buildAdjacency(visible);

      const count = kept.length;
      const maxMentions = Math.max(1, ...nodes.map((node) => node.mentions ?? 1));
      const index = new Map(kept.map((node, position) => [node.id, position]));
      const random = makeRandom((count * 7919 + minCount * 104729 + 17) >>> 0);
      const pad = 36;
      const innerWidth = Math.max(140, width - pad * 2);
      const innerHeight = Math.max(140, height - pad * 2);
      const points = kept.map((_, position) => {
        const angle = (position / Math.max(1, count)) * Math.PI * 2 + random() * 0.6;
        const radius = Math.min(innerWidth, innerHeight) * (0.18 + random() * 0.2);
        return { x: width / 2 + Math.cos(angle) * radius, y: height / 2 + Math.sin(angle) * radius };
      });

      const k = 1.3 * Math.sqrt((innerWidth * innerHeight) / Math.max(1, count));
      const linkDistance = Math.max(46, Math.min(110, k * 1.15));
      const iterations = count > 150 ? 300 : 460;
      for (let iteration = 0; iteration < iterations; iteration++) {
        const temperature = 34 * Math.pow(1 - iteration / iterations, 1.6) + 0.5;
        const displacement = kept.map(() => ({ x: 0, y: 0 }));
        for (let left = 0; left < count; left++) {
          for (let right = left + 1; right < count; right++) {
            let dx = points[left].x - points[right].x;
            let dy = points[left].y - points[right].y;
            let distance2 = dx * dx + dy * dy;
            if (distance2 < 1) {
              dx = random() - 0.5;
              dy = random() - 0.5;
              distance2 = dx * dx + dy * dy || 1;
            }
            const distance = Math.sqrt(distance2);
            const force = (0.9 * k * k) / distance;
            const ux = dx / distance;
            const uy = dy / distance;
            displacement[left].x += ux * force;
            displacement[left].y += uy * force;
            displacement[right].x -= ux * force;
            displacement[right].y -= uy * force;
          }
        }
        for (const edge of visible) {
          const from = index.get(edge.source);
          const to = index.get(edge.target);
          if (from === undefined || to === undefined) continue;
          const dx = points[from].x - points[to].x;
          const dy = points[from].y - points[to].y;
          const distance = Math.max(Math.hypot(dx, dy), 0.5);
          const force = (distance - linkDistance) * 0.052;
          const ux = (dx / distance) * force;
          const uy = (dy / distance) * force;
          displacement[from].x -= ux;
          displacement[from].y -= uy;
          displacement[to].x += ux;
          displacement[to].y += uy;
        }
        for (let position = 0; position < count; position++) {
          displacement[position].x -= (points[position].x - width / 2) * 0.055;
          displacement[position].y -= (points[position].y - height / 2) * 0.055;
          const length = Math.max(Math.hypot(displacement[position].x, displacement[position].y), 0.01);
          const step = Math.min(length, temperature);
          points[position].x += (displacement[position].x / length) * step;
          points[position].y += (displacement[position].y / length) * step;
        }
      }

      const xs = points.map((point) => point.x);
      const ys = points.map((point) => point.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const spanX = Math.max(maxX - minX, 1);
      const spanY = Math.max(maxY - minY, 1);
      const scale = Math.min(innerWidth / spanX, innerHeight / spanY, 1.5);
      const offsetX = pad + (innerWidth - spanX * scale) / 2;
      const offsetY = pad + (innerHeight - spanY * scale) / 2;

      const positions = new Map();
      kept.forEach((node, position) => {
        positions.set(node.id, {
          x: offsetX + (points[position].x - minX) * scale,
          y: offsetY + (points[position].y - minY) * scale,
        });
      });

      let labels = kept.map((_, position) => position);
      if (count > 1) {
        for (let round = 0; round < 6; round++) {
          const next = labels.slice();
          kept.forEach((node, position) => {
            const tally = new Map();
            for (const entry of adjacency.get(node.id) ?? []) {
              const other = index.get(entry.id);
              if (other === undefined) continue;
              tally.set(labels[other], (tally.get(labels[other]) ?? 0) + entry.weight);
            }
            let best = labels[position];
            let bestScore = -1;
            for (const [label, score] of tally) {
              if (score > bestScore) {
                best = label;
                bestScore = score;
              }
            }
            next[position] = best;
          });
          labels = next;
        }
      }
      const clusterSizes = new Map();
      for (const label of labels) clusterSizes.set(label, (clusterSizes.get(label) ?? 0) + 1);
      const largestShare = Math.max(...clusterSizes.values()) / Math.max(1, count);
      const colors = new Map();
      if (clusterSizes.size <= 1 || largestShare > 0.55) {
        for (const node of kept) colors.set(node.id, heatColor(Math.min(1, (node.mentions ?? 1) / maxMentions)));
      } else {
        const ranking = [...clusterSizes.entries()].sort((left, right) => right[1] - left[1]);
        const paletteIndex = new Map(ranking.map(([label], position) => [label, position]));
        kept.forEach((node, position) => {
          colors.set(node.id, GRAPH_PALETTE[paletteIndex.get(labels[position]) % GRAPH_PALETTE.length]);
        });
      }

      const labelIds = new Set();
      const boxes = [];
      const candidates = [...kept].sort((left, right) => (right.mentions ?? 1) - (left.mentions ?? 1));
      for (const node of candidates) {
        if (labelIds.size >= 8) break;
        const point = positions.get(node.id);
        if (!point) continue;
        const radius = nodeRadius(node.mentions, maxMentions);
        const width_ = textWidth(node.label, 10);
        const box = {
          left: point.x - width_ / 2 - 1,
          right: point.x + width_ / 2 + 1,
          top: point.y + radius + 2,
          bottom: point.y + radius + 13,
        };
        if (boxes.some((other) => box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top)) {
          continue;
        }
        boxes.push(box);
        labelIds.add(node.id);
      }

      const result = {
        mode: 'full',
        focusId: null,
        positions,
        ring: null,
        labelIds,
        visible,
        adjacency,
        hidden: nodes.length - kept.length,
        maxMentions,
        colors,
      };
      graphLayouts.set(cacheKey, result);
      if (graphLayouts.size > 8) graphLayouts.delete(graphLayouts.keys().next().value);
      return result;
    }

    function computeLayout(options) {
      const { nodes, edges, focusId, width, height, minCount, stamp } = options;
      if (!Array.isArray(nodes) || nodes.length === 0) return null;
      if (focusId) {
        const focused = focusLayout(nodes, edges, focusId, width, height);
        if (focused) return focused;
      }
      return fullLayout(nodes, edges, width, height, minCount ?? 1, stamp ?? 0);
    }

    function GraphCanvas(props) {
      const t = typeof props?.t === 'function' ? props.t : fallbackT;
      const width = Math.max(220, Math.round(props?.width ?? 620));
      const height = Math.max(180, Math.round(props?.height ?? 420));
      const nodes = Array.isArray(props?.nodes) ? props.nodes : [];
      const edges = Array.isArray(props?.edges) ? props.edges : [];
      const focusId = props?.focusId ?? null;
      const search = String(props?.search ?? '').trim().toLowerCase();
      const reveal = props?.reveal ?? null;
      const [zoom, setZoom] = useState(1);
      const [pan, setPan] = useState({ x: 0, y: 0 });
      const [hoverId, setHoverId] = useState(null);
      const viewRef = useRef({ zoom: 1, pan: { x: 0, y: 0 } });
      const svgRef = useRef(null);
      const dragRef = useRef(null);
      const layoutRef = useRef({ key: null, layout: null });

      useEffect(() => {
        viewRef.current = { zoom, pan };
      }, [zoom, pan]);

      useEffect(() => {
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }, [focusId]);

      // React attaches wheel listeners passively, so the native one is used here
      // only to allow preventDefault while zooming the canvas.
      useEffect(() => {
        const svg = svgRef.current;
        if (!svg || typeof svg.addEventListener !== 'function') return () => {};
        const handleWheel = (event) => {
          event.preventDefault();
          const rect = svg.getBoundingClientRect?.() ?? { left: 0, top: 0 };
          const pointerX = event.clientX - rect.left;
          const pointerY = event.clientY - rect.top;
          const current = viewRef.current;
          const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
          const nextZoom = Math.min(3, Math.max(0.55, current.zoom * factor));
          const ratio = nextZoom / current.zoom;
          setZoom(nextZoom);
          setPan({
            x: pointerX - (pointerX - current.pan.x) * ratio,
            y: pointerY - (pointerY - current.pan.y) * ratio,
          });
        };
        svg.addEventListener('wheel', handleWheel, { passive: false });
        return () => svg.removeEventListener('wheel', handleWheel);
      }, []);

      const layoutKey = `${focusId ?? ''}|${width}x${height}|${props?.minCount ?? 1}|${props?.stamp ?? 0}|${nodes.length}|${edges.length}`;
      if (layoutRef.current.key !== layoutKey) {
        layoutRef.current = {
          key: layoutKey,
          layout: computeLayout({
            nodes,
            edges,
            focusId,
            width,
            height,
            minCount: props?.minCount ?? 1,
            stamp: props?.stamp ?? 0,
          }),
        };
      }
      const layout = layoutRef.current.layout;
      if (!layout) return null;

      const nodeById = new Map(nodes.map((node) => [node.id, node]));
      const activeId = hoverId ?? focusId;
      const highlight = new Set();
      if (search !== '') {
        for (const node of nodes) {
          if (String(node.label).toLowerCase().includes(search)) highlight.add(node.id);
        }
      } else if (activeId) {
        highlight.add(activeId);
        for (const entry of layout.adjacency.get(activeId) ?? []) highlight.add(entry.id);
      }
      const highlighted = search !== '' || activeId !== null;

      const bornAt = (iso) => {
        const value = Date.parse(iso ?? '');
        return Number.isFinite(value) ? value : null;
      };
      const points = [];
      for (const [id, point] of layout.positions) {
        const node = nodeById.get(id);
        if (!node) continue;
        if (reveal !== null) {
          const born = bornAt(node.firstSeen);
          if (born !== null && born > reveal.cutoff) continue;
        }
        points.push({ node, point, level: layout.ring?.get(id) ?? 1 });
      }
      const pointById = new Map(points.map((entry) => [entry.node.id, entry.point]));
      const nodeBoxes = points.map(({ node, point, level }) => {
        const radius = nodeRadius(node.mentions, layout.maxMentions) * (level === 0 ? 1.25 : 1) + 2;
        return { id: node.id, left: point.x - radius, right: point.x + radius, top: point.y - radius, bottom: point.y + radius };
      });

      const edgeElements = [];
      layout.visible.forEach((edge, position) => {
        const from = pointById.get(edge.source);
        const to = pointById.get(edge.target);
        if (!from || !to) return;
        const hot = activeId !== null && (edge.source === activeId || edge.target === activeId);
        const dim = highlighted && !hot;
        const stroke = edge.kind === 'hub' ? '#6ea8fe' : C.text3;
        let width = edge.kind === 'hub' ? 1.2 : 0.9;
        let fade = 1;
        if (reveal !== null) {
          const born = bornAt(edge.firstSeen);
          if (born !== null && born > reveal.cutoff) return;
          const span = Math.max(1, reveal.end - reveal.start);
          const age = born === null ? 1 : (reveal.cutoff - born) / (span * 0.18);
          fade = Math.min(1, 0.35 + 0.65 * Math.max(0, age));
          width *= Math.max(0.35, fade);
        }
        edgeElements.push(
          h('line', {
            key: `edge-${position}`,
            x1: from.x,
            y1: from.y,
            x2: to.x,
            y2: to.y,
            stroke,
            strokeWidth: width,
            opacity:
              reveal !== null
                ? dim
                  ? 0.04
                  : 0.1 + 0.12 * fade
                : dim
                  ? 0.05
                  : hot
                    ? 0.5
                    : edge.kind === 'hub'
                      ? 0.3
                      : 0.14,
            strokeLinecap: 'round',
          }),
        );
      });

      const nodeElements = [];
      const labelElements = [];
      const labelBoxes = [];
      for (const { node, point, level } of points) {
        const radius = nodeRadius(node.mentions, layout.maxMentions) * (level === 0 ? 1.25 : 1);
        const dim = highlighted && !highlight.has(node.id);
        const isActive = node.id === activeId;
        const color =
          layout.mode === 'focus'
            ? level === 0
              ? '#8fb6ff'
              : level === 1
                ? '#6ea8fe'
                : '#64748b'
            : layout.colors.get(node.id) ?? C.text3;
        nodeElements.push(
          h(
            'g',
            { key: `node-${node.id}` },
            isActive
              ? h('circle', { cx: point.x, cy: point.y, r: radius + 7, fill: color, opacity: 0.16 })
              : null,
            h('circle', {
              cx: point.x,
              cy: point.y,
              r: radius,
              fill: color,
              fillOpacity: dim ? 0.25 : 1,
              stroke: isActive ? C.text : 'none',
              strokeWidth: isActive ? 1.2 : 0,
              style: { cursor: 'pointer' },
              tabIndex: 0,
              role: 'button',
              'aria-label': `${node.label} · ${fill(t('graphMentions'), { n: node.mentions ?? 0 })}`,
              onMouseEnter: () => setHoverId(node.id),
              onMouseLeave: () => setHoverId((current) => (current === node.id ? null : current)),
              onMouseDown: (event) => event.stopPropagation(),
              onClick: () => props?.onFocus?.(node.id),
              onKeyDown: (event) => {
                if (event.key === 'Enter' || event.key === ' ') props?.onFocus?.(node.id);
              },
            }),
          ),
        );

        const labeled = layout.labelIds.has(node.id) || (search !== '' && highlight.has(node.id));
        if (!labeled) continue;
        const size = level === 0 ? 12 : 10.5;
        let anchor = 'middle';
        let dx = 0;
        let dy = radius + 12;
        if (layout.mode === 'focus' && level > 0) {
          const angle = Math.atan2(point.y - height / 2, point.x - width / 2);
          if (Math.cos(angle) > 0.3) {
            anchor = 'start';
            dx = radius + 12;
            dy = 3.5;
          } else if (Math.cos(angle) < -0.3) {
            anchor = 'end';
            dx = -(radius + 12);
            dy = 3.5;
          }
        }
        const anchorX = point.x + dx;
        const room = anchor === 'start'
          ? width - anchorX - 6
          : anchor === 'end'
            ? anchorX - 6
            : Math.min(anchorX, width - anchorX) * 2 - 8;
        const text = fitText(node.label, room, size);
        if (text === null || point.y + dy > height - 4 || point.y + dy < 12) continue;
        const labelWidth = textWidth(text, size);
        const left = anchor === 'start' ? anchorX : anchor === 'end' ? anchorX - labelWidth : anchorX - labelWidth / 2;
        const box = { left: left - 2, right: left + labelWidth + 2, top: point.y + dy - 11, bottom: point.y + dy + 4 };
        const hitsNode = layout.mode === 'focus' && nodeBoxes.some(
          (other) =>
            other.id !== node.id &&
            (layout.ring?.get(other.id) ?? 1) <= 1 &&
            box.left < other.right &&
            box.right > other.left &&
            box.top < other.bottom &&
            box.bottom > other.top,
        );
        if (hitsNode) continue;
        if (labelBoxes.some((other) => box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top)) {
          continue;
        }
        labelBoxes.push(box);
        labelElements.push(
          h(
            'text',
            {
              key: `label-${node.id}`,
              x: point.x + dx,
              y: point.y + dy,
              textAnchor: anchor,
              fontSize: size,
              fontWeight: level === 0 ? 600 : 400,
              fill: C.text,
              opacity: dim ? 0.35 : 0.95,
              style: { pointerEvents: 'none' },
            },
            text,
          ),
        );
      }

      const legend =
        layout.mode === 'focus'
          ? h(
              'div',
              {
                style: {
                  position: 'absolute',
                  right: 10,
                  top: 8,
                  display: 'flex',
                  gap: 10,
                  fontSize: 10.5,
                  color: C.text3,
                  pointerEvents: 'none',
                },
              },
              ...[
                ['#8fb6ff', t('graphLegendFocus')],
                ['#6ea8fe', t('graphLegendNear')],
                ['#64748b', t('graphLegendFar')],
              ].map(([color, text]) =>
                h(
                  'span',
                  { key: text, style: { display: 'inline-flex', alignItems: 'center', gap: 4 } },
                  h('span', { style: { width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' } }),
                  text,
                ),
              ),
            )
          : null;

      return h(
        'div',
        { style: { position: 'relative', width: '100%', height: '100%' } },
        h(
          'svg',
          {
            ref: svgRef,
            width,
            height,
            viewBox: `0 0 ${width} ${height}`,
            role: 'img',
            'aria-label': t('graphTitle'),
            style: { display: 'block', width, height, cursor: 'grab', userSelect: 'none' },
            onMouseDown: (event) => {
              if (event.button !== 0) return;
              dragRef.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y, moved: false };
            },
            onMouseMove: (event) => {
              const state = dragRef.current;
              if (!state) return;
              const dx = event.clientX - state.x;
              const dy = event.clientY - state.y;
              if (Math.abs(dx) + Math.abs(dy) > 3) state.moved = true;
              setPan({ x: state.panX + dx, y: state.panY + dy });
            },
            onMouseUp: () => {
              const state = dragRef.current;
              dragRef.current = null;
              if (state && !state.moved) props?.onBackground?.();
            },
            onMouseLeave: () => {
              dragRef.current = null;
            },
          },
          h('g', { transform: `translate(${pan.x} ${pan.y}) scale(${zoom})` }, edgeElements, nodeElements, labelElements),
        ),
        h(
          'div',
          {
            style: {
              position: 'absolute',
              left: 10,
              right: 10,
              bottom: 8,
              display: 'flex',
              justifyContent: 'space-between',
              gap: 10,
              fontSize: 10.5,
              color: C.text3,
              pointerEvents: 'none',
            },
          },
          h('span', null, reveal !== null ? t('growthHint') : t('graphHint')),
          reveal !== null
            ? h('span', null, fill(t('growthShown'), { shown: points.length, total: layout.positions.size }))
            : layout.hidden > 0
              ? h('span', null, fill(t('graphHidden'), { n: layout.hidden }))
              : null,
        ),
        legend,
      );
    }

    function GraphMessage({ text, action }) {
      return h(
        'div',
        {
          style: {
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            padding: 20,
            textAlign: 'center',
            fontSize: 12,
            color: C.text3,
          },
        },
        h('span', { style: { maxWidth: 360 } }, text),
        action ?? null,
      );
    }

    /**
     * Versions of a derived observation: the API returns the text each update
     * replaced, plus the facts that caused it.
     */
    function ObservationHistory(props) {
      const t = typeof props?.t === 'function' ? props.t : fallbackT;
      const id = props?.id ?? '';
      const [state, setState] = useState({ loading: true, entries: [], error: null });

      useEffect(() => {
        let cancelled = false;
        setState({ loading: true, entries: [], error: null });
        const load = async () => {
          try {
            const res = await fetch(`${API}/memory/history?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
            const body = await res.json().catch(() => ({}));
            if (cancelled) return;
            if (!res.ok || body.ok === false) throw new Error(body.error ?? res.statusText);
            setState({ loading: false, entries: Array.isArray(body.entries) ? body.entries : [], error: null });
          } catch (error) {
            if (!cancelled) setState({ loading: false, entries: [], error: error.message ?? String(error) });
          }
        };
        load();
        return () => {
          cancelled = true;
        };
      }, [id]);

      return h(
        'div',
        {
          style: {
            borderTop: `1px solid ${C.border}`,
            paddingTop: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          },
        },
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: 8 } },
          h('span', { style: { fontSize: 11.5, fontWeight: 600, color: C.text } }, t('historyTitle')),
          h('span', { style: { flex: 1 } }),
          h(
            'button',
            {
              type: 'button',
              onClick: props?.onClose,
              title: t('historyClose'),
              style: {
                appearance: 'none',
                border: 'none',
                background: 'transparent',
                color: C.text3,
                fontSize: 12,
                cursor: 'pointer',
                padding: 0,
              },
            },
            '×',
          ),
        ),
        state.loading
          ? h('div', { style: { fontSize: 11, color: C.text3 } }, t('historyLoading'))
          : state.error
            ? h('div', { style: { fontSize: 11, color: C.err, wordBreak: 'break-word' } }, state.error)
            : state.entries.length === 0
              ? h('div', { style: { fontSize: 11, color: C.text3 } }, t('historyEmpty'))
              : h(
                  'div',
                  { style: { display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' } },
                  ...state.entries.map((entry, index) =>
                    h(
                      'div',
                      { key: index, style: { background: C.surface2, borderRadius: 6, padding: '6px 7px' } },
                      h(
                        'div',
                        { style: { fontSize: 10, color: C.text3, display: 'flex', gap: 8, flexWrap: 'wrap' } },
                        h('span', null, `${t('historyChangedAt')} ${shortDate(entry.changedAt)}`),
                        entry.sources?.length
                          ? h('span', null, fill(t('historySources'), { n: entry.sources.length }))
                          : null,
                      ),
                      h(
                        'div',
                        { style: { fontSize: 11, color: C.text2, lineHeight: 1.45, marginTop: 3, wordBreak: 'break-word' } },
                        entry.previousText || '—',
                      ),
                    ),
                  ),
                ),
      );
    }

    function GraphDrawer(props) {
      const t = typeof props?.t === 'function' ? props.t : fallbackT;
      const [expandedId, setExpandedId] = useState(null);
      const [historyId, setHistoryId] = useState(null);
      const focusId = props?.focusId ?? null;
      const detail = props?.detail ?? null;
      const loading = props?.loading === true;
      const error = props?.error ?? null;
      const topEntities = Array.isArray(props?.topEntities) ? props.topEntities : [];

      useEffect(() => {
        setExpandedId(null);
      }, [focusId]);

      if (!focusId) {
        return h(
          'div',
          { style: { display: 'flex', flexDirection: 'column', gap: 6, minHeight: 0 } },
          h('div', { style: { fontSize: 12, fontWeight: 600, color: C.text } }, t('graphTopEntities')),
          ...topEntities.slice(0, 12).map((node) =>
            h(
              'button',
              {
                key: node.id,
                type: 'button',
                onClick: () => props?.onFocus?.(node.id),
                style: {
                  appearance: 'none',
                  border: 'none',
                  background: 'transparent',
                  color: C.text2,
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 8,
                  padding: '4px 2px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: 11.5,
                },
              },
              h('span', { style: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, node.label),
              h('span', { style: { flex: 'none', color: C.text3, fontSize: 10.5 } }, String(node.mentions ?? 0)),
            ),
          ),
          h('div', { style: { marginTop: 'auto', paddingTop: 10, fontSize: 11, color: C.text3, lineHeight: 1.5 } }, t('graphDetailHint')),
        );
      }

      if (error) {
        return h(
          'div',
          { style: { fontSize: 11.5, color: C.err, display: 'flex', flexDirection: 'column', gap: 8 } },
          h('span', null, `${t('graphDetailFailed')}: ${error}`),
          props?.onRetry ? h(Button, { onClick: props.onRetry }, t('graphRetry')) : null,
        );
      }

      if (loading || !detail) {
        return h('div', { style: { fontSize: 11.5, color: C.text3 } }, t('graphLoading'));
      }

      const entity = detail.entity ?? {};
      const memories = Array.isArray(detail.memories) ? detail.memories : [];
      const stat = (value, label) =>
        h(
          'div',
          { style: { display: 'flex', flexDirection: 'column', gap: 1 } },
          h('span', { style: { fontSize: 14, fontWeight: 600, color: C.text } }, value),
          h('span', { style: { fontSize: 10, color: C.text3 } }, label),
        );

      return h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: 9, minHeight: 0 } },
        h(
          'div',
          null,
          h('div', { style: { fontSize: 13.5, fontWeight: 600, color: C.text, wordBreak: 'break-word' } }, entity.label ?? focusId),
          h('div', { style: { fontSize: 11, color: C.text3, marginTop: 2 } }, fill(t('graphMentions'), { n: entity.mentions ?? 0 })),
        ),
        h(
          'div',
          {
            style: {
              display: 'flex',
              gap: 14,
              padding: '8px 0',
              borderTop: `1px solid ${C.border}`,
              borderBottom: `1px solid ${C.border}`,
            },
          },
          stat(String(detail.total ?? memories.length), t('graphMemories')),
          stat(shortDate(entity.firstSeen), t('graphFirstSeen')),
          stat(shortDate(entity.lastSeen), t('graphLastSeen')),
        ),
        h(
          'div',
          { style: { display: 'flex', flexDirection: 'column', gap: 7, minHeight: 0, overflowY: 'auto' } },
          memories.length === 0
            ? h('div', { style: { fontSize: 11.5, color: C.text3 } }, t('graphNoMemories'))
            : memories.map((memory) => {
                const expanded = expandedId === memory.id;
                const long = String(memory.text ?? '').length > 96;
                return h(
                  'div',
                  { key: memory.id, style: { background: C.surface2, borderRadius: 8, padding: '7px 8px' } },
                  h(
                    'div',
                    { style: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: C.text3 } },
                    h(Dot, { color: FACT_COLORS[memory.factType] ?? FACT_COLORS.fact, size: 5 }),
                    memory.factType === 'observation'
                      ? h(
                          'button',
                          {
                            type: 'button',
                            title: t('history'),
                            onClick: (event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              setHistoryId((current) => (current === memory.id ? null : memory.id));
                            },
                            style: {
                              appearance: 'none',
                              border: 'none',
                              background: 'transparent',
                              color: C.text2,
                              fontSize: 10,
                              cursor: 'pointer',
                              padding: 0,
                              textDecoration: 'underline dotted',
                            },
                          },
                          memory.factType,
                        )
                      : h('span', { style: { color: C.text2 } }, memory.factType),
                    h('span', { style: { marginLeft: 'auto' } }, shortDate(memory.date)),

                  ),
                  h(
                    'div',
                    {
                      onClick: long ? () => setExpandedId(expanded ? null : memory.id) : undefined,
                      style: {
                        fontSize: 11.5,
                        color: C.text2,
                        lineHeight: 1.5,
                        marginTop: 4,
                        cursor: long ? 'pointer' : 'default',
                        wordBreak: 'break-word',
                      },
                    },
                    expanded ? memory.text : `${String(memory.text ?? '').slice(0, 96)}${long ? '…' : ''}`,
                  ),
                );
              }),
        ),
        historyId ? h(ObservationHistory, { t, id: historyId, onClose: () => setHistoryId(null) }) : null,
        detail.total > memories.length || props?.showAll
          ? h(
              Button,
              { onClick: props?.onViewAll },
              props?.showAll ? t('graphCollapse') : fill(t('graphViewAll'), { n: detail.total }),
            )
          : null,
      );
    }

    function CleanupPanel(props) {
      const t = typeof props?.t === 'function' ? props.t : fallbackT;
      const running = props?.running === true;
      const data = props?.data ?? null;
      const loading = props?.loading === true;
      const staleDays = props?.staleDays ?? 90;
      const [filter, setFilter] = useState(props?.initialFilter ?? 'duplicates');
      const [selected, setSelected] = useState(() => new Set());
      const [step, setStep] = useState(0);
      const [reason, setReason] = useState('重复或过时（面板清理）');
      const [historyId, setHistoryId] = useState(null);
      const [limit, setLimit] = useState(100);
      const [busy, setBusy] = useState(false);
      const [result, setResult] = useState(null);
      const [error, setError] = useState(null);

      useEffect(() => {
        setSelected(new Set());
        setStep(0);
        setResult(null);
        setError(null);
        setHistoryId(null);
      }, [filter, data?.staleDays]);

      const selectStyle = {
        border: `1px solid ${C.border2}`,
        background: C.base,
        color: C.text,
        borderRadius: 7,
        padding: '3px 6px',
        fontSize: 11.5,
      };

      if (!running) {
        return h(Card, null, h('div', { style: { fontSize: 12, color: C.text3 } }, t('downHint')));
      }
      if (!data) {
        return h(
          Card,
          null,
          h('div', { style: { fontSize: 12, color: C.text3 } }, loading ? t('cleanupScanning') : t('stateUnknown')),
        );
      }
      if (data.error !== undefined) {
        return h(
          Card,
          null,
          h('div', { style: { fontSize: 12, color: C.err } }, `${t('cleanupScanFailed')}: ${data.error}`),
          h('div', { style: { marginTop: 8 } }, h(Button, { onClick: props?.onRefresh, busy: loading }, t('cleanupRescan'))),
        );
      }

      const counts = data.counts ?? {};
      const duplicates = Array.isArray(data.duplicates) ? data.duplicates : [];
      const stale = Array.isArray(data.stale) ? data.stale : [];
      const forgotten = Array.isArray(data.forgotten) ? data.forgotten : [];
      const observations = Array.isArray(data.observations) ? data.observations : [];
      const rows =
        filter === 'duplicates'
          ? duplicates.flat()
          : filter === 'stale'
            ? stale
            : filter === 'observations'
              ? observations
              : forgotten;

      // In a duplicate group one copy is the keeper (newest mention, then longest text).
      const keepIds = new Set();
      for (const group of duplicates) {
        const sorted = [...group].sort(
          (left, right) =>
            String(right.date ?? '').localeCompare(String(left.date ?? '')) ||
            String(right.text ?? '').length - String(left.text ?? '').length,
        );
        if (sorted[0]) keepIds.add(sorted[0].id);
      }
      const fullGroups =
        filter === 'duplicates' ? duplicates.filter((group) => group.every((item) => selected.has(item.id))) : [];
      const fixKeep = () => {
        setSelected((current) => {
          const next = new Set(current);
          for (const id of keepIds) next.delete(id);
          return next;
        });
        setError(null);
      };
      const actionable = (item) => (filter === 'forgotten' ? true : item.factType !== 'observation');
      const pickableIds = rows
        .filter((item) => actionable(item) && !(filter === 'duplicates' && keepIds.has(item.id)))
        .map((item) => item.id);
      const allPicked = pickableIds.length > 0 && pickableIds.every((id) => selected.has(id));

      const toggle = (id) => {
        setSelected((current) => {
          const next = new Set(current);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        });
        setStep(0);
      };
      const toggleAll = () => {
        setSelected(allPicked ? new Set() : new Set(pickableIds));
        setStep(0);
      };

      const execute = async (action) => {
        const ids = [...selected];
        if (ids.length === 0) return;
        if (action === 'invalidate') {
          if (fullGroups.length > 0) {
            setError(fill(t('cleanupGroupFull'), { n: fullGroups.length }));
            return;
          }
          if (reason.trim() === '') {
            setError(t('cleanupReasonRequired'));
            return;
          }
          if (ids.length > limit) {
            setError(fill(t('cleanupOverLimit'), { n: ids.length, limit }));
            return;
          }
        }
        setBusy(true);
        setError(null);
        try {
          const res = await fetch(`${API}/memories/action`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            cache: 'no-store',
            body: JSON.stringify({ action, ids, reason: reason.trim() }),
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok || body.ok === false) throw new Error(body.error ?? res.statusText);
          setResult(body);
          setSelected(new Set());
          setStep(0);
          props?.onRefresh?.();
        } catch (runError) {
          setError(runError.message ?? String(runError));
        } finally {
          setBusy(false);
        }
      };

      const chip = (key, label) =>
        h(
          'button',
          {
            type: 'button',
            onClick: () => setFilter(key),
            style: {
              appearance: 'none',
              border: `1px solid ${filter === key ? C.border2 : C.border}`,
              background: filter === key ? C.surface2 : 'transparent',
              color: filter === key ? C.text : C.text3,
              borderRadius: 999,
              padding: '3px 11px',
              fontSize: 11.5,
              cursor: 'pointer',
            },
          },
          label,
        );

      const row = (item) => {
        const canPick = actionable(item);
        const checked = selected.has(item.id);
        const isObservation = item.factType === 'observation';
        return h(
          'label',
          {
            key: item.id,
            onClick: isObservation
              ? (event) => {
                  event.preventDefault();
                  setHistoryId((current) => (current === item.id ? null : item.id));
                }
              : undefined,
            style: {
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
              padding: '7px 4px',
              borderBottom: `1px solid ${C.border}`,
              cursor: isObservation || canPick ? 'pointer' : 'not-allowed',
              opacity: isObservation ? 1 : canPick ? 1 : 0.55,
              background: isObservation && historyId === item.id ? C.surface2 : 'transparent',
            },
          },
          h('input', {
            type: 'checkbox',
            checked,
            disabled: !canPick,
            onChange: () => toggle(item.id),
            style: { width: 14, height: 14, marginTop: 3, cursor: canPick ? 'pointer' : 'not-allowed' },
          }),
          h(
            'div',
            { style: { flex: 1, minWidth: 0 } },
            h(
              'div',
              { style: { fontSize: 11.5, color: C.text2, lineHeight: 1.45, wordBreak: 'break-word' } },
              item.text.length > 140 ? `${item.text.slice(0, 140)}…` : item.text,
            ),
            h(
              'div',
              { style: { fontSize: 10, color: C.text3, marginTop: 3, display: 'flex', gap: 8, flexWrap: 'wrap' } },
              h('span', null, item.factType),
              h('span', null, shortDate(item.date)),
              filter === 'forgotten' && item.invalidatedAt ? h('span', null, `${t('cleanupForgotten')} · ${shortDate(item.invalidatedAt)}`) : null,
              filter === 'forgotten' && item.reason ? h('span', null, item.reason) : null,
              item.factType === 'observation' ? h('span', { style: { color: C.warn } }, t('cleanupObservation')) : null,
              filter === 'duplicates' && keepIds.has(item.id)
                ? h('span', { style: { color: C.ok } }, t('cleanupKeepHint'))
                : null,
              item.factType === 'observation' ? h('span', { style: { color: C.text3 } }, t('historyClick')) : null,

            ),
          ),
        );
      };

      let listBody;
      if (rows.length === 0) {
        listBody = h(
          'div',
          { style: { fontSize: 11.5, color: C.text3, padding: '12px 0' } },
          filter === 'duplicates'
            ? t('cleanupEmptyDup')
            : filter === 'stale'
              ? fill(t('cleanupEmptyStale'), { days: staleDays })
              : filter === 'observations'
                ? t('cleanupEmptyObservations')
                : t('cleanupEmptyForgotten'),
        );
      } else if (filter === 'duplicates') {
        listBody = h(
          'div',
          null,
          ...duplicates.map((group, index) =>
            h(
              'div',
              { key: `g${index}`, style: { marginTop: index === 0 ? 0 : 8 } },
              h(
                'div',
                { style: { fontSize: 10, color: C.text3, padding: '4px 4px 0' } },
                `${index + 1} · ${group.length} · ${t('cleanupKeepOne')}`,
              ),
              ...group.map(row),
            ),
          ),
        );
      } else {
        listBody = h('div', null, ...rows.map(row));
      }

      return h(
        Card,
        { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' } },
          h('div', { style: { fontSize: 13, fontWeight: 600, color: C.text } }, t('cleanupTitle')),
          h('div', { style: { fontSize: 11, color: C.text3 } }, t('cleanupHint')),
          h('span', { style: { flex: 1 } }),
          h(
            'select',
            {
              value: staleDays,
              onChange: (event) => props?.onChangeStaleDays?.(Number(event.target.value)),
              style: selectStyle,
              title: t('cleanupStale'),
            },
            [30, 90, 180, 365].map((days) => h('option', { key: days, value: days }, `${days} ${t('cleanupDays')}`)),
          ),
          h(Button, { onClick: props?.onRefresh, busy: loading }, loading ? t('cleanupScanning') : t('cleanupRescan')),
        ),
        h(
          'div',
          { style: { fontSize: 10.5, color: C.text3 } },
          `${fill(t('cleanupScanned'), { scanned: fmt(data.scanned), total: fmt(data.total) })}${data.truncated ? fill(t('cleanupTruncated'), { scanned: fmt(data.scanned) }) : ''}`,
        ),
        h(
          'div',
          { style: { display: 'flex', gap: 6, flexWrap: 'wrap' } },
          chip('duplicates', `${t('cleanupDuplicates')} ${fmt(counts.duplicateGroups ?? 0)}${t('cleanupGroups')}`),
          chip('stale', `${t('cleanupStale')} ${fmt(counts.stale ?? 0)}`),
          chip('observations', `${t('cleanupObservations')} ${fmt(counts.observations ?? 0)}`),
          chip('forgotten', `${t('cleanupForgotten')} ${fmt(counts.invalidated ?? 0)}`),
        ),
        h(
          'div',
          {
            style: {
              maxHeight: 360,
              overflowY: 'auto',
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: '2px 8px',
            },
          },
          listBody,
        ),
        historyId ? h(ObservationHistory, { t, id: historyId, onClose: () => setHistoryId(null) }) : null,
        rows.length > 0 && pickableIds.length > 0
          ? h(
              'div',
              { style: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' } },
              h('button', { type: 'button', onClick: toggleAll, style: { appearance: 'none', border: 'none', background: 'transparent', color: C.text2, fontSize: 11.5, cursor: 'pointer', padding: 0 } }, allPicked ? t('cleanupClear') : t('cleanupSelectAll')),
              selected.size > 0
                ? h('span', { style: { fontSize: 11, color: C.text3 } }, String(selected.size))
                : null,
            )
          : null,
        result
          ? h(
              'div',
              { style: { fontSize: 11.5, color: result.failed > 0 ? C.warn : C.ok } },
              fill(t('cleanupResult'), { ok: fmt(result.succeeded ?? 0), failed: fmt(result.failed ?? 0) }),
            )
          : null,
        error ? h('div', { style: { fontSize: 11.5, color: C.err } }, error) : null,
        filter === 'forgotten'
          ? h(
              'div',
              null,
              h(
                Button,
                { onClick: () => execute('restore'), disabled: selected.size === 0, busy },
                busy ? t('cleanupWorking') : fill(t('cleanupRestore'), { n: selected.size }),
              ),
            )
          : step === 0
            ? h(
                'div',
                null,
                h(
                  Button,
                  { onClick: () => setStep(1), disabled: selected.size === 0 },
                  fill(t('cleanupInvalidate'), { n: selected.size }),
                ),
              )
            : step === 1
              ? h(
                  'div',
                  { style: { display: 'flex', flexDirection: 'column', gap: 8, borderTop: `1px solid ${C.border}`, paddingTop: 10 } },
                  h(
                    'div',
                    { style: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: 11.5, color: C.text2 } },
                    h('span', null, t('cleanupReason')),
                    h('input', {
                      type: 'text',
                      value: reason,
                      maxLength: 200,
                      onChange: (event) => setReason(event.target.value),
                      placeholder: t('cleanupReasonPlaceholder'),
                      style: { ...inputStyle, flex: '1 1 240px', padding: '5px 9px', fontSize: 11.5 },
                    }),
                    h('span', null, t('cleanupLimit')),
                    h('input', {
                      type: 'number',
                      min: 1,
                      max: 500,
                      value: limit,
                      onChange: (event) => setLimit(Math.min(500, Math.max(1, Number(event.target.value) || 1))),
                      style: { ...inputStyle, width: 80, flex: 'none', padding: '5px 9px', fontSize: 11.5 },
                    }),
                  ),
                  fullGroups.length > 0
                    ? h(
                        'div',
                        { style: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 11.5, color: C.warn } },
                        h('span', null, fill(t('cleanupGroupFull'), { n: fullGroups.length })),
                        h(
                          'button',
                          {
                            type: 'button',
                            onClick: fixKeep,
                            style: {
                              appearance: 'none',
                              border: 'none',
                              background: 'transparent',
                              color: C.text2,
                              fontSize: 11.5,
                              cursor: 'pointer',
                              padding: 0,
                              textDecoration: 'underline',
                            },
                          },
                          t('cleanupFixKeep'),
                        ),
                      )
                    : null,
                  h(
                    'div',
                    { style: { display: 'flex', gap: 8 } },
                    h(
                      Button,
                      { onClick: () => setStep(2), disabled: selected.size === 0 || selected.size > limit || fullGroups.length > 0 },
                      t('cleanupNext'),
                    ),
                    h(Button, { onClick: () => setStep(0) }, t('cleanupCancel')),
                  ),
                )
              : h(
                  'div',
                  { style: { display: 'flex', flexDirection: 'column', gap: 8, borderTop: `1px solid ${C.border}`, paddingTop: 10 } },
                  h('div', { style: { fontSize: 12, fontWeight: 600, color: C.text } }, fill(t('cleanupConfirmTitle'), { n: selected.size })),
                  h('div', { style: { fontSize: 11.5, color: C.text3 } }, t('cleanupConfirmBody')),
                  h(
                    'div',
                    { style: { display: 'flex', gap: 8 } },
                    h(Button, { onClick: () => execute('invalidate'), busy, primary: true }, busy ? t('cleanupWorking') : t('cleanupConfirm')),
                    h(Button, { onClick: () => setStep(1), disabled: busy }, t('cleanupBack')),
                  ),
                ),
      );
    }

    function GraphPanel(props) {
      const t = typeof props?.t === 'function' ? props.t : fallbackT;
      const running = props?.running === true;
      const [graph, setGraph] = useState(null);
      const [loading, setLoading] = useState(false);
      const [error, setError] = useState(null);
      const [focusId, setFocusId] = useState(null);
      const [detail, setDetail] = useState(null);
      const [detailLoading, setDetailLoading] = useState(false);
      const [detailError, setDetailError] = useState(null);
      const [showAll, setShowAll] = useState(false);
      const [search, setSearch] = useState('');
      const [presetMin, setPresetMin] = useState(1);
      const [customOpen, setCustomOpen] = useState(false);
      const [customMin, setCustomMin] = useState('2');
      const [growth, setGrowth] = useState(false);
      const [progress, setProgress] = useState(0);
      const [playing, setPlaying] = useState(false);
      const [size, setSize] = useState({ width: 0, height: 0 });
      const [reloadToken, setReloadToken] = useState(0);
      const bank = props?.bank ?? null;
      const bankRef = useRef(null);
      const [detailToken, setDetailToken] = useState(0);
      const boxRef = useRef(null);
      const alive = useRef(true);
      const focusedOnce = useRef(false);

      useEffect(() => {
        alive.current = true;
        return () => {
          alive.current = false;
        };
      }, []);

      const loadGraph = useCallback(async () => {
        if (!running) return;
        setLoading(true);
        setError(null);
        try {
          const res = await fetch(`${API}/graph`, { cache: 'no-store' });
          const body = await res.json().catch(() => ({}));
          if (!alive.current) return;
          if (!res.ok || body.ok === false) throw new Error(body.error ?? res.statusText);
          setGraph(body);
          setLoading(false);
          if (!focusedOnce.current && Array.isArray(body.nodes) && body.nodes.length > 0) {
            focusedOnce.current = true;
            const top = [...body.nodes].sort((left, right) => (right.mentions ?? 0) - (left.mentions ?? 0))[0];
            setFocusId(top.id);
          }
        } catch (loadError) {
          if (!alive.current) return;
          setError(loadError?.message ?? String(loadError));
          setLoading(false);
        }
      }, [running]);

      useEffect(() => {
        if (!running) {
          setGraph(null);
          setError(null);
          setLoading(false);
          return;
        }
        if (bankRef.current !== bank) {
          if (bankRef.current !== null) {
            setGraph(null);
            setFocusId(null);
            setDetail(null);
            setShowAll(false);
            setGrowth(false);
            setPlaying(false);
            focusedOnce.current = false;
          }
          bankRef.current = bank;
        }
        loadGraph();
      }, [running, bank, loadGraph, reloadToken]);

      useEffect(() => {
        const element = boxRef.current;
        if (!element || typeof window === 'undefined') return () => {};
        const measure = () => {
          const rect = element.getBoundingClientRect?.();
          if (!rect || rect.width <= 0 || rect.height <= 0) return;
          setSize((current) =>
            Math.abs(current.width - rect.width) < 2 && Math.abs(current.height - rect.height) < 2
              ? current
              : { width: Math.round(rect.width), height: Math.round(rect.height) },
          );
        };
        measure();
        let observer = null;
        if (typeof ResizeObserver !== 'undefined') {
          observer = new ResizeObserver(measure);
          observer.observe(element);
        } else if (typeof window.addEventListener === 'function') {
          window.addEventListener('resize', measure);
        }
        return () => {
          if (observer) observer.disconnect();
          else if (typeof window.removeEventListener === 'function') window.removeEventListener('resize', measure);
        };
      }, []);

      useEffect(() => {
        if (!focusId) {
          setDetail(null);
          return;
        }
        let cancelled = false;
        setDetailLoading(true);
        setDetailError(null);
        const loadDetail = async () => {
          try {
            const limit = showAll ? 100 : 5;
            const res = await fetch(`${API}/entity?id=${encodeURIComponent(focusId)}&limit=${limit}`, {
              cache: 'no-store',
            });
            const body = await res.json().catch(() => ({}));
            if (cancelled) return;
            if (!res.ok || body.ok === false) throw new Error(body.error ?? res.statusText);
            setDetail(body);
            setDetailLoading(false);
          } catch (loadError) {
            if (cancelled) return;
            setDetailError(loadError?.message ?? String(loadError));
            setDetailLoading(false);
          }
        };
        loadDetail();
        return () => {
          cancelled = true;
        };
      }, [focusId, showAll, detailToken]);

      useEffect(() => {
        if (!playing) return () => {};
        const timer = setInterval(() => {
          setProgress((current) => Math.min(1, current + 0.01));
        }, 60);
        return () => clearInterval(timer);
      }, [playing]);

      useEffect(() => {
        if (playing && progress >= 1) setPlaying(false);
      }, [playing, progress]);

      const handleFocus = useCallback((id) => {
        setShowAll(false);
        setGrowth(false);
        setPlaying(false);
        setFocusId(id);
      }, []);

      const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
      const edges = Array.isArray(graph?.edges) ? graph.edges : [];
      const focusNode = focusId ? nodes.find((node) => node.id === focusId) : null;
      const topEntities = [...nodes].sort((left, right) => (right.mentions ?? 0) - (left.mentions ?? 0));
      const matches = search.trim() === '' ? 0 : nodes.filter((node) => String(node.label).toLowerCase().includes(search.trim().toLowerCase())).length;

      const minCount = customOpen ? Math.max(1, Math.min(9999, Math.round(Number(customMin) || 1))) : presetMin;
      const spanStart = Date.parse(graph?.span?.start ?? '');
      const spanEnd = Date.parse(graph?.span?.end ?? '');
      const hasSpan = Number.isFinite(spanStart) && Number.isFinite(spanEnd) && spanEnd > spanStart;
      const cutoff = growth && hasSpan ? spanStart + (spanEnd - spanStart) * progress : null;
      const reveal = cutoff === null ? null : { cutoff, start: spanStart, end: spanEnd };
      const cutoffLabel = cutoff === null ? '' : formatMoment(cutoff);
      const canvasWidth = Math.max(220, size.width || 620);
      const canvasHeight = Math.max(180, size.height || 420);

      let canvasContent;
      if (!running) {
        canvasContent = h(GraphMessage, { text: t('downHint') });
      } else if (error) {
        canvasContent = h(GraphMessage, {
          text: `${t('graphLoadFailed')}: ${error}`,
          action: h(Button, { onClick: () => setReloadToken((token) => token + 1) }, t('graphRetry')),
        });
      } else if (loading && graph === null) {
        canvasContent = h(GraphMessage, { text: t('graphLoading') });
      } else if (nodes.length === 0) {
        canvasContent = h(GraphMessage, { text: t('graphEmpty') });
      } else {
        canvasContent = h(GraphCanvas, {
          t,
          nodes,
          edges,
          focusId,
          minCount,
          search,
          stamp: graph?.generatedAt ?? 0,
          width: canvasWidth,
          height: canvasHeight,
          reveal,
          onFocus: handleFocus,
          onBackground: () => setFocusId(null),
        });
      }

      const chipCloseStyle = {
        appearance: 'none',
        border: 'none',
        background: 'transparent',
        color: C.text3,
        cursor: 'pointer',
        fontSize: 13,
        lineHeight: 1,
        padding: 0,
      };

      return h(
        Card,
        {
          style: {
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            height: 'calc(100vh - 252px)',
            minHeight: 430,
            overflow: 'hidden',
          },
        },
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', flexWrap: 'wrap' } },
          h(
            'div',
            { style: { display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', minWidth: 0 } },
            h('span', { style: { fontSize: 13, fontWeight: 600, color: C.text } }, t('graphTitle')),
            h(
              'span',
              { style: { fontSize: 11, color: C.text3 } },
              graph ? fill(t('graphCounts'), { entities: graph.totalEntities, edges: graph.totalEdges }) : '',
            ),
          ),
          focusNode
            ? h(
                'span',
                {
                  style: {
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 11.5,
                    color: C.text2,
                    background: C.surface2,
                    borderRadius: 999,
                    padding: '2px 10px',
                    maxWidth: 260,
                  },
                },
                h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, `${t('graphFocus')} ${focusNode.label}`),
                h('button', { type: 'button', onClick: () => setFocusId(null), title: t('graphBack'), style: chipCloseStyle }, '×'),
              )
            : null,
          h('span', { style: { flex: 1 } }),
          h('input', {
            type: 'search',
            value: search,
            placeholder: t('graphSearch'),
            onChange: (event) => setSearch(event.target.value),
            style: { ...inputStyle, flex: 'none', width: 156, padding: '5px 9px', fontSize: 11.5 },
          }),
          search.trim() !== ''
            ? h('span', { style: { fontSize: 10.5, color: C.text3 } }, fill(t('graphMatches'), { n: matches }))
            : null,
          h(
            'select',
            {
              value: customOpen ? 'custom' : String(presetMin),
              onChange: (event) => {
                if (event.target.value === 'custom') {
                  setCustomOpen(true);
                  return;
                }
                setCustomOpen(false);
                setPresetMin(Number(event.target.value));
              },
              title: t('graphMin'),
              disabled: focusNode !== null,
              style: {
                border: `1px solid ${C.border2}`,
                background: C.base,
                color: C.text2,
                borderRadius: 7,
                padding: '4px 6px',
                fontSize: 11.5,
              },
            },
            [1, 2, 3, 5, 10].map((value) =>
              h('option', { key: value, value: String(value) }, `${t('graphMin')} ${value}${t('graphMinUnit')}`),
            ),
            h('option', { key: 'custom', value: 'custom' }, t('graphCustom')),
          ),
          customOpen
            ? h('input', {
                type: 'number',
                min: 1,
                max: 9999,
                value: customMin,
                placeholder: '2',
                onChange: (event) => setCustomMin(event.target.value),
                style: {
                  width: 56,
                  border: `1px solid ${C.border2}`,
                  background: C.base,
                  color: C.text,
                  borderRadius: 7,
                  padding: '4px 6px',
                  fontSize: 11.5,
                },
              })
            : null,
          h(
            Button,
            {
              onClick: () => {
                if (growth) {
                  setGrowth(false);
                  setPlaying(false);
                  return;
                }
                setFocusId(null);
                setProgress(0);
                setGrowth(true);
                setPlaying(true);
              },
              disabled: !running || !hasSpan,
              title: hasSpan ? '' : t('growthUnavailable'),
            },
            growth ? t('growthExit') : t('growth'),
          ),
          h(Button, { onClick: () => setReloadToken((token) => token + 1), busy: loading, disabled: !running }, t('graphRefresh')),
        ),
        h(
          'div',
          { style: { display: 'flex', flex: 1, minHeight: 0 } },
          h(
            'div',
            {
              ref: boxRef,
              style: {
                flex: 1,
                minWidth: 0,
                position: 'relative',
                borderTop: `1px solid ${C.border}`,
                overflow: 'hidden',
              },
            },
            canvasContent,
          ),
          h(
            'div',
            {
              style: {
                width: 272,
                flex: 'none',
                borderLeft: `1px solid ${C.border}`,
                borderTop: `1px solid ${C.border}`,
                padding: 12,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              },
            },
            h(GraphDrawer, {
              t,
              focusId,
              detail,
              loading: detailLoading,
              error: detailError,
              showAll,
              topEntities,
              onFocus: handleFocus,
              onViewAll: () => setShowAll((current) => !current),
              onRetry: () => setDetailToken((token) => token + 1),
            }),
          ),
        ),
        growth && hasSpan
          ? h(
              'div',
              {
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '6px 12px',
                  borderTop: `1px solid ${C.border}`,
                },
              },
              h(
                'button',
                {
                  type: 'button',
                  onClick: () => {
                    if (progress >= 1) setProgress(0);
                    setPlaying((current) => !current);
                  },
                  style: {
                    appearance: 'none',
                    border: `1px solid ${C.border2}`,
                    background: C.surface2,
                    color: C.text,
                    borderRadius: 7,
                    padding: '2px 10px',
                    fontSize: 11.5,
                    cursor: 'pointer',
                  },
                },
                playing ? t('growthPause') : t('growthPlay'),
              ),
              h('input', {
                type: 'range',
                min: 0,
                max: 1,
                step: 0.001,
                value: progress,
                onChange: (event) => {
                  setPlaying(false);
                  setProgress(Number(event.target.value));
                },
                style: { flex: 1, minWidth: 0 },
              }),
              h('span', { style: { fontSize: 10.5, color: C.text3, minWidth: 92, textAlign: 'right' } }, cutoffLabel),
            )
          : null,
      );
    }

    /**
     * Persistent status chip in the sidebar foot, right above the account row.
     * It polls on its own so the running state is visible while the panel is
     * closed, and opens the panel when clicked.
     */
    function FooterStatus(props) {
      const t = typeof props?.t === 'function' ? props.t : fallbackT;
      const wide = props?.wide !== false;
      const [status, setStatus] = useState('unknown');
      const [bank, setBank] = useState(null);
      const [hover, setHover] = useState(false);

      useEffect(() => {
        let alive = true;
        const load = async () => {
          try {
            const res = await fetch(`${API}/overview`, { cache: 'no-store' });
            const body = await res.json();
            if (!alive) return;
            if (res.ok && body.ok !== false) {
              setStatus(body.status ?? 'unknown');
              setBank(body.bank ?? null);
            }
          } catch {
            if (alive) setStatus('unknown');
          }
        };
        load();
        const timer = setInterval(load, 6000);
        return () => {
          alive = false;
          clearInterval(timer);
        };
      }, []);

      const label =
        status === 'running'
          ? t('stateRunning')
          : status === 'starting'
            ? t('stateStarting')
            : status === 'retrying'
              ? t('stateRetrying')
              : status === 'failed'
                ? t('stateFailed')
                : status === 'stopped'
                  ? t('stateStopped')
                  : t('stateUnknown');
      const color = stateColor[status] ?? C.text3;
      const open = typeof props?.open === 'function' ? props.open : undefined;

      return h(
        'button',
        {
          type: 'button',
          onClick: open,
          onMouseEnter: () => setHover(true),
          onMouseLeave: () => setHover(false),
          title: `${t('nav')} · ${label}${bank ? ` · ${bank}` : ''}`,
          style: {
            appearance: 'none',
            border: 'none',
            width: '100%',
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            padding: wide ? '5px 8px' : '5px 0',
            borderRadius: 8,
            background: hover && open ? C.surface2 : 'transparent',
            color: C.text2,
            fontSize: 11.5,
            fontFamily: 'inherit',
            textAlign: 'left',
            cursor: open ? 'pointer' : 'default',
            justifyContent: wide ? 'flex-start' : 'center',
          },
        },
        h(Dot, { color, glow: status === 'running', size: 8 }),
        wide
          ? h(
              'span',
              {
                style: {
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 'none',
                  maxWidth: 110,
                },
              },
              t('nav'),
            )
          : null,
        wide
          ? h(
              'span',
              {
                style: {
                  color,
                  marginLeft: 'auto',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: 11,
                },
              },
              label,
            )
          : null,
      );
    }

    /**
     * The bundle's own configuration block on the Plugins page (Installed → this
     * plugin). It mirrors the two visibility switches and can open the panel, so
     * no combination of switches can hide the only way back.
     */
    function BundlePanelSettings(props) {
      const t = typeof props?.t === 'function' ? props.t : fallbackT;
      const open = typeof props?.open === 'function' ? props.open : undefined;
      const [config, setConfig] = useState(null);
      const [saving, setSaving] = useState(false);
      const [message, setMessage] = useState(null);

      useEffect(() => {
        let alive = true;
        const load = async () => {
          try {
            const res = await fetch(`${API}/config`, { cache: 'no-store' });
            const body = await res.json();
            if (alive && res.ok && body.ok !== false) setConfig(body);
          } catch {
            // the Local Memory page reports service trouble
          }
        };
        load();
        const onConfig = (event) => {
          if (alive && event?.detail) setConfig((previous) => ({ ...(previous ?? {}), ...event.detail }));
        };
        if (typeof window?.addEventListener === 'function') window.addEventListener(CONFIG_EVENT, onConfig);
        return () => {
          alive = false;
          if (typeof window?.removeEventListener === 'function') window.removeEventListener(CONFIG_EVENT, onConfig);
        };
      }, []);

      const update = async (patch) => {
        setSaving(true);
        setMessage(null);
        try {
          const res = await fetch(`${API}/config`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            cache: 'no-store',
            body: JSON.stringify(patch),
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok || body.ok === false) throw new Error(body.error ?? res.statusText);
          setConfig(body);
          if (typeof window?.dispatchEvent === 'function') {
            try {
              window.dispatchEvent(new CustomEvent(CONFIG_EVENT, { detail: body }));
            } catch {
              // CustomEvent may be unavailable in an old host
            }
          }
          setMessage(t('saved'));
        } catch (error) {
          setMessage(`${t('errorTitle')}: ${error?.message ?? String(error)}`);
        } finally {
          if (typeof window !== 'undefined') setSaving(false);
        }
      };

      const row = (key, label, hint, value) =>
        h(
          'label',
          {
            style: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', flexWrap: 'wrap' },
          },
          h('input', {
            type: 'checkbox',
            checked: value,
            disabled: saving,
            onChange: (event) => update({ [key]: event.target.checked }),
            style: { width: 14, height: 14, cursor: 'pointer' },
          }),
          h('span', null, label),
          h('span', { style: { color: C.text3, fontSize: 11 } }, hint),
        );

      return h(
        Card,
        { style: { marginTop: 12 } },
        h(SectionTitle, { hint: t('bundleSettingsHint') }, t('bundleSettingsTitle')),
        h(
          'div',
          { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
          row('showSidebarEntry', t('sidebarEntry'), t('sidebarEntryHint'), config?.showSidebarEntry !== false),
          row('showFooterStatus', t('footerStatus'), t('footerStatusHint'), config?.showFooterStatus !== false),
          h(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 } },
            open ? h(Button, { onClick: open }, t('openPanel')) : null,
            message
              ? h(
                  'span',
                  { style: { fontSize: 11, color: message.startsWith(t('errorTitle')) ? C.err : C.ok } },
                  message,
                )
              : null,
          ),
        ),
      );
    }

    /** The sidebar row's icon. */
    function ManagerRowIcon(owner) {
      const size = owner?.size ?? 16;
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.7,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          style: { display: 'block' },
        },
        h('path', { d: 'M12 3a4 4 0 0 0-4 4 3.5 3.5 0 0 0-1 6.8V17a3 3 0 0 0 3 3h.5' }),
        h('path', { d: 'M12 3a4 4 0 0 1 4 4 3.5 3.5 0 0 1 1 6.8V17a3 3 0 0 1-3 3h-.5' }),
        h('path', { d: 'M12 3v17' }),
        h('path', { d: 'M9.5 10.5h2M14.5 10.5h-2' }),
      );
    }

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), `${NS}: dictionaries`);
      const t = localeTranslator(ctx);

      /** Directory chooser through the workspace service (injected below). */
      const pickDirectory = async () => {
        let service;
        try {
          service = ctx.get('uiWorkspace');
        } catch (error) {
          throw new Error(`${t('pickerUnavailable')} (${error?.message ?? error})`);
        }
        if (typeof service?.pickDirectory !== 'function') {
          throw new Error(`${t('pickerUnavailable')} (uiWorkspace.pickDirectory missing)`);
        }
        return service.pickDirectory();
      };

      const ui = { sidebar: true, footer: true };
      const sync = { sidebar: () => {}, footer: () => {} };

      /**
       * Apply the persisted visibility preferences. The panel calls this after a
       * save, and the boot fetch seeds it before the user opens anything.
       */
      const applyUiConfig = (config) => {
        const nextSidebar = config?.showSidebarEntry !== false;
        const nextFooter = config?.showFooterStatus !== false;
        if (nextSidebar === ui.sidebar && nextFooter === ui.footer) return;
        ui.sidebar = nextSidebar;
        ui.footer = nextFooter;
        sync.sidebar();
        sync.footer();
      };

      void fetch(`${API}/config`, { cache: 'no-store' })
        .then((res) => res.json())
        .then((body) => applyUiConfig(body))
        .catch(() => {});

      /** Open the Local Memory panel; the main slot stays registered either way. */
      const openPanel = () => {
        try {
          ctx.layout?.selectPanel?.(PANEL_ID);
        } catch {
          // navigation is best-effort
        }
      };

      // Any surface that saves a visibility switch publishes it here.
      ctx.effect(() => {
        if (typeof window?.addEventListener !== 'function') return () => {};
        const onConfig = (event) => {
          if (event?.detail) applyUiConfig(event.detail);
        };
        window.addEventListener(CONFIG_EVENT, onConfig);
        return () => window.removeEventListener(CONFIG_EVENT, onConfig);
      }, `${NS}: config events`);

      ctx.slots.inject('plugins.bundle.config', () => {
        const off = ctx.slots.register(
          {
            name: 'plugins.bundle.config',
            key: BUNDLE_KEY,
            locale: NS,
            inject: () => ({ t, open: openPanel }),
          },
          BundlePanelSettings,
        );
        return () => off?.();
      });

      ctx.slots.inject('sidebar.panellist', () => {
        const offPanel = ctx.slots.register(
          { name: 'main', key: PANEL_ID, locale: NS, inject: () => ({ t, pickDirectory, applyUiConfig }) },
          ManagerPanel,
        );
        let offRow = null;
        sync.sidebar = () => {
          if (ui.sidebar && offRow === null) {
            offRow =
              ctx.slots.register(
                {
                  name: 'sidebar.panellist',
                  id: PANEL_ID,
                  order: 20,
                  label: () => t('nav'),
                  locale: NS,
                },
                ManagerRowIcon,
              ) ?? null;
          } else if (!ui.sidebar && offRow !== null) {
            offRow();
            offRow = null;
          }
        };
        sync.sidebar();
        return () => {
          sync.sidebar = () => {};
          if (offRow !== null) {
            offRow();
            offRow = null;
          }
          offPanel?.();
        };
      });

      // Foot-of-sidebar status, directly above the account row.
      ctx.slots.inject('sidebar.footer.action', () => {
        const open = openPanel;
        let off = null;
        sync.footer = () => {
          if (ui.footer && off === null) {
            off =
              ctx.slots.register(
                {
                  name: 'sidebar.footer.action',
                  id: `${PANEL_ID}-status`,
                  order: 10,
                  locale: NS,
                  inject: () => ({ t, open }),
                },
                FooterStatus,
              ) ?? null;
          } else if (!ui.footer && off !== null) {
            off();
            off = null;
          }
        };
        sync.footer();
        return () => {
          sync.footer = () => {};
          if (off !== null) {
            off();
            off = null;
          }
        };
      });
    }

    return {
      name: NS,
      inject: ['slots', 'locale', 'layout', 'uiWorkspace'],
      apply,
      // Render handles for the smoke test; the module loader only reads
      // name/inject/apply, so these are inert in the real host.
      __test: { GraphCanvas, GraphDrawer, focusLayout, fullLayout, CleanupPanel, ObservationHistory },
    };
  },
});
