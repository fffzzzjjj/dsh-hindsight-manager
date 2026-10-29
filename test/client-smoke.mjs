// Smoke test for this plugin's browser half, without a browser.
//
//   npm test
//   node test/client-smoke.mjs [client.js path]
//
// It evaluates the bundle in a fake module-loader environment, runs the factory
// with a stub React, calls apply() with a recording ctx, then RENDERS the page
// component once, so a runtime error (bad property access, broken ternary)
// surfaces here instead of blanking the real slot in the live UI.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
const clientPath = process.argv[2] ?? fileURLToPath(new URL('client.js', root));
const expectedId = manifest.name;
const apiPrefix = '/hindsight-manager/api';

const source = readFileSync(clientPath, 'utf8');
const problems = [];
const note = (message) => problems.push(message);

let captured = null;
globalThis.window = {
  __ModuleLoader__: {
    load(descriptor) {
      captured = descriptor;
    },
  },
};

// ── stub React ────────────────────────────────────────────────────────────────
const seen = [];
const React = {
  Fragment: Symbol('Fragment'),
  createElement(type, props, ...children) {
    const node = { type, props: props ?? {}, children: children.flat() };
    seen.push(node);
    return node;
  },
  useState(initial) {
    return [typeof initial === 'function' ? initial() : initial, () => {}];
  },
  useEffect() {
    return undefined;
  },
  useCallback(fn) {
    return fn;
  },
  useRef(value) {
    return { current: value };
  },
};

new Function('window', source)(globalThis.window);
if (captured === null) throw new Error('bundle never called __ModuleLoader__.load');
if (captured.id !== expectedId) note(`module id = ${captured.id}, expected ${expectedId}`);

const mod = captured.factory((specifier) => {
  if (specifier === 'react') return React;
  throw new Error(`unexpected require: ${specifier}`);
});

if (typeof mod.apply !== 'function') note('missing apply');
if (mod.inject?.join(',') !== 'slots,locale,layout,uiWorkspace') note(`inject = ${mod.inject}`);

// ── recording ctx ─────────────────────────────────────────────────────────────
const registrations = [];
const ctx = {
  effect(fn) {
    const dispose = fn();
    return () => (typeof dispose === 'function' ? dispose() : undefined);
  },
  locale: {
    register(ns, tables) {
      for (const [lang, table] of Object.entries(tables)) {
        if (!table || typeof table !== 'object') note(`locale ${ns}/${lang} is not an object`);
      }
      return () => {};
    },
    // deliberately absent `t`: exercises the fallback translator path
  },
  slots: {
    inject(_name, callback) {
      const dispose = callback();
      return () => (typeof dispose === 'function' ? dispose() : undefined);
    },
    register(options, component) {
      registrations.push({ options, component });
      return () => {
        options.__disposed = true;
      };
    },
  },
  layout: { selectPanel() {} },
  get(name) {
    if (name === 'uiWorkspace') return { pickDirectory: async () => 'D:\\picked-cache' };
    return undefined;
  },
};

mod.apply(ctx);

const bySlot = new Map(registrations.map((entry) => [entry.options.name, entry]));
if (!bySlot.has('main')) note('no main panel registered');
if (!bySlot.has('sidebar.panellist')) note('no sidebar row registered');

const main = bySlot.get('main');
const row = bySlot.get('sidebar.panellist');
// The row id and the panel key must name the same panel, or clicking the row
// selects nothing. The value itself is free — the host matches them to each other.
if (main && row && main.options.key !== row.options.id) {
  note(`main key (${main.options.key}) !== row id (${row.options.id})`);
}
if (row) {
  const label = row.options.label?.();
  if (typeof label !== 'string' || label.trim() === '') note(`row label = ${label}`);
  for (const owner of [{ size: 16 }, {}, undefined]) {
    try {
      row.component(owner);
    } catch (error) {
      note(`row icon threw for owner ${JSON.stringify(owner)}: ${error.message}`);
    }
  }
}

// ── the cache picker is injected and reaches the workspace service ───────────
const mainInject = main?.options?.inject?.();
if (typeof mainInject?.pickDirectory !== 'function') {
  note('main panel did not receive pickDirectory');
} else {
  const picked = await mainInject.pickDirectory();
  if (picked !== 'D:\\picked-cache') note(`pickDirectory returned ${JSON.stringify(picked)}`);
}

