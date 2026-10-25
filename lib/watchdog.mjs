// dsh-hindsight-manager watchdog.
//
// Spawned detached by the Host half when the daemon starts. It polls whether the
// Harness main process is still alive; once it is gone, it stops the daemon and
// exits, so a closed Harness never leaves an orphan holding ~1 GB of RAM.
//
// The daemon itself is detached on purpose (one daemon serves every repo), so
// nothing else would reap it.
//
// Usage: node watchdog.mjs --ppid <harness pid> --port <daemon port>
import { execFileSync } from 'node:child_process';

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : null;
}

const ppid = Number.parseInt(arg('ppid') ?? '', 10);
const port = Number.parseInt(arg('port') ?? '9077', 10);
const POLL_MS = 2000;

function isAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Stop whatever listens on the port: the daemon detaches from its starter. */
function stopDaemonOnPort() {
  try {
    const out = execFileSync('netstat', ['-ano'], {
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 16 * 1024 * 1024,
    });
    const portRe = new RegExp(`:${port}(?=\\s|$)`, 'i');
    for (const line of out.split(/\r?\n/)) {
      if (!portRe.test(line) || !/LISTENING/i.test(line)) continue;
      const pid = line.trim().split(/\s+/).pop();
      if (!pid || !/^\d+$/.test(pid)) continue;
      try {
        execFileSync('taskkill', ['/PID', pid, '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      } catch {
        // already gone
      }
    }
  } catch {
    // no netstat, or the port is free
  }
}

if (!isAlive(ppid)) {
  // The Harness was already gone before this watchdog started.
  stopDaemonOnPort();
  process.exit(0);
}

const timer = setInterval(() => {
  if (isAlive(ppid)) return;
  clearInterval(timer);
  stopDaemonOnPort();
  process.exit(0);
}, POLL_MS);
