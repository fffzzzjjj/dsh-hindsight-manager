/**
 * dsh-hindsight-manager — Host half.
 *
 * Owns the local Hindsight daemon's whole lifecycle and serves the panel API.
 * It is deliberately self-contained: it spawns `hindsight-embed` itself instead
 * of driving another plugin's launcher, so nothing breaks when that plugin is
 * upgraded, renamed, or removed.
 *
 * Responsibilities
 *   - start / stop the daemon, with the LLM and cache environment it needs
 *   - one watchdog that stops the daemon when this Harness process exits
 *   - read the daemon's own log to explain a failed start instead of hanging
 *   - /hindsight-manager/api/* for the panel
 */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const name = 'hindsight-manager';

const PLUGIN = 'dsh-hindsight-manager';
/** Daemon port. `hindsight-embed`'s own default profile port; kept identical so
 *  an existing daemon started by hand is adopted rather than duplicated. */
const DAEMON_PORT = 9077;
const DAEMON_BASE = `http://127.0.0.1:${DAEMON_PORT}`;
const PROFILE = 'coding-agent';
const BANK_PREFIX = 'coding-agent::';
const DEFAULT_LLM_MODEL = 'deepseek-flash';

const QUICK_TIMEOUT_MS = 8000;
/** Recall reranks on CPU over the whole bank; measured ~10 s at 280 facts and it
 *  grows with the bank, so searches get their own generous budget. */
const SEARCH_TIMEOUT_MS = 120_000;
const BANK_CACHE_MS = 60_000;

const READY_POLL_MS = 2000;
const READY_TIMEOUT_MS = 6 * 60 * 1000;

const PLUGIN_DIR = dirname(fileURLToPath(import.meta.url));

// ── paths ─────────────────────────────────────────────────────────────────────

const dshHome = () => process.env.DSH_HOME ?? join(homedir(), '.dsh');
const stateDir = () => join(dshHome(), 'storages', PLUGIN);
const configFile = () => join(stateDir(), 'config.json');
const hindsightHome = () => join(homedir(), '.hindsight');
const hindsightConfigFile = () => join(hindsightHome(), 'coding-agent.json');
const daemonLogFile = () => join(hindsightHome(), 'profiles', `${PROFILE}.log`);