// ── the two visibility toggles register and dispose their slots ──────────────
if (typeof mainInject?.applyUiConfig !== 'function') {
  note('main panel did not receive applyUiConfig');
} else {
  mainInject.applyUiConfig({ showFooterStatus: false, showSidebarEntry: false });
  if (row?.options?.__disposed !== true) note('sidebar row not disposed when hidden');
  if (bySlot.get('sidebar.footer.action')?.options?.__disposed !== true) note('footer chip not disposed when hidden');

  mainInject.applyUiConfig({ showFooterStatus: true, showSidebarEntry: true });
  const liveRows = registrations.filter((entry) => entry.options.name === 'sidebar.panellist' && entry.options.__disposed !== true);
  const liveFooters = registrations.filter((entry) => entry.options.name === 'sidebar.footer.action' && entry.options.__disposed !== true);
  if (liveRows.length !== 1) note(`sidebar row re-registration count = ${liveRows.length}`);
  if (liveFooters.length !== 1) note(`footer chip re-registration count = ${liveFooters.length}`);
}

// ── the bundle config block on the Plugins page ──────────────────────────────
const bundleConfig = bySlot.get('plugins.bundle.config');
if (bundleConfig === undefined) {
  note('no plugins.bundle.config registration');
} else {
  if (bundleConfig.options.key !== 'dsh-hindsight-manager') {
    note(`bundle config key = ${bundleConfig.options.key}`);
  }
  try {
    bundleConfig.component({ view: 'page' });
  } catch (error) {
    note(`bundle config threw: ${error.message}`);
  }
}

// ── the graph layout helpers and the canvas ─────────────────────────────────
const handles = mod.__test ?? {};
if (typeof handles.focusLayout !== 'function' || typeof handles.fullLayout !== 'function') {
  note('graph layout helpers are not exported for the test');
} else {
  const nodes = [
    { id: 'a', label: 'alpha', mentions: 5 },
    { id: 'b', label: 'beta', mentions: 3 },
    { id: 'c', label: 'gamma', mentions: 1 },
    { id: 'd', label: 'delta', mentions: 1 },
  ];
  const edges = [
    { source: 'a', target: 'b', weight: 2 },
    { source: 'b', target: 'c', weight: 1 },
    { source: 'b', target: 'd', weight: 1 },
  ];
  const focused = handles.focusLayout(nodes, edges, 'a', 600, 400);
  if (!focused) note('focusLayout returned nothing');
  else {
    if (!focused.positions.has('a')) note('focusLayout dropped the focus node');
    if (focused.positions.size !== 4) note(`focusLayout placed ${focused.positions.size} nodes, expected 4`);
    if (!(focused.adjacency.get('a') ?? []).length) note('focusLayout has no adjacency for the focus node');
    if (!focused.labelIds.has('b')) note('focusLayout did not label a direct neighbour');
  }
  const full = handles.fullLayout(nodes, edges, 600, 400, 2, 1);
  if (!full) note('fullLayout returned nothing');
  else {
    if (full.positions.size !== 2) note(`fullLayout kept ${full.positions.size} nodes, expected 2 above minCount 2`);
    if (!full.labelIds.has('a')) note('fullLayout did not label the busiest node');
  }
}

