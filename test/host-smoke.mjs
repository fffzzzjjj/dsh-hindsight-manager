// Smoke test for the Host half, without booting the Harness.
//
//   npm run test:host
//
// It imports index.js, calls apply() with a recording ctx, then invokes every
// registered route handler against a fake request/response pair. The point is to
// catch module-evaluation and handler-time faults — a variable used before its
// declaration, a shadowed helper, a thrown exception on an empty body — before
// they reach a running Harness, where they surface only as a broken page.
//
// Side effects are contained: DSH_HOME points at a temporary directory (so the
// plugin config is written there, not to the real profile), and autoStart is
// switched off so the test never spawns a daemon.
import { existsSync, mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const home = mkdtempSync(join(tmpdir(), 'dsh-hm-host-'));
process.env.DSH_HOME = home;
// The key writer resolves `~/.hindsight`; point the user profile at the same
// sandbox so a save-key test cannot reach the real environment file.
process.env.USERPROFILE = home;
process.env.HOME = home;
mkdirSync(join(home, 'storages', 'dsh-hindsight-manager'), { recursive: true });
writeFileSync(
  join(home, 'storages', 'dsh-hindsight-manager', 'config.json'),
  JSON.stringify({ installDir: '', autoStart: false }),
  'utf8',
);

const problems = [];
const note = (message) => problems.push(message);

const routes = new Map();
const noop = () => {};
const ctx = {
  get: () => undefined,
  inject(_names, callback) {
    callback({
      get: (name) =>
        name === 'webServer'
          ? {
              port: 1, // nothing listens here; the handlers only use it for origin
              register(spec) {
                routes.set(spec.path, spec.handler);
                return noop;
              },
            }
          : undefined,
      effect(fn) {
        const dispose = fn();
        return () => (typeof dispose === 'function' ? dispose() : undefined);
      },
    });
  },
  effect: () => noop,
  on: noop,
  logger: { info: noop, warn: noop, error: noop },
};

function makeRes() {
  const res = {
    status: null,
    headers: null,
    body: null,
    writeHead(status, headers) {
      res.status = status;
      res.headers = headers;
    },
    end(payload) {
      res.body = payload;
      try {
        res.json = JSON.parse(payload);
      } catch {
        res.json = null;
      }
    },
  };
  return res;
}

function makeReq({ method = 'GET', url = '/', body } = {}) {
  const listeners = new Map();
  const req = {
    method,
    url,
    on(event, handler) {
      listeners.set(event, handler);
      return req;
    },
    destroy: noop,
  };
  // Deliver the body (or nothing) once the handler has subscribed.
  queueMicrotask(() => {
    const onData = listeners.get('data');
    const onEnd = listeners.get('end');
    if (body !== undefined && onData) onData(Buffer.from(body, 'utf8'));
    if (onEnd) onEnd();
  });
  return req;
}

async function call(pathWithQuery, options) {
  const path = pathWithQuery.split('?')[0];
  const handler = routes.get(path);
  if (handler === undefined) {
    note(`route not registered: ${path}`);
    return null;
  }
  const res = makeRes();
  await handler(makeReq({ ...options, url: pathWithQuery }), res);
  return res;
}

const mod = await import('../index.js');
if (typeof mod.apply !== 'function') note('index.js exports no apply');
if (mod.name !== 'hindsight-manager') note(`exported name = ${mod.name}`);

mod.apply(ctx);

const expected = [
  '/hindsight-manager/api/overview',
  '/hindsight-manager/api/setup',
  '/hindsight-manager/api/daemon',
  '/hindsight-manager/api/documents',
  '/hindsight-manager/api/graph',
  '/hindsight-manager/api/entity',
  '/hindsight-manager/api/memory/history',
  '/hindsight-manager/api/banks',
  '/hindsight-manager/api/health',
  '/hindsight-manager/api/cleanup',
  '/hindsight-manager/api/usage',
  '/hindsight-manager/api/update',
  '/hindsight-manager/api/memories/action',
  '/hindsight-manager/api/health/probe',
  '/hindsight-manager/api/bank-config',
  '/hindsight-manager/api/search',
  '/hindsight-manager/api/config',
];
for (const path of expected) if (!routes.has(path)) note(`missing route: ${path}`);

// ── setup: the guided checklist answers without a daemon or integration ──────
const setupGet = await call('/hindsight-manager/api/setup', { method: 'GET' });
if (setupGet) {
  if (setupGet.status !== 200) note(`setup GET status = ${setupGet.status} (${setupGet.body})`);
  const body = setupGet.json ?? {};
  if (body.ok !== true) note(`setup ok = ${body.ok} (${setupGet.body})`);
  if (!Array.isArray(body.steps) || body.steps.length !== 4) note('setup does not expose four steps');
  if (typeof body.ready !== 'boolean') note('setup has no ready flag');
  if (typeof body.port?.value !== 'number') note('setup has no port value');
  if (!body.integration || typeof body.integration.installed !== 'boolean') note('setup has no integration state');
  if (!body.apiKey || typeof body.apiKey.configured !== 'boolean') note('setup has no apiKey state');
}

const setupBad = await call('/hindsight-manager/api/setup', {
  method: 'POST',
  body: JSON.stringify({ action: 'nope' }),
});
if (setupBad && setupBad.status !== 400) note(`setup unknown action status = ${setupBad.status}`);

const keyBad = await call('/hindsight-manager/api/setup', {
  method: 'POST',
  body: JSON.stringify({ action: 'save-key', apiKey: 'short' }),
});
if (keyBad && keyBad.status !== 400) note(`setup short key status = ${keyBad.status}`);

// A valid key must land in the profile env file — this is the path that threw
// "mkdirSync is not defined" when the import went missing.
const keyOk = await call('/hindsight-manager/api/setup', {
  method: 'POST',
  body: JSON.stringify({ action: 'save-key', apiKey: 'sk-test-0123456789abcdef' }),
});
if (keyOk) {
  if (keyOk.status !== 200 || keyOk.json?.ok !== true) note(`setup save-key status = ${keyOk.status} (${keyOk.body})`);
  const envPath = join(home, '.hindsight', 'profiles', 'coding-agent.env');
  if (!existsSync(envPath)) {
    note('save-key did not create the profile env file');
  } else if (!readFileSync(envPath, 'utf8').includes('HINDSIGHT_API_LLM_API_KEY=sk-test-0123456789abcdef')) {
    note('save-key did not persist the key into the profile env file');
  }
}

// ── overview: must answer whether or not a daemon is listening ───────────────
const overview = await call('/hindsight-manager/api/overview');
if (overview) {
  if (overview.status !== 200) note(`overview status = ${overview.status} (${overview.body})`);
  const body = overview.json ?? {};
  if (body.ok !== true) note(`overview ok = ${body.ok} (${overview.body})`);
  if (typeof body.status !== 'string') note('overview has no status string');
  if (typeof body.bank !== 'string' || !body.bank.startsWith('coding-agent::')) {
    note(`overview bank = ${body.bank}`);
  }
  if (typeof body.daemonPort !== 'number') note('overview has no daemonPort');
  if (!body.config || typeof body.config.autoStart !== 'boolean') note('overview has no config');
}

// ── config: read, reject bad input, accept a patch ───────────────────────────
const configGet = await call('/hindsight-manager/api/config', { method: 'GET' });
if (configGet && (configGet.status !== 200 || configGet.json?.ok !== true)) {
  note(`config GET status = ${configGet.status} (${configGet.body})`);
}

const configBad = await call('/hindsight-manager/api/config', {
  method: 'POST',
  body: JSON.stringify({ bogus: 1 }),
});
if (configBad && configBad.status !== 400) note(`config POST unknown field status = ${configBad.status}`);

const configWrongType = await call('/hindsight-manager/api/config', {
  method: 'POST',
  body: JSON.stringify({ autoStart: 'yes' }),
});
if (configWrongType && configWrongType.status !== 400) note(`config POST wrong type status = ${configWrongType.status}`);

const configOk = await call('/hindsight-manager/api/config', {
  method: 'POST',
  body: JSON.stringify({ installDir: 'D:\\hindsight-test', autoStart: false }),
});
if (configOk) {
  if (configOk.status !== 200 || configOk.json?.ok !== true) note(`config POST status = ${configOk.status} (${configOk.body})`);
  const written = JSON.parse(readFileSync(join(home, 'storages', 'dsh-hindsight-manager', 'config.json'), 'utf8'));
  if (written.installDir !== 'D:\\hindsight-test') note(`config not persisted: ${JSON.stringify(written)}`);
  if (written.autoStart !== false) note(`config autoStart not persisted: ${JSON.stringify(written)}`);
  if (written.showFooterStatus !== true) note(`config showFooterStatus default: ${JSON.stringify(written)}`);
  if (written.showSidebarEntry !== true) note(`config showSidebarEntry default: ${JSON.stringify(written)}`);
}

const configToggles = await call('/hindsight-manager/api/config', {
  method: 'POST',
  body: JSON.stringify({ showFooterStatus: false, showSidebarEntry: false }),
});
if (configToggles) {
  if (configToggles.status !== 200) note(`config toggles status = ${configToggles.status} (${configToggles.body})`);
  const written = JSON.parse(readFileSync(join(home, 'storages', 'dsh-hindsight-manager', 'config.json'), 'utf8'));
  if (written.showFooterStatus !== false) note(`showFooterStatus not persisted: ${JSON.stringify(written)}`);
  if (written.showSidebarEntry !== false) note(`showSidebarEntry not persisted: ${JSON.stringify(written)}`);
}

const configToggleBad = await call('/hindsight-manager/api/config', {
  method: 'POST',
  body: JSON.stringify({ showFooterStatus: 'yes' }),
});
if (configToggleBad && configToggleBad.status !== 400) {
  note(`config toggle wrong type status = ${configToggleBad.status}`);
}

// ── banks: a list and a selected value, or a reported failure ────────────────
const banksCall = await call('/hindsight-manager/api/banks');
if (banksCall) {
  const body = banksCall.json ?? {};
  if (banksCall.status === 200) {
    if (!Array.isArray(body.banks)) note('banks payload has no banks array');
    if (typeof body.selected !== 'string') note('banks payload has no selected value');
  } else if (banksCall.status === 500) {
    if (body.ok !== false) note('banks failure body is not ok:false');
  } else {
    note(`banks status = ${banksCall.status}`);
  }
}

const bankBad = await call('/hindsight-manager/api/config', {
  method: 'POST',
  body: JSON.stringify({ bank: 'other-prefix' }),
});
if (bankBad && bankBad.status !== 400) note(`config bank wrong prefix status = ${bankBad.status}`);

const bankOk = await call('/hindsight-manager/api/config', {
  method: 'POST',
  body: JSON.stringify({ bank: 'coding-agent::DSH' }),
});
if (bankOk) {
  if (bankOk.status !== 200) note(`config bank status = ${bankOk.status}`);
  const written = JSON.parse(readFileSync(join(home, 'storages', 'dsh-hindsight-manager', 'config.json'), 'utf8'));
  if (written.bank !== 'coding-agent::DSH') note(`config bank not persisted: ${JSON.stringify(written)}`);
}

// ── bank health and per-bank settings ────────────────────────────────────────
const healthCall = await call('/hindsight-manager/api/health');
if (healthCall) {
  if (healthCall.status === 200) {
    if (!healthCall.json?.stats || typeof healthCall.json.stats !== 'object') note('health has no stats');
  } else if (healthCall.status === 500) {
    if (healthCall.json?.ok !== false) note('health failure body is not ok:false');
  } else {
    note(`health status = ${healthCall.status}`);
  }
}

const bankConfigGet = await call('/hindsight-manager/api/bank-config', { method: 'GET' });
if (bankConfigGet) {
  if (bankConfigGet.status === 200) {
    const config = bankConfigGet.json?.config ?? {};
    for (const key of ['recall_max_tokens', 'enable_reranking', 'enable_observations']) {
      if (!(key in config)) note(`bank-config GET is missing ${key}`);
    }
  } else if (bankConfigGet.status === 500) {
    if (bankConfigGet.json?.ok !== false) note('bank-config failure body is not ok:false');
  } else {
    note(`bank-config GET status = ${bankConfigGet.status}`);
  }
}

const bankConfigUnknown = await call('/hindsight-manager/api/bank-config', {
  method: 'PATCH',
  body: JSON.stringify({ updates: { nope: true } }),
});
if (bankConfigUnknown && bankConfigUnknown.status !== 400) {
  note(`bank-config unknown key status = ${bankConfigUnknown.status}`);
}

const bankConfigBadValue = await call('/hindsight-manager/api/bank-config', {
  method: 'PATCH',
  body: JSON.stringify({ updates: { recall_max_tokens: 'many' } }),
});
if (bankConfigBadValue && bankConfigBadValue.status !== 400) {
  note(`bank-config bad value status = ${bankConfigBadValue.status}`);
}

const bankConfigOk = await call('/hindsight-manager/api/bank-config', {
  method: 'PATCH',
  body: JSON.stringify({ updates: { enable_reranking: true } }),
});
if (bankConfigOk && ![200, 500].includes(bankConfigOk.status)) note(`bank-config PATCH status = ${bankConfigOk.status}`);

const probeCall = await call('/hindsight-manager/api/health/probe', { method: 'POST', body: '{}' });
if (probeCall) {
  if (probeCall.status === 200) {
    if (typeof probeCall.json?.probe?.ms !== 'number') note('probe has no duration');
  } else if (probeCall.status === 500) {
    if (probeCall.json?.ok !== false) note('probe failure body is not ok:false');
  } else {
    note(`probe status = ${probeCall.status}`);
  }
}

const budgetBad = await call('/hindsight-manager/api/config', {
  method: 'POST',
  body: JSON.stringify({ searchBudget: 'medium' }),
});
if (budgetBad && budgetBad.status !== 400) note(`config searchBudget invalid status = ${budgetBad.status}`);

const budgetOk = await call('/hindsight-manager/api/config', {
  method: 'POST',
  body: JSON.stringify({ searchBudget: 'high' }),
});
if (budgetOk) {
  if (budgetOk.status !== 200) note(`config searchBudget status = ${budgetOk.status}`);
  const written = JSON.parse(readFileSync(join(home, 'storages', 'dsh-hindsight-manager', 'config.json'), 'utf8'));
  if (written.searchBudget !== 'high') note(`searchBudget not persisted: ${JSON.stringify(written)}`);
}

// ── cleanup scan and bulk actions ───────────────────────────────────────────
const cleanupCall = await call('/hindsight-manager/api/cleanup?staleDays=90&scan=200');
if (cleanupCall) {
  if (cleanupCall.status === 200) {
    if (!cleanupCall.json?.counts) note('cleanup payload has no counts');
    if (!Array.isArray(cleanupCall.json?.duplicates)) note('cleanup payload has no duplicates array');
    if (!Array.isArray(cleanupCall.json?.forgotten)) note('cleanup payload has no forgotten array');
  } else if (cleanupCall.status === 500) {
    if (cleanupCall.json?.ok !== false) note('cleanup failure body is not ok:false');
  } else {
    note(`cleanup status = ${cleanupCall.status}`);
  }
}

// ── usage: a token report, or a reported failure — never a thrown handler ──
const usageCall = await call('/hindsight-manager/api/usage?period=7d');
if (usageCall) {
  const body = usageCall.json ?? {};
  if (usageCall.status === 200) {
    if (body.ok !== true) note('usage payload is not ok:true');
    if (!Array.isArray(body.buckets)) note('usage payload has no buckets array');
    if (!body.totals || typeof body.totals.total !== 'number') note('usage payload has no totals.total');
    if (!body.today || typeof body.today.total !== 'number') note('usage payload has no today.total');
    if (!Array.isArray(body.byOperation)) note('usage payload has no byOperation array');
    if (!Array.isArray(body.byModel)) note('usage payload has no byModel array');
    if (!Array.isArray(body.recent)) note('usage payload has no recent array');
    if (typeof body.period !== 'string') note('usage payload has no period');
    if (!('cost' in (body.totals ?? {}))) note('usage totals has no cost field');
    if (typeof body.totals?.costEstimated !== 'boolean') note('usage totals has no costEstimated flag');
    if (!body.pricing || typeof body.pricing !== 'object') note('usage payload has no price table');
    if (!('cost' in (body.today ?? {}))) note('usage today has no cost field');
  } else if (usageCall.status === 500) {
    if (body.ok !== false) note('usage failure body is not ok:false');
  } else {
    note(`usage status = ${usageCall.status}`);
  }
}

const usageBadPeriod = await call('/hindsight-manager/api/usage?period=1y');
if (usageBadPeriod && ![200, 500].includes(usageBadPeriod.status)) {
  note(`usage unknown period status = ${usageBadPeriod.status}`);
}

// 24 h is rebuilt from the call log: one slot per hour, not one bar per day.
const usageDay = await call('/hindsight-manager/api/usage?period=1d');
if (usageDay && usageDay.status === 200) {
  const buckets = Array.isArray(usageDay.json?.buckets) ? usageDay.json.buckets : [];
  if (buckets.length > 25) note(`usage 1d returned ${buckets.length} buckets, expected at most 25 hourly slots`);
  const hourly = buckets.filter((bucket) => /^\d{2}:\d{2}$/.test(String(bucket?.label ?? '')));
  const busy = buckets.some((bucket) => Number(bucket?.calls ?? 0) > 0);
  if (busy && hourly.length === 0) note('usage 1d has calls but no hourly buckets');
} else if (usageDay && usageDay.status !== 500) {
  note(`usage 1d status = ${usageDay.status}`);
}

const actionUnknown = await call('/hindsight-manager/api/memories/action', {
  method: 'POST',
  body: JSON.stringify({ action: 'nuke', ids: ['x'] }),
});
if (actionUnknown && actionUnknown.status !== 400) note(`action unknown status = ${actionUnknown.status}`);

const actionNoReason = await call('/hindsight-manager/api/memories/action', {
  method: 'POST',
  body: JSON.stringify({ action: 'invalidate', ids: ['x'] }),
});
if (actionNoReason && actionNoReason.status !== 400) note(`action no reason status = ${actionNoReason.status}`);

const actionEmpty = await call('/hindsight-manager/api/memories/action', {
  method: 'POST',
  body: JSON.stringify({ action: 'invalidate', ids: [], reason: 'dup' }),
});
if (actionEmpty && actionEmpty.status !== 400) note(`action empty ids status = ${actionEmpty.status}`);

const historyNoId = await call('/hindsight-manager/api/memory/history');
if (historyNoId && historyNoId.status !== 400) note(`history without id status = ${historyNoId.status}`);

// ── update check reports a version or a network failure ─────────────────────
const updateCall = await call('/hindsight-manager/api/update');
if (updateCall) {
  if (updateCall.status === 200) {
    if (typeof updateCall.json?.current !== 'string') note('update payload has no current version');
    if (typeof updateCall.json?.updateAvailable !== 'boolean') note('update payload has no updateAvailable');
  } else if (updateCall.status === 502) {
    if (updateCall.json?.ok !== false) note('update failure body is not ok:false');
  } else {
    note(`update status = ${updateCall.status}`);
  }
}

// ── search: an empty query is a client error, not a crash ────────────────────
const searchEmpty = await call('/hindsight-manager/api/search', { method: 'POST', body: JSON.stringify({}) });
if (searchEmpty && searchEmpty.status !== 400) note(`search empty query status = ${searchEmpty.status}`);

// ── documents: answers or reports, never throws ──────────────────────────────
const documents = await call('/hindsight-manager/api/documents?limit=3');
if (documents) {
  if (![200, 404, 500].includes(documents.status)) note(`documents status = ${documents.status}`);
  if (documents.json === null) note(`documents body is not JSON: ${documents.body}`);
}

// ── graph: a valid payload, or a reported failure — never a thrown handler ───
const graph = await call('/hindsight-manager/api/graph');
if (graph) {
  const body = graph.json ?? {};
  if (graph.status === 200) {
    if (body.ok !== true) note('graph payload is not ok:true');
    if (!Array.isArray(body.nodes)) note('graph payload has no nodes array');
    if (!Array.isArray(body.edges)) note('graph payload has no edges array');
    if (!body.span || typeof body.span !== 'object') note('graph payload has no time span');
    const timed = (body.nodes ?? []).filter((node) => typeof node.firstSeen === 'string');
    if (timed.length === 0) note('graph payload carries no firstSeen timestamps');
  } else if (graph.status === 404 || graph.status === 500) {
    if (body.ok !== false) note('graph failure body is not ok:false');
    if (typeof body.error !== 'string') note('graph failure body has no error text');
  } else {
    note(`graph status = ${graph.status}`);
  }
}

const entityNoId = await call('/hindsight-manager/api/entity');
if (entityNoId && entityNoId.status !== 400) note(`entity without id status = ${entityNoId.status}`);

// ── daemon: an unknown action is rejected without touching anything ──────────
const daemonBad = await call('/hindsight-manager/api/daemon', {
  method: 'POST',
  body: JSON.stringify({ action: 'restart' }),
});
if (daemonBad && daemonBad.status !== 400) note(`daemon unknown action status = ${daemonBad.status}`);

rmSync(home, { recursive: true, force: true });

if (problems.length > 0) {
  console.error('FAIL');
  for (const problem of problems) console.error(' - ' + problem);
  process.exitCode = 1;
} else {
  console.log(`OK: apply registered ${routes.size} routes and every handler answered without throwing`);
  console.log(`   routes: ${[...routes.keys()].join(', ')}`);
}
