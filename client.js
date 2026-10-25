/**
 * dsh-hindsight-manager — browser half.
 *
 * One page under the sidebar. Two ideas kept apart on purpose:
 *   - the daemon's status is READ-ONLY text, so reading it can never change it;
 *   - start and stop are separate buttons, each disabled unless it applies.
 *
 * That split is the whole point: a single control that both reports and toggles
 * ("运行中") is one misplaced click away from stopping memory.
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
      subtitle: '这台机器上的 Hindsight 守护进程，以及本仓库的记忆库',
      start: '启动',
      stop: '停止',
      stateRunning: '运行中',
      stateStopped: '未运行',
      stateStarting: '启动中',
      stateFailed: '启动失败',
      stateUnknown: '读取中…',
      port: '端口',
      version: '版本',
      bank: '记忆库',
      provider: '抽取模型',
      cache: '缓存位置',
      systemDefault: '系统默认位置',
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
      downHint: '记忆服务没在运行，这时候不会有任何记忆被写入。点「启动」把它拉起来。',
      startHint: '首次启动要下载并加载本地模型，可能需要几分钟；之后只需 20–40 秒。',
      settings: '设置',
      settingsHint: '保存在本机，作用于这个 profile',
      installDir: '缓存目录',
      installDirHint: '留空用系统默认位置。填 D:\\hindsight 这类绝对路径可以把 uv 缓存和模型放到别的盘。',
      autoStart: '随 DSH 启动',
      autoStartHint: '打开后每次启动 DSH 都会自动拉起守护进程。',
      save: '保存',
      saving: '保存中…',
      saved: '已保存',
      configNote: '改动在下次启动守护进程时生效。',
      chars: '字符',
      factsShort: '条事实',
      restartHint: '需要重启守护进程才会应用新的缓存目录。',
    };

    const en = {
      nav: 'Memory',
      title: 'Local Memory',
      subtitle: 'The Hindsight daemon on this machine and this repository’s memory bank',
      start: 'Start',
      stop: 'Stop',
      stateRunning: 'Running',
      stateStopped: 'Stopped',
      stateStarting: 'Starting',
      stateFailed: 'Failed to start',
      stateUnknown: 'Reading…',
      port: 'Port',
      version: 'Version',
      bank: 'Memory bank',
      provider: 'Extraction model',
      cache: 'Cache location',
      systemDefault: 'system default',
      stats: 'Bank overview',
      documents: 'Documents',
      facts: 'Facts',
      links: 'Links',
      observations: 'Observations',
      recent: 'Recent documents',
      recentEmpty: 'No documents yet. Conversations are written after they end, or ask me to store one.',
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
      downHint: 'Memory is not running, so nothing is being remembered right now. Press Start.',
      startHint: 'The first start downloads and loads local models and can take minutes; afterwards 20–40 seconds.',
      settings: 'Settings',
      settingsHint: 'Stored locally, applies to this profile',
      installDir: 'Cache directory',
      installDirHint: 'Leave empty for the system default. An absolute path such as D:\\hindsight moves the uv cache and models to another drive.',
      autoStart: 'Start with DSH',
      autoStartHint: 'Start the daemon automatically every time DSH launches.',
      save: 'Save',
      saving: 'Saving…',
      saved: 'Saved',
      configNote: 'Changes apply the next time the daemon starts.',
      chars: 'chars',
      factsShort: 'facts',
      restartHint: 'Restart the daemon for a new cache directory to take effect.',
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

    const stateColor = { running: C.ok, starting: C.warn, failed: C.err, stopped: C.text3 };
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

    function Dot({ color, glow }) {
      return h('span', {
        style: {
          width: 8,
          height: 8,
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

    function SectionTitle({ children, hint }) {
      return h(
        'div',
        { style: { display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12, flexWrap: 'wrap' } },
        h('div', { style: { fontSize: 13, fontWeight: 600, color: C.text } }, children),
        hint ? h('div', { style: { fontSize: 11, color: C.text3 } }, hint) : null,
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
        h('span', { style: { color: C.text, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' } }, children),
      );
    }

    function ManagerPanel(props) {
      const t = typeof props?.t === 'function' ? props.t : fallbackT;

      const [data, setData] = useState(null);
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
      const alive = useRef(true);
      const configLoaded = useRef(false);

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
        const timer = setInterval(loadOverview, 5000);
        return () => clearInterval(timer);
      }, [loadOverview]);

      useEffect(() => {
        if (data?.running) loadDocuments();
        else setDocuments(null);
      }, [data?.running, loadDocuments]);

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
            setTimeout(loadOverview, action === 'start' ? 1200 : 300);
          } catch (error) {
            setActionError(error.message ?? String(error));
          } finally {
            if (alive.current) setBusy(null);
          }
        },
        [loadOverview],
      );

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
          loadOverview();
        } catch (error) {
          setConfigMessage(`${t('errorTitle')}: ${error.message ?? String(error)}`);
        } finally {
          if (alive.current) setSavingConfig(false);
        }
      }, [installDir, autoStart, loadOverview, t]);

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
      const stateLabel =
        status === 'running'
          ? t('stateRunning')
          : status === 'starting'
            ? t('stateStarting')
            : status === 'failed'
              ? t('stateFailed')
              : status === 'stopped'
                ? t('stateStopped')
                : t('stateUnknown');
      const stats = data?.stats ?? null;

      return h(
        'div',
        {
          style: {
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            padding: '24px clamp(16px, 4vw, 48px)',
            maxWidth: 920,
            margin: '0 auto',
            color: C.text,
            fontSize: 13,
            lineHeight: 1.5,
          },
        },
        h('style', null, '@keyframes dsh-hm-spin{to{transform:rotate(360deg)}}'),

        // header
        h(
          'div',
          { style: { display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' } },
          h(
            'div',
            { style: { flex: '1 1 320px', minWidth: 0 } },
            h('div', { style: { fontSize: 18, fontWeight: 600 } }, t('title')),
            h('div', { style: { fontSize: 12, color: C.text2, marginTop: 4 } }, t('subtitle')),
          ),
          h(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: 8, paddingTop: 4 } },
            h(Button, { onClick: () => runAction('start'), disabled: running, busy: busy === 'start' }, t('start')),
            h(Button, { onClick: () => runAction('stop'), disabled: !running, busy: busy === 'stop' }, t('stop')),
          ),
        ),

        // status — read only
        h(
          Card,
          null,
          h(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
            h(Dot, { color: stateColor[status] ?? C.text3, glow: running }),
            h('span', { style: { fontWeight: 600, fontSize: 13 } }, stateLabel),
          ),
          data
            ? h(
                'div',
                { style: { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 } },
                h(Row, { label: t('port') }, String(data.daemonPort)),
                h(Row, { label: t('version') }, data.apiVersion ?? '—'),
                h(Row, { label: t('bank') }, h('code', { style: mono }, data.bank)),
                data.env
                  ? h(Row, { label: t('provider') }, `${data.env.provider} / ${data.env.model}`)
                  : null,
                h(Row, { label: t('cache') }, data.config?.installDir || t('systemDefault')),
              )
            : null,
          data && !running ? h('div', { style: { marginTop: 12, fontSize: 12, color: C.text2 } }, t('downHint')) : null,
          data && status === 'starting' ? h('div', { style: { marginTop: 12, fontSize: 12, color: C.text2 } }, t('startHint')) : null,
          data?.error || actionError
            ? h(
                'div',
                { style: { marginTop: 12, fontSize: 12, color: C.err, wordBreak: 'break-word' } },
                `${t('errorTitle')}: ${actionError ?? data.error}`,
              )
            : null,
          loadError
            ? h(
                'div',
                { style: { marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: C.err } },
                `${t('errorTitle')}: ${loadError}`,
                h(Button, { onClick: loadOverview }, t('retry')),
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
          if (typeof offPanel === 'function') offPanel();
          if (typeof offRow === 'function') offRow();
        };
      });
    }

    return { name: NS, inject: ['slots', 'locale'], apply };
  },
});