if (typeof handles.GraphCanvas !== 'function') {
  note('GraphCanvas is not exported for the test');
} else {
  try {
    const tree = handles.GraphCanvas({
      t: (key) => key,
      width: 600,
      height: 400,
      focusId: 'a',
      stamp: 1,
      nodes: [
        { id: 'a', label: 'alpha', mentions: 5 },
        { id: 'b', label: 'beta', mentions: 3 },
      ],
      edges: [{ source: 'a', target: 'b', weight: 2 }],
    });
    const shapes = [];
    (function collect(node) {
      if (node === null || node === undefined) return;
      if (Array.isArray(node)) {
        node.forEach(collect);
        return;
      }
      if (typeof node !== 'object' || !('type' in node)) return;
      if (node.type === 'circle' || node.type === 'line' || node.type === 'text') shapes.push(node.type);
      (node.children ?? []).forEach(collect);
    })(tree);
    if (!shapes.includes('circle')) note('GraphCanvas drew no nodes');
    if (!shapes.includes('line')) note('GraphCanvas drew no edges');
    if (!shapes.includes('text')) note('GraphCanvas drew no labels');

    // Growth mode: a cutoff before the second node's firstSeen hides it.
    const revealed = handles.GraphCanvas({
      t: (key) => key,
      width: 600,
      height: 400,
      focusId: null,
      stamp: 1,
      minCount: 1,
      reveal: { cutoff: Date.parse('2026-10-25T12:00:00Z'), start: Date.parse('2026-10-25T00:00:00Z'), end: Date.parse('2026-10-26T00:00:00Z') },
      nodes: [
        { id: 'a', label: 'alpha', mentions: 5, firstSeen: '2026-10-25T10:00:00Z' },
        { id: 'b', label: 'beta', mentions: 3, firstSeen: '2026-10-25T18:00:00Z' },
      ],
      edges: [{ source: 'a', target: 'b', weight: 2, firstSeen: '2026-10-25T18:00:00Z' }],
    });
    const circles = [];
    (function collect(node) {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) { node.forEach(collect); return; }
      if (node.type === 'circle') circles.push(node);
      (node.children ?? []).forEach(collect);
    })(revealed);
    if (circles.length !== 1) note(`reveal cutoff drew ${circles.length} nodes, expected 1`);
  } catch (error) {
    note(`GraphCanvas threw: ${error.stack?.split('\n').slice(0, 3).join(' | ')}`);
  }
}

// ── the cleanup panel renders its list ─────────────────────────────────────
if (typeof handles.CleanupPanel !== 'function') {
  note('CleanupPanel is not exported for the test');
} else {
  try {
    const item = (id, text, factType) => ({ id, text, factType, date: '2026-10-01T00:00:00Z' });
    const tree = handles.CleanupPanel({
      t: (key) => key,
      running: true,
      loading: false,
      staleDays: 90,
      onChangeStaleDays() {},
      onRefresh() {},
      data: {
        scanned: 12,
        total: 12,
        truncated: false,
        staleDays: 90,
        counts: { invalidated: 1, duplicateGroups: 1, duplicateItems: 2, stale: 1 },
        duplicates: [[item('a', '相同的记忆内容在这里', 'experience'), item('b', '相同的记忆内容在这里', 'experience')]],
        stale: [item('c', '很久没有变动的记忆内容', 'world')],
        forgotten: [{ ...item('d', '已经失效的记忆', 'experience'), invalidatedAt: '2026-10-02T00:00:00Z', reason: 'dup' }],
      },
    });
    let checkboxes = 0;
    (function walk(node) {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) { node.forEach(walk); return; }
      if (node.type === 'input' && node.props?.type === 'checkbox') checkboxes += 1;
      (node.children ?? []).forEach(walk);
    })(tree);
    if (checkboxes !== 2) note(`cleanup panel drew ${checkboxes} duplicate rows, expected 2`);
    let keepHints = 0;
    (function walk(node) {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) { node.forEach(walk); return; }
      if (node.type === 'span' && (node.children ?? []).includes('cleanupKeepHint')) keepHints += 1;
      (node.children ?? []).forEach(walk);
    })(tree);
    if (keepHints < 1) note('duplicate group does not mark a keeper');
  } catch (error) {
    note(`CleanupPanel threw: ${error.stack?.split('\n').slice(0, 3).join(' | ')}`);
  }
}

