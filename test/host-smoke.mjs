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
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const home = mkdtempSync(join(tmpdir(), 'dsh-hm-host-'));
process.env.DSH_HOME = home;
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
  '/hindsight-manager/api/daemon',
  '/hindsight-manager/api/documents',
  '/hindsight-manager/api/search',
  '/hindsight-manager/api/config',
];
for (const path of expected) if (!routes.has(path)) note(`missing route: ${path}`);

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
  console.log('OK: apply registered 5 routes and every handler answered without throwing');
  console.log(`   routes: ${[...routes.keys()].join(', ')}`);
}
