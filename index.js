/**
 * dsh-hindsight-manager — Host half.
 *
 * Owns a local Hindsight memory daemon's whole lifecycle and serves the panel
 * API. It is deliberately self-contained: it spawns `hindsight-embed` itself
 * instead of driving another plugin's launcher, so nothing breaks when that
 * plugin is upgraded, renamed, or removed.
 *
 * Responsibilities
 *   - guided setup: check/install the memory integration, store the LLM key,
 *     pin the daemon port, choose the cache directory
 *   - start / stop the daemon, with the LLM and cache environment it needs
 *   - retry a failed start (network/proxy hiccups) instead of giving up
 *   - one watchdog that stops the daemon when this Harness process exits
 *   - read the daemon's own log to explain a failed start instead of hanging
 *   - /hindsight-manager/api/* for the panel
 */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import net from 'node:net';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const name = 'hindsight-manager';

const PLUGIN = 'dsh-hindsight-manager';
/** Daemon port. `hindsight-embed`'s own default profile port; pinned into the
 *  profile env so the manager and the memory integration agree on it. */
const DEFAULT_DAEMON_PORT = 9077;
const PROFILE = 'coding-agent';
const BANK_PREFIX = 'coding-agent::';
const DEFAULT_LLM_MODEL = 'deepseek-flash';
const INTEGRATION_PACKAGE = '@vectorize-io/hindsight-coding-agents';

const QUICK_TIMEOUT_MS = 8000;
/** Recall reranks on CPU over the whole bank; measured ~10 s at 280 facts and it
 *  grows with the bank, so searches get their own generous budget. */
const SEARCH_TIMEOUT_MS = 120_000;
/** The entity graph is cheap for a small bank but the daemon aggregates every
 *  entity link; a big bank needs more than the 8 s quick budget. */
const GRAPH_TIMEOUT_MS = 25_000;
const GRAPH_CACHE_MS = 5000;
const BANK_CACHE_MS = 60_000;

const READY_POLL_MS = 2000;
const READY_TIMEOUT_MS = 6 * 60 * 1000;
/** Backoff for restarting a daemon whose start failed transiently (network,
 *  proxy, another process still holding the port). */
const RETRY_DELAYS_MS = [5000, 15000, 30000, 60000, 120000, 300000];

const PLUGIN_DIR = dirname(fileURLToPath(import.meta.url));

// ── paths ─────────────────────────────────────────────────────────────────────

const dshHome = () => process.env.DSH_HOME ?? join(homedir(), '.dsh');
const profileName = () => (process.env.DSH_PROFILE ?? 'desktop').trim() || 'desktop';
const profileDir = () => join(dshHome(), 'profiles', profileName());
const stateDir = () => join(dshHome(), 'storages', PLUGIN);
const configFile = () => join(stateDir(), 'config.json');
const hindsightHome = () => join(homedir(), '.hindsight');
const hindsightConfigFile = () => join(hindsightHome(), 'coding-agent.json');
const daemonLogFile = () => join(hindsightHome(), 'profiles', `${PROFILE}.log`);
const profileEnvFile = () => join(hindsightHome(), 'profiles', `${PROFILE}.env`);

let daemonPort = DEFAULT_DAEMON_PORT;
const daemonBase = () => `http://127.0.0.1:${daemonPort}`;

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

function readJsonFile(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
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

/** Parse a dotenv file into a plain object; comments and `export ` are accepted. */
function readEnvFile(path) {
  const text = readTextFile(path);
  const out = {};
  if (!text) return out;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (match === null) continue;
    let value = match[2].trim();
    if (
      value.length >= 2 &&
      (value[0] === '"' || value[0] === "'") &&
      value[value.length - 1] === value[0]
    ) {
      value = value.slice(1, -1);
    }
    out[match[1]] = value;
  }
  return out;
}