// ── the usage panel draws its totals, a bar per day and the split ──────────
if (typeof handles.UsagePanel !== 'function') {
  note('UsagePanel is not exported for the test');
} else {
  try {
    const tree = handles.UsagePanel({
      t: (key) => key,
      running: true,
      loading: false,
      period: '7d',
      onChangePeriod() {},
      onRefresh() {},
      usage: {
        totals: { calls: 9, input: 1000, output: 234, cached: 500, thoughts: 0, total: 1234, cost: 0.4231, pricedCalls: 9 },
        today: { calls: 2, input: 300, output: 0, cached: 0, thoughts: 0, total: 300, cost: 0.12 },
        buckets: [
          { date: '2026-10-27', label: '10-27', calls: 3, tokens: { total: 400 }, cost: 0.1 },
          { date: '2026-10-28', label: '10-28', calls: 4, tokens: { total: 430 }, cost: 0.2 },
          { date: '2026-10-29', label: '10-29', calls: 2, tokens: { total: 404 }, cost: 0.12 },
        ],
        byOperation: [{ key: 'retain', calls: 5, total: 900, cost: 0.3 }],
        byModel: [{ key: 'deepseek-flash', calls: 9, total: 1234, cost: 0.42 }],
        recent: [
          {
            at: '2026-10-29T10:00:00Z',
            operation: 'retain',
            model: 'deepseek-flash',
            ms: 900,
            status: 'success',
            input: 800,
            output: 100,
            cached: 0,
            total: 900,
            cost: 0.0009,
          },
        ],
        sampled: 9,
        truncated: false,
      },
    });
    let bars = 0;
    let texts = [];
    (function walk(node) {
      if (typeof node === 'string') {
        texts.push(node);
        return;
      }
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) { node.forEach(walk); return; }
      if (node.type === 'div' && node.props?.style?.borderRadius === '3px 3px 0 0') bars += 1;
      (node.children ?? []).forEach(walk);
    })(tree);
    if (bars !== 3) note(`usage panel drew ${bars} day bars, expected 3`);
    if (!texts.includes('1,234')) note('usage panel does not show the range total');
    if (!texts.includes('300')) note('usage panel does not show today’s total');
    if (!texts.includes('retain')) note('usage panel does not list the operation split');
    if (!texts.includes('¥0.42')) note('usage panel does not show the estimated cost');
    if (!texts.includes('10-29')) note('usage chart does not render the bucket label');
    // Column width, not flex: three days must not stretch across the page.
    let fixedColumns = 0;
    (function walk(node) {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) { node.forEach(walk); return; }
      if (node.props?.style?.width === 20 && node.props?.style?.flex === 'none') fixedColumns += 1;
      (node.children ?? []).forEach(walk);
    })(tree);
    if (fixedColumns !== 6) note(`usage chart drew ${fixedColumns} fixed columns, expected 6 (3 bars + 3 labels)`);
  } catch (error) {
    note(`UsagePanel threw: ${error.stack?.split('\n').slice(0, 3).join(' | ')}`);
  }
}

// ── the retrieval-quality card names the models and flags a language mismatch ─
if (typeof handles.RecallQualityCard !== 'function') {
  note('RecallQualityCard is not exported for the test');
} else {
  try {
    const tree = handles.RecallQualityCard({
      t: (key) => key,
      running: true,
      loading: false,
      testing: false,
      quality: {
        embedding: { model: 'BAAI/bge-small-en-v1.5', dimension: 384 },
        rerank: { model: 'cross-encoder/ms-marco-MiniLM-L-6-v2', enabled: true },
        language: { sampled: 40, chineseRatio: 0.9 },
        settings: { budget: 'fixed', maxTokens: 2048 },
        warnings: [{ code: 'english-embedding', params: { model: 'BAAI/bge-small-en-v1.5', ratio: 90 } }],
      },
      test: {
        ms: 4400,
        count: 19,
        approxTokens: 1969,
        scoreSpread: 0.003,
        semanticHits: 0,
        keywordHits: 0,
        results: [{ text: 'a fact', final: 1.12 }],
      },
      onTest() {},
    });
    const texts = [];
    (function walk(node) {
      if (typeof node === 'string') {
        texts.push(node);
        return;
      }
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) { node.forEach(walk); return; }
      (node.children ?? []).forEach(walk);
    })(tree);
    if (!texts.some((text) => String(text).includes('BAAI/bge-small-en-v1.5'))) {
      note('quality card does not name the embedding model');
    }
    if (!texts.some((text) => String(text).includes('qualityWarnEnglishEmbedding'))) {
      note('quality card does not flag the English embedding model');
    }
    if (!texts.includes('qualityWarnSaturated')) note('quality card does not flag saturated scores');
    if (!texts.includes('qualityWarnSparse')) note('quality card does not flag sparse arms');
  } catch (error) {
    note(`RecallQualityCard threw: ${error.stack?.split('\n').slice(0, 3).join(' | ')}`);
  }
}

// ── observation history panel renders its loading state ────────────────────
if (typeof handles.ObservationHistory !== 'function') {
  note('ObservationHistory is not exported for the test');
} else {
  try {
    const tree = handles.ObservationHistory({ t: (key) => key, id: 'memory-1', onClose() {} });
    if (!tree) note('ObservationHistory rendered nothing');
  } catch (error) {
    note(`ObservationHistory threw: ${error.stack?.split('\n').slice(0, 3).join(' | ')}`);
  }
}

