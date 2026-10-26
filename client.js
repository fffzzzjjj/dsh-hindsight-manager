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
      autoStart: '随 DSH 启动',
      autoStartHint: '打开后每次启动 DSH 都会自动拉起守护进程，失败会自动重试。',
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
      autoStart: 'Start with DSH',
      autoStartHint: 'Start the daemon on every DSH launch, retrying transient failures.',
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

      const [data, setData] = useState(null);
      const [setup, setSetup] = useState(null);
      const [loadError, setLoadError] = useState(null);
      const [busy, setBusy] = useState(null);
      const [actionError, setActionError] = useState(null);
      const [documents, setDocuments] = useState(null);
      const [query, setQuery] = useState('');
      const [results, setResults] = useState(null);
      const [searching, setSearching] = useState(false);
      const [installDir, setInstallDir] = useState('');
      const [autoStart, setAutoStart] = useState(true);
      const [savingConfig, setSavingConfig] = useState(false);
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

      const saveSettings = useCallback(async () => {
        setSavingConfig(true);
        setConfigMessage(null);
        try {
          const res = await fetch(`${API}/config`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            cache: 'no-store',
            body: JSON.stringify({ installDir, autoStart }),
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok || body.ok === false) throw new Error(body.error ?? res.statusText);
          setConfigMessage(t('saved'));
          refreshAll();
        } catch (error) {
          setConfigMessage(`${t('errorTitle')}: ${error.message ?? String(error)}`);
        } finally {
          if (alive.current) setSavingConfig(false);
        }
      }, [installDir, autoStart, refreshAll, t]);

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
                  h(Row, { label: t('bank') }, h('code', { style: mono }, data.bank)),
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
                  'label',
                  { style: { display: 'flex', flexDirection: 'column', gap: 4 } },
                  h('span', { style: { fontSize: 12, color: C.text } }, t('installDir')),
                  h('input', {
                    type: 'text',
                    value: installDir,
                    placeholder: 'e.g. D:\\hindsight',
                    onChange: (event) => setInstallDir(event.target.value),
                    style: inputStyle,
                  }),
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

          // diagnostics
          setup
            ? h(
                Card,
                null,
                h(SectionTitle, null, t('diagnostics')),
                h(
                  'div',
                  { style: { display: 'flex', flexDirection: 'column', gap: 7 } },
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

      ctx.slots.inject('sidebar.panellist', () => {
        const offPanel = ctx.slots.register({ name: 'main', key: PANEL_ID, locale: NS, inject: () => ({ t }) }, ManagerPanel);
        const offRow = ctx.slots.register(
          {
            name: 'sidebar.panellist',
            id: PANEL_ID,
            order: 20,
            label: () => t('nav'),
            locale: NS,
          },
          ManagerRowIcon,
        );
        return () => {
          offPanel?.();
          offRow?.();
        };
      });
    }

    return { name: NS, inject: ['slots', 'locale'], apply };
  },
});
