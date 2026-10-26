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