// ── cleanup stale list exposes observation history ─────────────────────────
if (typeof handles.CleanupPanel === 'function') {
  try {
    const stale = handles.CleanupPanel({
      t: (key) => key,
      running: true,
      loading: false,
      staleDays: 90,
      initialFilter: 'stale',
      onChangeStaleDays() {},
      onRefresh() {},
      data: {
        scanned: 5,
        total: 5,
        truncated: false,
        staleDays: 90,
        counts: { invalidated: 0, duplicateGroups: 0, duplicateItems: 0, stale: 1 },
        duplicates: [],
        stale: [{ id: 'o1', text: '很久没有变动的观察内容', factType: 'observation', date: '2026-01-01T00:00:00Z' }],
        forgotten: [],
      },
    });
    let clickableRows = 0;
    (function walk(node) {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) { node.forEach(walk); return; }
      if (node.type === 'label' && typeof node.props?.onClick === 'function') clickableRows += 1;
      (node.children ?? []).forEach(walk);
    })(stale);
    if (clickableRows < 1) note('cleanup stale observation row does not open history');
  } catch (error) {
    note(`CleanupPanel stale threw: ${error.stack?.split('\n').slice(0, 3).join(' | ')}`);
  }
}

// ── render once with the fallback translator ─────────────────────────────────
function renderCase() {
  seen.length = 0;
  try {
    const tree = main.component({});
    if (tree === undefined || tree === null) note('rendered nothing');
    const texts = [];
    (function walk(node) {
      if (node === null || node === undefined) return;
      if (typeof node === 'string') {
        texts.push(node);
        return;
      }
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }
      if (typeof node === 'object' && 'type' in node) {
        (node.children ?? []).forEach(walk);
        if (node.props?.children) walk(node.props.children);
        if (node.props?.placeholder) texts.push(String(node.props.placeholder));
      }
    })(tree);

    const joined = texts.join(' ');
    if (!/本地记忆|Local Memory/.test(joined)) note(`title text missing (${joined.slice(0, 120)})`);
    if (!/启动|Start/.test(joined)) note('start action text missing');
    if (!/停止|Stop/.test(joined)) note('stop action text missing');

    // Start and stop must be two independent controls.
    const buttons = seen.filter(
      (node) => typeof node.type === 'function' && typeof node.props?.onClick === 'function' && 'disabled' in node.props,
    );
    if (buttons.length < 2) note(`expected 2 action buttons, got ${buttons.length}`);

    // The status area must not be clickable: that was the original defect.
    const clickable = seen.filter(
      (node) =>
        typeof node.type === 'string' &&
        !['input', 'button'].includes(node.type) &&
        typeof node.props?.onClick === 'function',
    );
    if (clickable.length > 0) note(`${clickable.length} non-button element(s) carry onClick`);

    // A settings form is part of the merged surface.
    const inputs = seen.filter((node) => node.type === 'input');
    if (inputs.length < 3) note(`expected >=3 inputs (search, installDir, autoStart), got ${inputs.length}`);
  } catch (error) {
    note(`render threw: ${error.stack?.split('\n').slice(0, 3).join(' | ')}`);
  }
}
renderCase();

// Every API path the bundle uses must live under the documented prefix. The
// bundle keeps one base constant and templates the rest, so check that constant.
if (apiPrefix) {
  const base = source.match(/const\s+API\s*=\s*['"`]([^'"`]+)['"`]/)?.[1];
  if (base === undefined) note('client declares no API base constant');
  else if (!base.startsWith(apiPrefix)) note(`client API base = ${base}, expected prefix ${apiPrefix}`);
  const absolute = [...source.matchAll(/['"`](\/[a-z-]+\/api\/[a-z-]+)['"`]/g)].map((match) => match[1]);
  const foreign = absolute.filter((path) => !path.startsWith(apiPrefix));
  if (foreign.length > 0) note(`client references other API prefixes: ${[...new Set(foreign)].join(', ')}`);
}

if (problems.length > 0) {
  console.error('FAIL');
  for (const problem of problems) console.error(' - ' + problem);
  process.exitCode = 1;
} else {
  console.log('OK: factory, apply, slot registrations and one render passed');
  console.log(
    `   registrations: ${registrations.map((entry) => `${entry.options.name}/${entry.options.id ?? entry.options.key}`).join(', ')}`,
  );
  console.log(`   sidebar label: ${row.options.label()}`);
}