/** Merge `patch` into a dotenv file, keeping comments and every other line. */
function writeEnvFile(path, patch) {
  const existing = (readTextFile(path) ?? '').split(/\r?\n/);
  const keys = new Set(Object.keys(patch));
  const seen = new Set();
  const lines = existing.map((line) => {
    const match = /^(\s*(?:export\s+)?)([A-Za-z_][A-Za-z0-9_]*)(\s*=\s*)(.*)$/.exec(line);
    if (match === null || !keys.has(match[2])) return line;
    seen.add(match[2]);
    return `${match[1]}${match[2]}=${patch[match[2]]}`;
  });
  for (const key of keys) {
    if (!seen.has(key)) lines.push(`${key}=${patch[key]}`);
  }
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${lines.join('\n')}\n`, 'utf8');
}

// ── daemon port ───────────────────────────────────────────────────────────────

/** Read the profile's pinned port, falling back to the default. */
function refreshDaemonPort() {
  const pinned = Number(readEnvFile(profileEnvFile()).HINDSIGHT_API_PORT);
  daemonPort = Number.isInteger(pinned) && pinned > 0 ? pinned : DEFAULT_DAEMON_PORT;
  return daemonPort;
}

/**
 * Pin the port into the profile env. `hindsight-embed` 1.x otherwise allocates a
 * free port on every start, which the manager (and the memory integration) would
 * never find again.
 */
function pinDaemonPort() {
  const env = readEnvFile(profileEnvFile());
  if (env.HINDSIGHT_API_PORT === undefined) {
    writeEnvFile(profileEnvFile(), { HINDSIGHT_API_PORT: String(DEFAULT_DAEMON_PORT) });
  }
  return refreshDaemonPort();
}

// ── plugin config ─────────────────────────────────────────────────────────────

const DEFAULT_CONFIG = {
  installDir: '',
  autoStart: true,
  showFooterStatus: true,
  showSidebarEntry: true,
  /** '' means "derive it"; anything else is an explicit bank to READ (writes
   *  still follow the session's own workspace). */
  bank: '',
};

async function loadConfig() {
  try {
    const parsed = JSON.parse(await readFile(configFile(), 'utf8'));
    const installDir = typeof parsed.installDir === 'string' ? parsed.installDir.trim() : '';
    return {
      installDir,
      autoStart: parsed.autoStart !== false,
      showFooterStatus: parsed.showFooterStatus !== false,
      showSidebarEntry: parsed.showSidebarEntry !== false,
      bank: typeof parsed.bank === 'string' ? parsed.bank.trim() : '',
    };
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

// ── network / proxy ───────────────────────────────────────────────────────────

/**
 * The WinINET proxy, when one is configured. Python's urllib and httpx read it
 * through the registry (unlike curl), so a stale proxy breaks the daemon even
 * while the rest of the machine reaches the API.
 */
function systemProxyServer() {
  if (process.platform !== 'win32') return null;
  try {
    const out = execFileSync(
      'reg',
      [
        'query',
        'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings',
        '/v',
        'ProxyServer',
      ],
      { encoding: 'utf8', windowsHide: true, timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] },
    );
    const match = /ProxyServer\s+REG_SZ\s+(.+)/i.exec(out);
    return match === null ? null : match[1].trim();
  } catch {
    return null;
  }
}

function proxyReachable(server) {
  return new Promise((resolvePromise) => {
    const first = String(server).split(';')[0].trim().replace(/^https?:\/\//i, '');
    const split = first.lastIndexOf(':');
    if (split <= 0) return resolvePromise(true);
    const host = first.slice(0, split);
    const port = Number(first.slice(split + 1));
    if (!Number.isInteger(port) || port <= 0) return resolvePromise(true);
    const socket = net.connect({ host, port });
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolvePromise(ok);
    };
    socket.setTimeout(800);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

/** Whether the daemon must bypass the system proxy to reach anything. */
async function networkState() {
  const proxy = systemProxyServer();
  const reachable = proxy === null ? null : await proxyReachable(proxy);
  return {
    systemProxy: proxy,
    proxyReachable: reachable,
    bypassProxy: proxy !== null && reachable === false,
  };
}

// ── credentials ───────────────────────────────────────────────────────────────

/**
 * Fact extraction needs an LLM. Order: the key saved through this panel, the
 * Harness credential service, then the environment (both the Hindsight-specific
 * name and the generic one), so a user who configured either path is not asked
 * twice.
 */
async function resolveApiKey(ctx) {
  const fromProfile = readEnvFile(profileEnvFile()).HINDSIGHT_API_LLM_API_KEY?.trim();
  if (fromProfile) return fromProfile;
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

async function apiKeyStatus(ctx) {
  if (readEnvFile(profileEnvFile()).HINDSIGHT_API_LLM_API_KEY?.trim()) {
    return { configured: true, source: 'panel' };
  }
  try {
    const credentials = ctx.get('credentials');
    const hit = await credentials?.resolve?.('DEEPSEEK_API_KEY');
    if (hit !== undefined && hit !== null) return { configured: true, source: 'harness' };
  } catch {
    // ignore
  }
  if (process.env.HINDSIGHT_API_LLM_API_KEY?.trim() || process.env.DEEPSEEK_API_KEY?.trim()) {
    return { configured: true, source: 'environment' };
  }
  return { configured: false, source: null };
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

const bankUrl = (bank, path) => `${daemonBase()}/v1/default/banks/${encodeURIComponent(bank)}${path}`;

// ── integration / setup ───────────────────────────────────────────────────────

function integrationStatus() {
  const pkg = readJsonFile(join(profileDir(), 'package.json'));
  const declared = pkg?.dependencies?.[INTEGRATION_PACKAGE] ?? null;
  const bundles = Array.isArray(pkg?.dsh?.profile?.bundles) ? pkg.dsh.profile.bundles : [];
  const version =
    readJsonFile(join(profileDir(), 'node_modules', INTEGRATION_PACKAGE, 'package.json'))?.version ??
    (typeof declared === 'string' ? declared : null);
  return {
    package: INTEGRATION_PACKAGE,
    installed: typeof declared === 'string',
    enabled: bundles.includes(INTEGRATION_PACKAGE),
    version,
  };
}

function modelsStatus() {
  const hub = join(hindsightHome(), 'hf-models', 'hub');
  const has = (name) => existsSync(join(hub, name));
  return {
    dir: hub,
    embeddings: has('models--BAAI--bge-small-en-v1.5'),
    reranker: has('models--cross-encoder--ms-marco-MiniLM-L-6-v2'),
  };
}

/** Where the bundled `dsh` CLI lives for the Desktop installation. */
function desktopCli() {
  if (process.platform === 'win32') {
    const js = join(
      dirname(process.execPath),
      'resources',
      'app.asar',
      'dsh',
      'node_modules',
      '@deepseek-ai',
      'dsh-desktop-host',
      'lib',
      'cli.js',
    );
    if (existsSync(js)) {
      return {
        command: process.execPath,
        args: ['--expose-internals', js],
        env: { ELECTRON_RUN_AS_NODE: '1' },
      };
    }
  }
  return { command: 'dsh', args: [], env: {} };
}

const installState = {
  running: false,
  startedAt: 0,
  ok: null,
  output: '',
  error: null,
};

/**
 * Install the memory integration into this profile in the background. A full
 * profile recomposition may follow, so the caller must not wait for it.
 */
function startIntegrationInstall() {
  if (installState.running) return { ok: true, started: true, already: true };
  const cli = desktopCli();
  const args = [...cli.args, 'plugin', '--profile', profileName(), 'add', INTEGRATION_PACKAGE];
  installState.running = true;
  installState.startedAt = Date.now();
  installState.ok = null;
  installState.output = '';
  installState.error = null;
  try {
    const child = spawn(cli.command, args, {
      windowsHide: true,
      env: { ...process.env, ...cli.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const append = (chunk) => {
      installState.output = `${installState.output}${chunk}`.slice(-8000);
    };
    child.stdout?.on('data', append);
    child.stderr?.on('data', append);
    child.on('error', (error) => {
      installState.running = false;
      installState.ok = false;
      installState.error = error?.message ?? String(error);
    });
    child.on('exit', (code) => {
      installState.running = false;
      installState.ok = code === 0;
      if (code !== 0) installState.error = `exit code ${code}`;
    });
  } catch (error) {
    installState.running = false;
    installState.ok = false;
    installState.error = error?.message ?? String(error);
  }
  return { ok: true, started: true };
}

// ── daemon state ──────────────────────────────────────────────────────────────

/** Everything below is per-plugin-instance state, reset on reload. */
function createDaemon() {
  const state = {
    pid: null,
    starting: false,
    startedAt: 0,
    logOffset: 0,
    lastFailure: null,
    lastNetwork: null,
    watchdog: false,
    monitor: null,
    supervisor: null,
    lastEnv: null,
    wantRunning: false,
    everUp: false,
    attempt: 0,
    retryAt: 0,
    retryTimer: null,
    ctx: null,
    config: null,
  };

  async function health() {
    try {
      return await fetchJson(`${daemonBase()}/health`, undefined, 3000);
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
      .map((line) => line.trim())
      .filter(
        (line) =>
          /^\s*Traceback/.test(line) ||
          /\s-\s(ERROR|CRITICAL)\s-\s/.test(line) ||
          /Application startup failed/i.test(line) ||
          /LLM API key is required/i.test(line) ||
          /address already in use/i.test(line) ||
          /did not complete within \d+s/i.test(line),
      );
    if (bad.length === 0) return null;
    // The final error line is the actionable one; the traceback above it is noise.
    return bad[bad.length - 1].slice(0, 400);
  }

  /** Did this start's log ever reach a serving state (covers a fast kill)? */
  function logSaysUp() {
    const current = readTextFile(daemonLogFile());
    if (!current) return false;
    return /Application startup complete|Uvicorn running on/i.test(current.slice(state.logOffset));
  }

  function env(apiKey, config, bypassProxy) {
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
    if (bypassProxy) {
      // A configured-but-dead system proxy makes Python refuse every request.
      // Direct is then the only working path for the daemon.
      next.NO_PROXY = '*';
      next.no_proxy = '*';
    }
    if (config.installDir) {
      const cacheDir = join(config.installDir, 'uv-cache');
      const modelDir = join(config.installDir, 'hf-models');
      next.UV_CACHE_DIR = cacheDir;
      next.HF_HOME = modelDir;
      // Offline only when the relocated directories actually hold the payload.
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
      // Run it through the Electron binary in Node mode: a GUI executable, so
      // no console window ever appears (plain `node.exe` is a console app).
      const electron = basename(process.execPath).toLowerCase().includes('deepseek');
      const args = [script, '--ppid', String(process.ppid), '--port', String(daemonPort)];
      if (electron) args.unshift('--expose-internals');
      const child = spawn(process.execPath, args, {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
        env: electron ? { ...process.env, ELECTRON_RUN_AS_NODE: '1' } : process.env,
      });
      child.on('error', () => {});
      child.unref();
      state.watchdog = true;
    } catch {
      // A missing watchdog only costs a lingering daemon, never correctness.
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
    for (const pid of listeningPids(daemonPort)) {
      try {
        execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      } catch {
        // already gone
      }
    }
    state.pid = null;
    state.starting = false;
  }

  function clearRetry() {
    if (state.retryTimer) {
      clearTimeout(state.retryTimer);
      state.retryTimer = null;
    }
    state.retryAt = 0;
  }

  function transientError(error) {
    return /connection error|connecterror|refused|winerror|10060|10061|timed out|timeout|unreachable|network|econn|enotfound|proxy|address already in use|eaddrinuse/i.test(
      String(error ?? ''),
    );
  }

  /** Restart a failed start when the failure looks like a passing network issue. */
  function scheduleRetry() {
    if (!state.wantRunning || state.ctx === null) return;
    if (!transientError(state.lastFailure?.error)) return;
    if (state.attempt > RETRY_DELAYS_MS.length) return;
    const delay = RETRY_DELAYS_MS[Math.min(state.attempt - 1, RETRY_DELAYS_MS.length - 1)];
    clearRetry();
    state.retryAt = Date.now() + delay;
    state.retryTimer = setTimeout(() => {
      state.retryTimer = null;
      state.retryAt = 0;
      if (!state.wantRunning || state.ctx === null) return;
      void start(state.ctx, state.config);
    }, delay);
    if (typeof state.retryTimer.unref === 'function') state.retryTimer.unref();
  }

  function fail(error) {
    state.starting = false;
    state.lastFailure = { at: Date.now(), error: error.slice(0, 400) };
    scheduleRetry();
  }

  function ensureMonitor() {
    if (state.monitor) return;
    state.monitor = setInterval(async () => {
      if (!state.starting) return;
      if (await running()) {
        state.starting = false;
        state.lastFailure = null;
        state.attempt = 0;
        state.everUp = true;
        clearRetry();
        return;
      }
      const failure = failureFromLog();
      const timedOut = Date.now() - state.startedAt > READY_TIMEOUT_MS;
      if (failure || timedOut) {
        stopTree();
        fail(failure ?? `The daemon did not become healthy within ${Math.round(READY_TIMEOUT_MS / 1000)}s.`);
      }
    }, READY_POLL_MS);
    if (typeof state.monitor.unref === 'function') state.monitor.unref();
  }

  /**
   * A daemon that died while nobody was looking would otherwise sit at
   * "stopped" until the user notices. While the profile wants it running,
   * check its health and bring it back when it vanished.
   */
  function ensureSupervisor() {
    if (state.supervisor) return;
    state.supervisor = setInterval(async () => {
      if (!state.wantRunning || state.starting || state.retryAt > 0 || state.ctx === null) return;
      // A failure before the daemon ever came up is a setup problem, not a
      // vanished daemon; only transient ones deserve another automatic try.
      if (state.lastFailure && !state.everUp && !transientError(state.lastFailure.error)) return;
      if (await running()) return;
      state.ctx.logger?.info?.(`${PLUGIN}: supervisor is restarting a daemon that vanished`);
      state.attempt = state.attempt > 0 ? state.attempt : 1;
      void start(state.ctx, state.config);
    }, 15000);
    if (typeof state.supervisor.unref === 'function') state.supervisor.unref();
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
    state.ctx = ctx;
    state.config = config;
    state.wantRunning = true;
    pinDaemonPort();
    if (await running()) {
      state.attempt = 0;
      clearRetry();
      return { ok: true, status: 'running', already: true };
    }

    const apiKey = await resolveApiKey(ctx);
    if (!apiKey) {
      state.wantRunning = false;
      return {
        ok: false,
        status: 'setup-required',
        code: 'missing-key',
        error:
          '还需要一个模型 API 密钥：在「快速开始」第 2 步填写，或在 Harness 凭据里保存 DEEPSEEK_API_KEY。',
      };
    }

    await ensureHindsightConfig();

    const network = await networkState();
    state.lastNetwork = network;
    state.logOffset = fileSize(daemonLogFile());
    // A local named `env` would shadow env() and throw "Cannot access 'env'
    // before initialization" — the same footgun as the old `health` local.
    const childEnv = env(apiKey, config, network.bypassProxy);
    state.lastEnv = {
      provider: childEnv.HINDSIGHT_API_LLM_PROVIDER,
      model: childEnv.HINDSIGHT_API_LLM_MODEL,
      installDir: config.installDir || null,
      offline: childEnv.UV_OFFLINE === '1',
      proxyBypassed: network.bypassProxy,
    };

    clearRetry();
    state.attempt += 1;
    let child;
    try {
      // Not detached: a console app started with windowsHide and without
      // DETACHED_PROCESS gets a hidden console that its own children inherit,
      // so the Python daemon never opens a visible window.
      child = spawn('uvx', ['hindsight-embed@latest', '-p', PROFILE, 'daemon', 'start'], {
        detached: false,
        stdio: 'ignore',
        windowsHide: true,
        env: childEnv,
      });
    } catch (error) {
      state.wantRunning = false;
      return { ok: false, error: `Could not run uvx: ${error?.message ?? String(error)}` };
    }

    child.on('error', (error) => {
      if (!state.starting) return;
      state.starting = false;
      fail(`Could not run uvx: ${error?.message ?? String(error)}`);
    });
    child.on('exit', (code) => {
      if (code === 0 || !state.starting) return;
      // Give the log a moment to flush the real error before deciding.
      setTimeout(async () => {
        if (!state.starting) return;
        if (await running()) {
          // The launcher exited but the daemon it started is serving: not a failure.
          state.starting = false;
          return;
        }
        stopTree();
        if (state.everUp || logSaysUp()) {
          // It had been healthy and then vanished: the supervisor will bring it back.
          state.starting = false;
          state.lastFailure = null;
          return;
        }
        const failure = failureFromLog() ?? `The daemon exited during startup (exit code ${code}).`;
        fail(failure);
      }, 1500);
    });
    child.unref();
    state.pid = child.pid ?? null;

    state.starting = true;
    state.everUp = false;
    state.startedAt = Date.now();
    state.lastFailure = null;
    spawnWatchdog();
    ensureMonitor();
    return { ok: true, status: 'starting' };
  }

  async function stop() {
    state.wantRunning = false;
    clearRetry();
    stopTree();
    state.starting = false;
    state.everUp = false;
    state.lastFailure = null;
    state.attempt = 0;
    return { ok: true, status: 'stopped' };
  }

  async function status() {
    // The local must not be named `health`: it would shadow the `health()`
    // function and throw "Cannot access 'health' before initialization".
    const probe = await health();
    if (probe) {
      state.starting = false;
      state.lastFailure = null;
      state.attempt = 0;
      state.everUp = true;
      clearRetry();
      return { running: true, status: 'running', health: probe };
    }
    if (state.starting) {
      return { running: false, status: 'starting', attempt: state.attempt, retryAt: 0 };
    }
    if (state.retryAt) {
      return {
        running: false,
        status: 'retrying',
        error: state.lastFailure?.error ?? null,
        attempt: state.attempt,
        retryAt: state.retryAt,
      };
    }
    if (state.lastFailure && Date.now() - state.lastFailure.at < 10 * 60 * 1000) {
      return { running: false, status: 'failed', error: state.lastFailure.error, attempt: state.attempt, retryAt: 0 };
    }
    const failure = state.lastFailure === null ? failureFromLog() : null;
    if (failure) {
      state.lastFailure = { at: Date.now(), error: failure };
      return { running: false, status: 'failed', error: failure, attempt: state.attempt, retryAt: 0 };
    }
    return { running: false, status: 'stopped', attempt: state.attempt, retryAt: 0 };
  }

  return {
    start,
    stop,
    status,
    running,
    stopTree,
    ensureSupervisor,
    envInfo: () => state.lastEnv,
    networkInfo: () => state.lastNetwork,
    state,
  };
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

  refreshDaemonPort();
  daemon.ensureSupervisor();

  async function resolveBank({ force = false } = {}) {
    const config = await loadConfig();
    if (config.bank !== '') {
      bankCache = { name: config.bank, at: Date.now(), forced: true };
      return config.bank;
    }
    if (!force && bankCache.name && bankCache.forced !== true && Date.now() - bankCache.at < BANK_CACHE_MS) {
      return bankCache.name;
    }
    let name = null;
    try {
      const list = await fetchJson(`${daemonBase()}/v1/default/banks?limit=200`);
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
    bankCache = { name, at: Date.now(), forced: false };
    return name;
  }

  /** The banks this plugin may read, newest write first. */
  async function listBanks() {
    const list = await fetchJson(`${daemonBase()}/v1/default/banks?limit=200`, undefined, QUICK_TIMEOUT_MS);
    return (list?.banks ?? [])
      .filter((entry) => typeof entry?.bank_id === 'string' && entry.bank_id.startsWith(BANK_PREFIX))
      .map((entry) => ({
        id: entry.bank_id,
        facts: Number(entry.fact_count ?? 0),
        lastWriteAt: entry.last_write_at ?? entry.last_document_at ?? null,
      }))
      .sort((left, right) => String(right.lastWriteAt ?? '').localeCompare(String(left.lastWriteAt ?? '')));
  }

  async function overview() {
    const [status, config] = await Promise.all([daemon.status(), loadConfig()]);
    const bank = await resolveBank({ force: status.running && bankCache.name === null });
    const out = {
      ok: true,
      ...status,
      daemonPort,
      bank,
      bankExists: null,
      config,
      apiVersion: null,
      stats: null,
      env: daemon.envInfo(),
      network: daemon.networkInfo(),
    };
    if (status.running) {
      try {
        out.stats = await fetchJson(bankUrl(bank, '/stats'));
        out.bankExists = true;
      } catch (error) {
        if (error?.status === 404) {
          // A cached fallback name can lag the first bank by one poll; resolve
          // again now that the daemon is up before concluding there is none.
          out.bank = await resolveBank({ force: true });
          try {
            out.stats = await fetchJson(bankUrl(out.bank, '/stats'));
            out.bankExists = true;
          } catch {
            // No bank yet: a fresh install creates it on the first memory write.
            out.bankExists = false;
          }
        } else {
          out.error = error.message;
        }
      }
      try {
        out.apiVersion = (await fetchJson(`${daemonBase()}/version`)).api_version ?? null;
      } catch {
        out.apiVersion = null;
      }
    }
    return out;
  }

  let graphCache = { bank: null, at: 0, data: null };

  const pairKey = (left, right) => (left < right ? `${left}|${right}` : `${right}|${left}`);
  const laterIso = (left, right) => {
    if (!left) return right ?? null;
    if (!right) return left;
    return Date.parse(left) >= Date.parse(right) ? left : right;
  };

  /**
   * Memories that carry entity names are the only source for "when did these two
   * entities first appear together". Paged, capped: the animation does not need
   * more than the first thousand memories.
   */
  async function timelineMemories(bank) {
    const out = [];
    const pageSize = 200;
    for (let page = 0; page < 6; page += 1) {
      let body;
      try {
        body = await fetchJson(
          bankUrl(bank, `/memories/list?limit=${pageSize}&offset=${out.length}`),
          undefined,
          GRAPH_TIMEOUT_MS,
        );
      } catch {
        break;
      }
      const items = Array.isArray(body.items) ? body.items : [];
      out.push(...items);
      const total = Number(body.total ?? out.length);
      if (items.length === 0 || out.length >= total || out.length >= 1000) break;
    }
    return out;
  }

  /**
   * The entity co-occurrence graph, flattened for the browser. Hindsight returns
   * react-force-graph shaped `{nodes:[{data}], edges:[{data}]}`; the panel only
   * needs ids, labels, mention counts, weights and first-seen timestamps.
   */
  async function entityGraph() {
    const bank = await resolveBank();
    if (graphCache.data && graphCache.bank === bank && Date.now() - graphCache.at < GRAPH_CACHE_MS) {
      return graphCache.data;
    }
    const [body, entityList, memories] = await Promise.all([
      fetchJson(bankUrl(bank, '/entities/graph?limit=1000'), undefined, GRAPH_TIMEOUT_MS),
      fetchJson(bankUrl(bank, '/entities?limit=1000'), undefined, GRAPH_TIMEOUT_MS).catch(() => null),
      timelineMemories(bank),
    ]);

    const entityById = new Map();
    const idByName = new Map();
    for (const item of entityList?.items ?? []) {
      entityById.set(String(item.id), item);
      idByName.set(String(item.canonical_name ?? '').trim().toLowerCase(), String(item.id));
    }

    const nodeFirst = new Map();
    for (const [id, item] of entityById) nodeFirst.set(id, item.first_seen ?? null);

    const edges = (body.edges ?? [])
      .map((edge) => ({
        source: String(edge?.data?.source ?? ''),
        target: String(edge?.data?.target ?? ''),
        weight: Number(edge?.data?.weight ?? 1),
        lastCooccurred: edge?.data?.lastCooccurred ?? null,
      }))
      .filter((edge) => edge.source !== '' && edge.target !== '');

    // First co-occurrence per pair, from the memories that name entities.
    const pairFirst = new Map();
    for (const memory of memories) {
      const names = String(memory?.entities ?? '')
        .split(',')
        .map((name) => name.trim().toLowerCase())
        .filter(Boolean);
      if (names.length < 2) continue;
      const ids = [...new Set(names.map((name) => idByName.get(name)).filter(Boolean))];
      if (ids.length < 2) continue;
      const when = memory?.date ?? memory?.mentioned_at ?? null;
      if (!when) continue;
      for (let left = 0; left < ids.length; left += 1) {
        for (let right = left + 1; right < ids.length; right += 1) {
          const key = pairKey(ids[left], ids[right]);
          const previous = pairFirst.get(key);
          if (!previous || Date.parse(when) < Date.parse(previous)) pairFirst.set(key, when);
        }
      }
    }

    const nodes = (body.nodes ?? [])
      .map((node) => ({
        id: String(node?.data?.id ?? ''),
        label: String(node?.data?.label ?? ''),
        mentions: Number(node?.data?.mentionCount ?? 0),
        firstSeen: nodeFirst.get(String(node?.data?.id ?? '')) ?? null,
        lastSeen: entityById.get(String(node?.data?.id ?? ''))?.last_seen ?? null,
      }))
      .filter((node) => node.id !== '');

    for (const edge of edges) {
      const fallback = laterIso(nodeFirst.get(edge.source) ?? null, nodeFirst.get(edge.target) ?? null);
      edge.firstSeen = pairFirst.get(pairKey(edge.source, edge.target)) ?? fallback;
    }

    const born = [
      ...nodes.map((node) => node.firstSeen),
      ...edges.map((edge) => edge.firstSeen),
    ].filter(Boolean).sort();
    const seen = [
      ...nodes.map((node) => node.lastSeen),
      ...edges.map((edge) => edge.lastCooccurred),
    ].filter(Boolean).sort();

    const data = {
      ok: true,
      bank,
      generatedAt: Date.now(),
      totalEntities: Number(body.total_entities ?? nodes.length),
      totalEdges: Number(body.total_edges ?? edges.length),
      nodes,
      edges,
      span: {
        start: born[0] ?? null,
        end: seen[seen.length - 1] ?? born[born.length - 1] ?? null,
      },
    };
    graphCache = { bank, at: Date.now(), data };
    return data;
  }

  /** One entity plus the memories that mention it — the drill-down from a node. */
  async function entityDetail(id, limit) {
    const bank = await resolveBank();
    const encoded = encodeURIComponent(id);
    const [entity, memories] = await Promise.all([
      fetchJson(bankUrl(bank, `/entities/${encoded}`), undefined, GRAPH_TIMEOUT_MS),
      fetchJson(bankUrl(bank, `/memories/list?entity_id=${encoded}&limit=${limit}`), undefined, GRAPH_TIMEOUT_MS),
    ]);
    return {
      ok: true,
      bank,
      entity: {
        id: String(entity?.id ?? id),
        label: String(entity?.canonical_name ?? id),
        mentions: Number(entity?.mention_count ?? 0),
        firstSeen: entity?.first_seen ?? null,
        lastSeen: entity?.last_seen ?? null,
      },
      total: Number(memories?.total ?? (memories?.items?.length ?? 0)),
      memories: (memories?.items ?? []).map((item) => ({
        id: item?.id,
        text: item?.text ?? '',
        factType: item?.fact_type ?? 'fact',
        date: item?.date ?? item?.mentioned_at ?? null,
        documentId: item?.document_id ?? null,
      })),
    };
  }

  async function setupState() {
    const [config, status] = await Promise.all([loadConfig(), daemon.status()]);
    const integration = integrationStatus();
    const apiKey = await apiKeyStatus(ctx);
    const models = modelsStatus();
    const env = readEnvFile(profileEnvFile());
    const network = daemon.networkInfo() ?? (await networkState());
    const steps = [
      {
        id: 'integration',
        title: '安装记忆集成',
        detail: integration.installed
          ? `已安装${integration.version ? ` v${integration.version}` : ''}${integration.enabled ? '' : '（未启用）'}`
          : '把 Hindsight 记忆接入当前 DSH profile',
        done: integration.installed,
      },
      {
        id: 'key',
        title: '填写模型密钥',
        detail: apiKey.configured
          ? `已配置（${apiKey.source === 'panel' ? '本面板' : apiKey.source === 'harness' ? 'Harness 凭据' : '环境变量'}）`
          : '用于事实抽取的 DeepSeek API key',
        done: apiKey.configured,
      },
      {
        id: 'cache',
        title: '选择缓存目录',
        detail: config.installDir || '默认位置（可跳过）',
        done: Boolean(config.installDir),
        optional: true,
      },
      {
        id: 'daemon',
        title: '启动本地守护进程',
        detail:
          status.status === 'running'
            ? `运行中 · ${bankCache.name ?? derivedBank()}`
            : status.status === 'starting'
              ? '启动中，首次启动要下载本地模型'
              : '启动后会创建第一个记忆库',
        done: status.status === 'running',
      },
    ];
    return {
      ok: true,
      profile: profileName(),
      integration,
      apiKey,
      models,
      network,
      port: { value: daemonPort, pinned: env.HINDSIGHT_API_PORT !== undefined },
      config,
      daemon: {
        status: status.status,
        running: status.running,
        error: status.error ?? null,
        attempt: status.attempt ?? 0,
        retryAt: status.retryAt ?? 0,
      },
      install: { ...installState },
      steps,
      ready: integration.installed && apiKey.configured && status.running,
    };
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

      '/hindsight-manager/api/setup': async (req, res) => {
        try {
          if (req.method === 'GET') {
            json(res, 200, await setupState());
            return;
          }
          const raw = await readBody(req);
          const body = raw.length === 0 ? {} : JSON.parse(raw);
          if (body.action === 'install-integration') {
            json(res, 200, startIntegrationInstall());
            return;
          }
          if (body.action === 'save-key') {
            const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
            if (apiKey.length < 8 || /\s/.test(apiKey)) {
              json(res, 400, { ok: false, error: 'API key 格式不正确' });
              return;
            }
            writeEnvFile(profileEnvFile(), { HINDSIGHT_API_LLM_API_KEY: apiKey });
            json(res, 200, { ok: true, saved: true });
            return;
          }
          json(res, 400, { ok: false, error: 'unknown setup action' });
        } catch (error) {
          json(res, 400, { ok: false, error: error?.message ?? String(error) });
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

      '/hindsight-manager/api/graph': async (_req, res) => {
        try {
          json(res, 200, await entityGraph());
        } catch (error) {
          if (error?.status === 404) {
            json(res, 404, { ok: false, error: '当前 Hindsight 版本没有实体图谱接口（/entities/graph）' });
            return;
          }
          json(res, 500, { ok: false, error: error?.message ?? String(error) });
        }
      },

      '/hindsight-manager/api/entity': async (req, res) => {
        try {
          const url = new URL(req.url ?? '/', 'http://127.0.0.1');
          const id = (url.searchParams.get('id') ?? '').trim();
          if (id === '') {
            json(res, 400, { ok: false, error: 'id is required' });
            return;
          }
          const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 5) || 5, 1), 100);
          json(res, 200, await entityDetail(id, limit));
        } catch (error) {
          json(res, error?.status === 404 ? 404 : 500, { ok: false, error: error?.message ?? String(error) });
        }
      },

      '/hindsight-manager/api/banks': async (_req, res) => {
        try {
          const [banks, config] = await Promise.all([listBanks(), loadConfig()]);
          json(res, 200, { ok: true, banks, selected: config.bank, resolved: await resolveBank() });
        } catch (error) {
          json(res, 500, { ok: false, error: error?.message ?? String(error) });
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
            } else if (key === 'bank') {
              if (typeof value !== 'string') {
                json(res, 400, { ok: false, error: 'bank must be a string' });
                return;
              }
              const chosen = value.trim();
              if (chosen !== '' && !chosen.startsWith(BANK_PREFIX)) {
                json(res, 400, { ok: false, error: `bank must start with ${BANK_PREFIX}` });
                return;
              }
              patch.bank = chosen;
            } else if (key === 'showFooterStatus' || key === 'showSidebarEntry') {
              if (typeof value !== 'boolean') {
                json(res, 400, { ok: false, error: `${key} must be a boolean` });
                return;
              }
              patch[key] = value;
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

  // Auto-start on Harness launch, with retry: the credential service, the
  // network, or a VPN's proxy can become usable after this plugin loads.
  void loadConfig().then((config) => {
    if (!config.autoStart) return;
    const attempt = (n) => {
      daemon
        .start(ctx, config)
        .then((result) => {
          if (result.ok) {
            ctx.logger?.info?.(`${PLUGIN}: daemon ${result.already ? 'already running' : 'starting'}`);
            return;
          }
          ctx.logger?.warn?.(`${PLUGIN}: daemon start failed (attempt ${n + 1}): ${result.error}`);
          if (n < 4) setTimeout(() => attempt(n + 1), 5000);
        })
        .catch((error) => {
          ctx.logger?.warn?.(`${PLUGIN}: daemon start threw: ${error?.message ?? String(error)}`);
          if (n < 4) setTimeout(() => attempt(n + 1), 5000);
        });
    };
    attempt(0);
  });

  ctx.logger?.info?.(`${PLUGIN}: host half active (daemon ${daemonBase()})`);
}
