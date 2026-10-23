#!/usr/bin/env node
/**
 * One command to run the whole stack for testing and reference:
 *
 *   npm run dev:all
 *
 * - API: the real Express app against an in-memory PostgreSQL (pg-mem) seeded
 *   with the two demo tenants. No Docker, no PostgreSQL, no Redis required.
 * - Portal: Next.js dev server, themed as the Alpha Builders workspace.
 *
 * For the production-shaped stack (real PostgreSQL + Redis, built API and
 * portal) use `docker compose up --build` instead.
 */

import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWindows = process.platform === 'win32';
const PORTAL_URL = 'http://localhost:3000';
const API_URL = 'http://127.0.0.1:8080';
const WORKSPACE = 'alpha-builders.constructops.test';
const PASSWORD = process.env.SEED_PASSWORD ?? 'ChangeMe!123';

const children = [];
let shuttingDown = false;

function log(message) {
  console.log(`\x1b[36m[dev:all]\x1b[0m ${message}`);
}

function fail(message) {
  console.error(`\x1b[31m[dev:all]\x1b[0m ${message}`);
  shutdown(1);
}

function spawnService(name, command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: options.cwd ?? root,
    env: { ...process.env, ...options.env },
    stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
    shell: options.shell ?? false,
    detached: !isWindows,
  });

  children.push({ name, child });

  child.stdout?.on('data', (chunk) => {
    const text = chunk.toString().trimEnd();
    if (text) console.log(`\x1b[90m${name} |\x1b[0m ${text}`);
  });
  child.stderr?.on('data', (chunk) => {
    const text = chunk.toString().trimEnd();
    if (text) console.error(`\x1b[90m${name} |\x1b[0m ${text}`);
  });
  child.on('exit', (code) => {
    if (!shuttingDown) {
      fail(`${name} exited unexpectedly (code ${code}).`);
    }
  });

  return child;
}

function killTree(child) {
  if (child.exitCode !== null || child.killed) return;
  if (isWindows) {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      child.kill('SIGTERM');
    }
  }
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const { child } of children) killTree(child);
  setTimeout(() => process.exit(code), 300);
}

async function waitFor(url, { timeoutMs = 60_000, acceptRedirect = false } = {}) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url, { redirect: 'manual' });
      if (response.status < 500 || (acceptRedirect && response.status < 400)) return true;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once('error', () => resolve(false));
    probe.once('listening', () => probe.close(() => resolve(true)));
    probe.listen(port, '127.0.0.1');
  });
}

async function main() {
  if (!existsSync(path.join(root, 'node_modules', 'tsx'))) {
    console.error('Dependencies are missing. Run `npm install` first.');
    process.exit(1);
  }

  for (const port of [8080, 3000]) {
    if (!(await isPortFree(port))) {
      fail(
        `Port ${port} is already in use. Stop the process holding it (a previous run may ` +
          'still be alive) and try again. On Windows: netstat -ano | findstr :' + port,
      );
      return;
    }
  }

  log('starting in-memory API on :8080 (seeded demo tenants, no Docker needed)');
  spawnService('api', process.execPath, [
    path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    path.join(root, 'scripts', 'dev-inmemory-api.ts'),
  ]);

  if (!(await waitFor(`${API_URL}/healthz`, { timeoutMs: 45_000 }))) {
    fail('API failed to become ready.');
    return;
  }
  log('API ready');

  log('starting portal on :3000');
  spawnService('portal', 'npm run dev -w @constructops/portal', [], {
    shell: true,
    env: {
      API_BASE_URL: API_URL,
      TENANT_HOST_OVERRIDE: WORKSPACE,
    },
  });

  if (!(await waitFor(`${PORTAL_URL}/login`, { timeoutMs: 120_000 }))) {
    fail('Portal failed to become ready.');
    return;
  }

  console.log('');
  log('ConstructOps is running');
  console.log(`  Portal      ${PORTAL_URL}`);
  console.log(`  API         ${API_URL}`);
  console.log(`  Workspace   ${WORKSPACE}`);
  console.log(`  Health      ${API_URL}/healthz   Readiness ${API_URL}/readyz`);
  console.log('');
  console.log('  Sign in with any demo account (password: ' + PASSWORD + ')');
  console.log('    admin@alphabuilders.com    full workspace');
  console.log('    field@alphabuilders.com    field staff');
  console.log('    client@alphabuilders.com   client portal + signatures');
  console.log('');
  console.log('  Press Ctrl+C to stop both services.');
  console.log('');
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

main().catch((error) => {
  console.error(error);
  shutdown(1);
});