// ── tiny helpers ──────────────────────────────────────────────────────────────

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolvePromise, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 256 * 1024) {
        reject(new Error('request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolvePromise(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function fetchJson(url, init, timeoutMs = QUICK_TIMEOUT_MS) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  const text = await response.text();
  let body;
  try {
    body = text.length === 0 ? null : JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  if (!response.ok) {
    const detail = body?.detail ?? body?.error ?? response.statusText;
    const error = new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
    error.status = response.status;
    throw error;
  }
  return body;
}

function readTextFile(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

function fileSize(path) {
  try {
    return statSync(path).size;
  } catch {
    return 0;
  }
}

// ── plugin config ─────────────────────────────────────────────────────────────

const DEFAULT_CONFIG = { installDir: '', autoStart: true };

async function loadConfig() {
  try {
    const parsed = JSON.parse(await readFile(configFile(), 'utf8'));
    const installDir = typeof parsed.installDir === 'string' ? parsed.installDir.trim() : '';
    return { installDir, autoStart: parsed.autoStart !== false };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

async function saveConfig(patch) {
  const next = { ...(await loadConfig()), ...patch };
  await mkdir(stateDir(), { recursive: true });
  const tmp = `${configFile()}.tmp`;
  await writeFile(tmp, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  await rename(tmp, configFile());
  return next;
}

// ── credentials ───────────────────────────────────────────────────────────────

/**
 * Fact extraction needs an LLM. Order: the Harness credential service, then the
 * environment (both the Hindsight-specific name and the generic one), so a user
 * who configured either path is not asked twice.
 */
async function resolveApiKey(ctx) {
  try {
    const credentials = ctx.get('credentials');
    if (credentials !== undefined) {
      const hit = await credentials.resolve('DEEPSEEK_API_KEY');
      if (hit !== undefined && hit !== null) return typeof hit === 'string' ? hit : hit.value;
    }
  } catch {
    // fall through to the environment
  }
  return (
    process.env.HINDSIGHT_API_LLM_API_KEY?.trim() ||
    process.env.DEEPSEEK_API_KEY?.trim() ||
    undefined
  );
}

// ── memory bank resolution ────────────────────────────────────────────────────

/** The bank name the official integration would derive for a working directory. */
function derivedBank(cwd = process.cwd()) {
  try {
    const common = execFileSync('git', ['rev-parse', '--git-common-dir'], {
      cwd,
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 4000,
    }).trim();
    if (common) return `${BANK_PREFIX}${basename(resolve(cwd, common, '..'))}`;
  } catch {
    // not a git repo, or git unavailable
  }
  return `${BANK_PREFIX}${basename(cwd)}`;
}

const bankUrl = (bank, path) => `${DAEMON_BASE}/v1/default/banks/${encodeURIComponent(bank)}${path}`;

// ── daemon state ──────────────────────────────────────────────────────────────

/** Everything below is per-plugin-instance state, reset on reload. */
function createDaemon() {
  const state = {
    pid: null,
    starting: false,
    startedAt: 0,
    logOffset: 0,
    lastFailure: null,
    watchdog: false,
    monitor: null,
    lastEnv: null,
  };

  async function health() {
    try {
      return await fetchJson(`${DAEMON_BASE}/health`);
    } catch {
      return null;
    }
  }

  async function running() {
    return (await health()) !== null;
  }

  /** Explain a failed start using the daemon's own log, not a guess. */
  function failureFromLog() {
    const current = readTextFile(daemonLogFile());
    if (!current) return null;
    const fresh = current.slice(state.logOffset);
    if (fresh.trim() === '') return null;
    const bad = fresh
      .split(/\r?\n/)
      .filter((line) =>
        /(traceback|ValueError|RuntimeError|SystemError|Error:|error:|failed|not allowed|address already in use|No such file|cannot|拒绝)/i.test(
          line,
        ),
      );
    if (bad.length === 0) return null;
    // The final error line is the actionable one; the traceback above it is noise.
    return bad[bad.length - 1].trim().slice(0, 400);
  }

  function env(apiKey, config) {
    const next = {
      ...process.env,
      // Windows builds default to a legacy code page; the CLI decodes its own
      // child output as UTF-8, so a GBK console produces UnicodeDecodeError.
      PYTHONUTF8: '1',
      PYTHONIOENCODING: 'utf-8',
      HINDSIGHT_API_LLM_PROVIDER: process.env.HINDSIGHT_API_LLM_PROVIDER?.trim() || 'deepseek',
      HINDSIGHT_API_LLM_MODEL: process.env.HINDSIGHT_API_LLM_MODEL?.trim() || DEFAULT_LLM_MODEL,
      // Extraction is a structured task; reasoning chains only add latency.
      HINDSIGHT_API_LLM_REASONING_EFFORT: process.env.HINDSIGHT_API_LLM_REASONING_EFFORT?.trim() || 'none',
    };
    if (apiKey) next.HINDSIGHT_API_LLM_API_KEY = apiKey;
    if (config.installDir) {
      const cacheDir = join(config.installDir, 'uv-cache');
      const modelDir = join(config.installDir, 'hf-models');
      next.UV_CACHE_DIR = cacheDir;
      next.HF_HOME = modelDir;
      // Offline only when the relocated directories actually hold the payload.
      // Asserting it on a fresh, empty directory is what turns a slow download
      // into an unexplained failure.
      if (existsSync(join(cacheDir, 'archive-v0'))) {
        next.UV_OFFLINE = '1';
      }
      if (existsSync(join(modelDir, 'hub'))) {
        next.HF_HUB_OFFLINE = '1';
        next.TRANSFORMERS_OFFLINE = '1';
      }
    }
    return next;
  }

  function spawnWatchdog() {
    if (state.watchdog) return; // one watchdog per Harness process, never two
    const script = join(PLUGIN_DIR, 'lib', 'watchdog.mjs');
    if (!existsSync(script)) return;
    try {
      const child = spawn('node', [script, '--ppid', String(process.ppid), '--port', String(DAEMON_PORT)], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
        // Detached: the watchdog must outlive this process to notice it dying.
        env: process.env,
      });
      child.on('error', () => {});
      child.unref();
      state.watchdog = true;
    } catch {
      // A missing watchdog only costs a lingering daemon, never correctness.
    }
  }

  function hideWindows() {
    if (process.platform !== 'win32') return;
    const script = join(PLUGIN_DIR, 'lib', 'hide-window.ps1');
    if (!existsSync(script)) return;
    try {
      const child = spawn(
        'powershell',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script],
        { detached: true, stdio: 'ignore', windowsHide: true },
      );
      child.on('error', () => {});
      child.unref();
    } catch {
      // Cosmetic only.
    }
  }

  function stopTree() {
    if (state.pid) {
      try {
        execFileSync('taskkill', ['/PID', String(state.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      } catch {
        // already gone
      }
    }
    // The daemon detaches from the starter, so the port is the reliable handle.
    for (const pid of listeningPids(DAEMON_PORT)) {
      try {
        execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      } catch {
        // already gone
      }
    }
    state.pid = null;
    state.starting = false;
  }

  function ensureMonitor() {
    if (state.monitor) return;
    state.monitor = setInterval(async () => {
      if (!state.starting) return;
      if (await running()) {
        state.starting = false;
        state.lastFailure = null;
        return;
      }
      const failure = failureFromLog();
      const timedOut = Date.now() - state.startedAt > READY_TIMEOUT_MS;
      if (failure || timedOut) {
        stopTree();
        state.starting = false;
        state.lastFailure = {
          at: Date.now(),
          error: failure ?? `The daemon did not become healthy within ${Math.round(READY_TIMEOUT_MS / 1000)}s.`,
        };
      }
    }, READY_POLL_MS);
    if (typeof state.monitor.unref === 'function') state.monitor.unref();
  }

  /** Make sure ~/.hindsight/coding-agent.json points at a local daemon. */
  async function ensureHindsightConfig() {
    const path = hindsightConfigFile();
    let current = {};
    try {
      current = JSON.parse(readFileSync(path, 'utf8'));
    } catch {
      // first run
    }
    current.serverMode = 'daemon';
    delete current.disabled;
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(current, null, 2)}\n`, 'utf8');
  }

  async function start(ctx, config) {
    if (await running()) return { ok: true, status: 'running', already: true };

    const apiKey = await resolveApiKey(ctx);
    if (!apiKey) {
      return {
        ok: false,
        error:
          'Fact extraction needs an LLM key. Set HINDSIGHT_API_LLM_API_KEY (or DEEPSEEK_API_KEY) in your environment, or store DEEPSEEK_API_KEY in the Harness credentials.',
      };
    }

    await ensureHindsightConfig();

    state.logOffset = fileSize(daemonLogFile());
    // A local named `env` would shadow env() and throw "Cannot access 'env'
    // before initialization" — the same footgun as the old `health` local.
    const childEnv = env(apiKey, config);
    state.lastEnv = {
      provider: childEnv.HINDSIGHT_API_LLM_PROVIDER,
      model: childEnv.HINDSIGHT_API_LLM_MODEL,
      installDir: config.installDir || null,
      offline: childEnv.UV_OFFLINE === '1',
    };

    try {
      const child = spawn('uvx', ['hindsight-embed@latest', '-p', PROFILE, 'daemon', 'start'], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
        env: childEnv,
      });
      child.on('error', () => {});
      child.unref();
      state.pid = child.pid ?? null;
    } catch (error) {
      return { ok: false, error: `Could not run uvx: ${error?.message ?? String(error)}` };
    }

    state.starting = true;
    state.startedAt = Date.now();
    state.lastFailure = null;
    hideWindows();
    spawnWatchdog();
    ensureMonitor();
    return { ok: true, status: 'starting' };
  }

  async function stop() {
    stopTree();
    state.starting = false;
    state.lastFailure = null;
    return { ok: true, status: 'stopped' };
  }

  async function status() {
    // The local must not be named `health`: it would shadow the `health()`
    // function and throw "Cannot access 'health' before initialization".
    const probe = await health();
    if (probe) {
      state.starting = false;
      state.lastFailure = null;
      return { running: true, status: 'running', health: probe };
    }
    if (state.starting) return { running: false, status: 'starting' };
    if (state.lastFailure && Date.now() - state.lastFailure.at < 10 * 60 * 1000) {
      return { running: false, status: 'failed', error: state.lastFailure.error };
    }
    const failure = state.lastFailure === null ? failureFromLog() : null;
    if (failure) {
      state.lastFailure = { at: Date.now(), error: failure };
      return { running: false, status: 'failed', error: failure };
    }
    return { running: false, status: 'stopped' };
  }

  return { start, stop, status, running, stopTree, envInfo: () => state.lastEnv, state };
}

/** PIDs listening on a TCP port (Windows `netstat`; the daemon only runs here). */
function listeningPids(port) {
  try {
    const out = execFileSync('netstat', ['-ano'], { encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
    const portRe = new RegExp(`:${port}(?=\\s|$)`, 'i');
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      if (!portRe.test(line) || !/LISTENING/i.test(line)) continue;
      const pid = line.trim().split(/\s+/).pop();
      if (pid && /^\d+$/.test(pid)) pids.add(pid);
    }
    return [...pids];
  } catch {
    return [];
  }
}

// ── plugin entry ──────────────────────────────────────────────────────────────

export function apply(ctx) {
  const daemon = createDaemon();
  let bankCache = { name: null, at: 0 };

  async function resolveBank({ force = false } = {}) {
    if (!force && bankCache.name && Date.now() - bankCache.at < BANK_CACHE_MS) return bankCache.name;
    let name = null;
    try {
      const list = await fetchJson(`${DAEMON_BASE}/v1/default/banks?limit=200`);
      const banks = (list?.banks ?? []).filter(
        (entry) => typeof entry?.bank_id === 'string' && entry.bank_id.startsWith(BANK_PREFIX),
      );
      if (banks.length === 1) name = banks[0].bank_id;
      else if (banks.length > 1) {
        const wanted = derivedBank();
        name = banks.some((entry) => entry.bank_id === wanted)
          ? wanted
          : [...banks].sort((left, right) =>
              String(right.last_write_at ?? '').localeCompare(String(left.last_write_at ?? '')),
            )[0].bank_id;
      }
    } catch {
      // daemon down
    }
    name = name ?? derivedBank();
    bankCache = { name, at: Date.now() };
    return name;
  }

  async function overview() {
    const [status, config] = await Promise.all([daemon.status(), loadConfig()]);
    const bank = await resolveBank({ force: status.running && bankCache.name === null });
    const out = {
      ok: true,
      ...status,
      daemonPort: DAEMON_PORT,
      bank,
      config,
      apiVersion: null,
      stats: null,
      env: daemon.envInfo(),
    };
    if (status.running) {
      try {
        out.stats = await fetchJson(bankUrl(bank, '/stats'));
      } catch (error) {
        if (error?.status === 404) {
          out.bank = await resolveBank({ force: true });
          out.stats = await fetchJson(bankUrl(out.bank, '/stats')).catch((again) => {
            out.error = again.message;
            return null;
          });
        } else {
          out.error = error.message;
        }
      }
      try {
        out.apiVersion = (await fetchJson(`${DAEMON_BASE}/version`)).api_version ?? null;
      } catch {
        out.apiVersion = null;
      }
    }
    return out;
  }

  ctx.inject(['webServer'], (scoped) => {
    const server = scoped.get('webServer');

    const routes = {
      '/hindsight-manager/api/overview': async (_req, res) => {
        try {
          json(res, 200, await overview());
        } catch (error) {
          json(res, 500, { ok: false, error: error?.message ?? String(error) });
        }
      },

      '/hindsight-manager/api/daemon': async (req, res) => {
        try {
          const raw = await readBody(req);
          const body = raw.length === 0 ? {} : JSON.parse(raw);
          const config = await loadConfig();
          if (body.action === 'start') {
            const result = await daemon.start(ctx, config);
            json(res, result.ok ? 200 : 500, result);
            return;
          }
          if (body.action === 'stop') {
            json(res, 200, await daemon.stop());
            return;
          }
          json(res, 400, { ok: false, error: 'action must be "start" or "stop"' });
        } catch (error) {
          json(res, 500, { ok: false, error: error?.message ?? String(error) });
        }
      },

      '/hindsight-manager/api/documents': async (req, res) => {
        try {
          const url = new URL(req.url ?? '/', 'http://127.0.0.1');
          const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 20) || 20, 1), 100);
          const bank = await resolveBank();
          const body = await fetchJson(bankUrl(bank, `/documents?limit=${limit}`));
          json(res, 200, { ok: true, bank, ...body });
        } catch (error) {
          json(res, error?.status === 404 ? 404 : 500, { ok: false, error: error?.message ?? String(error) });
        }
      },

      '/hindsight-manager/api/search': async (req, res) => {
        try {
          const raw = await readBody(req);
          const body = raw.length === 0 ? {} : JSON.parse(raw);
          const query = typeof body.query === 'string' ? body.query.trim() : '';
          if (query === '') {
            json(res, 400, { ok: false, error: 'query must not be empty' });
            return;
          }
          const budget = ['low', 'mid', 'high'].includes(body.budget) ? body.budget : 'low';
          const bank = await resolveBank();
          const result = await fetchJson(
            bankUrl(bank, '/memories/recall'),
            {
              method: 'POST',
              headers: { 'content-type': 'application/json; charset=utf-8' },
              body: JSON.stringify({ query, budget }),
            },
            SEARCH_TIMEOUT_MS,
          );
          json(res, 200, { ok: true, bank, results: result.results ?? [] });
        } catch (error) {
          json(res, 500, { ok: false, error: error?.message ?? String(error) });
        }
      },

      '/hindsight-manager/api/config': async (req, res) => {
        try {
          if (req.method === 'GET') {
            json(res, 200, { ok: true, ...(await loadConfig()) });
            return;
          }
          const raw = await readBody(req);
          const body = raw.length === 0 ? {} : JSON.parse(raw);
          const patch = {};
          for (const [key, value] of Object.entries(body)) {
            if (key === 'installDir') {
              if (typeof value !== 'string') {
                json(res, 400, { ok: false, error: 'installDir must be a string' });
                return;
              }
              patch.installDir = value.trim();
            } else if (key === 'autoStart') {
              if (typeof value !== 'boolean') {
                json(res, 400, { ok: false, error: 'autoStart must be a boolean' });
                return;
              }
              patch.autoStart = value;
            } else {
              json(res, 400, { ok: false, error: `unknown config field: ${key}` });
              return;
            }
          }
          json(res, 200, { ok: true, ...(await saveConfig(patch)) });
        } catch (error) {
          json(res, 400, { ok: false, error: error?.message ?? String(error) });
        }
      },
    };

    for (const [path, handler] of Object.entries(routes)) {
      scoped.effect(() => server.register({ kind: 'exact', path, handler }), `${PLUGIN}: ${path}`);
    }
  });

  // Stop the daemon on shutdown. The watchdog covers a hard kill; this covers a
  // graceful one without waiting for the watchdog's 2 s poll.
  const onExit = () => {
    try {
      daemon.stopTree();
    } catch {
      // best effort
    }
  };
  process.on('exit', onExit);
  process.on('SIGTERM', onExit);
  process.on('SIGINT', onExit);

  // Auto-start on Harness launch, retrying briefly: the credential service can
  // become available after this plugin loads.
  void loadConfig().then((config) => {
    if (!config.autoStart) return;
    const attempt = (n) => {
      daemon.start(ctx, config).then((result) => {
        if (result.ok) {
          ctx.logger?.info?.(`${PLUGIN}: daemon ${result.already ? 'already running' : 'starting'}`);
          return;
        }
        ctx.logger?.warn?.(`${PLUGIN}: daemon start failed (attempt ${n + 1}): ${result.error}`);
        if (n < 4) setTimeout(() => attempt(n + 1), 5000);
      }).catch((error) => {
        ctx.logger?.warn?.(`${PLUGIN}: daemon start threw: ${error?.message ?? String(error)}`);
        if (n < 4) setTimeout(() => attempt(n + 1), 5000);
      });
    };
    attempt(0);
  });

  ctx.logger?.info?.(`${PLUGIN}: host half active (daemon ${DAEMON_BASE})`);
}
