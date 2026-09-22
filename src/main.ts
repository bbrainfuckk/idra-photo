import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { closeWorkspace, openWorkspace } from './core/workspace.js';
import { status } from './core/queue.js';
import { writeManifest } from './core/manifest.js';
import { serveStdio } from './server.js';
import { VERSION } from './version.js';
import { FakeHost, runSimulatedBatch } from './sim/fakeHost.js';
import { TOOL_NAMES } from './tools/index.js';
import { makePng } from './sim/fixtures.js';

const HELP = `idra-photo ${VERSION}: your AI generates, Idra manages the batch.

Commands
  serve --workspace <dir> [--allow-import <dir>]...   Run the local stdio MCP server (used by Codex).
  install-codex [--workspace <dir>] [--name idra_photo] [--codex <exe>] [--dry-run]
                                                     Register the server with the Codex client.
  doctor --workspace <dir>                           Check runtime, workspace, database, and MCP readiness.
  status --workspace <dir> [--batch <id>]            Show batches or one batch.
  manifest --workspace <dir> --batch <id>            Rewrite outputs/<batch>/manifest.json.
  simulate [--workspace <dir>] [--count N]           SIMULATION: run a fake host with fixture images.
                                                     It never calls a real image model.
`;

const here = path.dirname(fileURLToPath(import.meta.url));
export const CLI_PATH = path.join(here, 'cli.js');

function opts(args: string[]) {
  return parseArgs({
    args,
    allowPositionals: true,
    options: {
      workspace: { type: 'string' },
      'allow-import': { type: 'string', multiple: true },
      simulation: { type: 'boolean' },
      'stale-claim-minutes': { type: 'string' },
      batch: { type: 'string' },
      count: { type: 'string' },
      name: { type: 'string' },
      codex: { type: 'string' },
      'dry-run': { type: 'boolean' },
      json: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  }).values;
}

function requireWorkspace(v: { workspace?: string | undefined }): string {
  if (!v.workspace) throw new Error('--workspace <absolute dir> is required');
  return path.resolve(v.workspace);
}

export async function main(argv: string[]): Promise<number> {
  const [cmd, ...rest] = argv;
  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    process.stdout.write(HELP);
    return 0;
  }
  if (cmd === '--version' || cmd === 'version') {
    process.stdout.write(`${VERSION}\n`);
    return 0;
  }
  const v = opts(rest);
  switch (cmd) {
    case 'serve': {
      const ctx = openWorkspace({
        root: requireWorkspace(v),
        allowImports: v['allow-import'] ?? [],
        simulation: v.simulation === true,
        staleClaimMinutes: v['stale-claim-minutes'] ? Number(v['stale-claim-minutes']) : 20,
      });
      const shutdown = () => {
        try {
          closeWorkspace(ctx);
        } catch {
          /* already closed */
        }
        process.exit(0);
      };
      process.stdin.on('end', shutdown);
      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
      await serveStdio(ctx);
      return new Promise<number>(() => undefined);
    }
    case 'status': {
      const ctx = openWorkspace({ root: requireWorkspace(v), log: () => undefined });
      try {
        process.stdout.write(JSON.stringify(status(ctx, { batch_id: v.batch, detail: !!v.batch }), null, 2) + '\n');
      } finally {
        closeWorkspace(ctx);
      }
      return 0;
    }
    case 'manifest': {
      const ctx = openWorkspace({ root: requireWorkspace(v), log: () => undefined });
      try {
        if (!v.batch) throw new Error('--batch is required');
        process.stdout.write(`${writeManifest(ctx, v.batch) ?? 'batch not found'}\n`);
      } finally {
        closeWorkspace(ctx);
      }
      return 0;
    }
    case 'doctor':
      return doctor(requireWorkspace(v), v['allow-import'] ?? []);
    case 'simulate':
      return simulate(v.workspace ? path.resolve(v.workspace) : null, v.count ? Number(v.count) : 5);
    case 'install-codex':
      return installCodex(v);
    default:
      process.stderr.write(`unknown command: ${cmd}\n${HELP}`);
      return 2;
  }
}

// ---------------------------------------------------------------- doctor

async function doctor(workspace: string, allowImports: string[]): Promise<number> {
  const lines: [string, 'ok' | 'fail' | 'info', string][] = [];
  const [maj, min] = process.versions.node.split('.').map(Number) as [number, number];
  lines.push(['node', maj > 22 || (maj === 22 && min >= 13) ? 'ok' : 'fail', `${process.versions.node} at ${process.execPath} (need >= 22.13)`]);
  try {
    const { DatabaseSync } = await import('node:sqlite');
    new DatabaseSync(':memory:').close();
    lines.push(['sqlite', 'ok', 'node:sqlite available']);
  } catch (err) {
    lines.push(['sqlite', 'fail', (err as Error).message]);
  }
  try {
    const ctx = openWorkspace({ root: workspace, allowImports, log: () => undefined });
    const probe = path.join(ctx.idraDir, `.doctor-${process.pid}`);
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
    lines.push(['workspace', 'ok', ctx.rootReal]);
    lines.push(['database', 'ok', `${ctx.db.path} schema v${ctx.db.schemaVersion()}`]);
    lines.push(['imports', 'info', ctx.allowImportsReal.length ? ctx.allowImportsReal.join('; ') : 'none (references must be inside the workspace)']);
    closeWorkspace(ctx);
  } catch (err) {
    lines.push(['workspace', 'fail', (err as Error).message]);
  }
  try {
    const host = await FakeHost.connect({ cliPath: CLI_PATH, workspace });
    const tools = (await host.client.listTools()).tools.map((t) => t.name).sort();
    const missing = TOOL_NAMES.filter((t) => !tools.includes(t));
    lines.push(['mcp', missing.length ? 'fail' : 'ok', `stdio handshake ok, ${tools.length} tools, instructions ${Buffer.byteLength(host.instructions)} bytes${missing.length ? `, missing ${missing.join(',')}` : ''}`]);
    await host.close();
  } catch (err) {
    lines.push(['mcp', 'fail', (err as Error).message]);
  }
  const codex = findCodex();
  lines.push(['codex', 'info', codex ? `client found: ${codex}` : 'Codex CLI not found on PATH (install-codex prints a config snippet instead)']);
  lines.push(['native image generation', 'info', 'not checkable from Idra: the host owns image_gen. Run the 3-image smoke test in docs/testing.md.']);
  for (const [k, s, d] of lines) process.stdout.write(`${s.padEnd(4)}  ${k.padEnd(24)} ${d}\n`);
  return lines.some((l) => l[1] === 'fail') ? 1 : 0;
}

// ---------------------------------------------------------------- simulate

async function simulate(workspace: string | null, count: number): Promise<number> {
  const ws = workspace ?? fs.mkdtempSync(path.join(os.tmpdir(), 'idra-sim-'));
  const refDir = path.join(ws, 'references');
  fs.mkdirSync(refDir, { recursive: true });
  const ref = path.join(refDir, 'sim-style.png');
  if (!fs.existsSync(ref)) fs.writeFileSync(ref, makePng(48, 60, 424242));
  process.stdout.write(`SIMULATION: fake host + fixture images. No real image model is called.\nworkspace: ${ws}\n`);
  const r = await runSimulatedBatch({ cliPath: CLI_PATH, workspace: ws, count, referencePath: ref });
  process.stdout.write(
    JSON.stringify(
      {
        batch_id: r.batchId,
        final_status: r.final.status,
        progress: r.final.progress,
        fixture_images_written: r.generated,
        tool_calls: r.metrics.calls,
        response_bytes: r.metrics.responseBytes,
        request_bytes: r.metrics.requestBytes,
      },
      null,
      2,
    ) + '\n',
  );
  return r.final.status === 'done' ? 0 : 1;
}

// ---------------------------------------------------------------- install-codex

export function findCodex(explicit?: string): string | null {
  if (explicit) return fs.existsSync(explicit) ? explicit : null;
  const names = process.platform === 'win32' ? ['codex.exe', 'codex.cmd', 'codex'] : ['codex'];
  for (const dir of (process.env['PATH'] ?? '').split(path.delimiter)) {
    for (const n of names) {
      const p = path.join(dir, n);
      if (dir && fs.existsSync(p)) return p;
    }
  }
  if (process.platform === 'win32' && process.env['LOCALAPPDATA']) {
    // The Codex desktop app ships its CLI here.
    const bin = path.join(process.env['LOCALAPPDATA'], 'OpenAI', 'Codex', 'bin');
    if (fs.existsSync(bin)) {
      const found = fs
        .readdirSync(bin)
        .map((d) => path.join(bin, d, 'codex.exe'))
        .filter((p) => fs.existsSync(p))
        .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
      if (found[0]) return found[0];
    }
  }
  return null;
}

export function defaultImportDirs(): string[] {
  const home = os.homedir();
  const codexHome = process.env['CODEX_HOME'] || path.join(home, '.codex');
  const dirs = [
    path.join(home, 'Downloads'),
    path.join(home, 'Desktop'),
    path.join(home, 'Pictures'),
    path.join(home, 'OneDrive', 'Desktop'),
    path.join(home, 'OneDrive', 'Pictures'),
    os.tmpdir(),
  ].filter((d) => fs.existsSync(d));
  // Where Codex saves image_gen outputs; may not exist until the first generation.
  dirs.push(path.join(codexHome, 'generated_images'));
  return [...new Set(dirs)];
}

function tomlString(s: string): string {
  return s.includes("'") ? JSON.stringify(s) : `'${s}'`;
}

function installCodex(v: ReturnType<typeof opts>): number {
  const name = v.name ?? 'idra_photo';
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(name)) throw new Error('--name may only contain letters, digits, _ and -');
  const workspace = path.resolve(v.workspace ?? path.join(os.homedir(), 'Pictures', 'Idra Photo'));
  fs.mkdirSync(path.join(workspace, 'references'), { recursive: true });
  const imports = v['allow-import']?.length ? v['allow-import'].map((d) => path.resolve(d)) : defaultImportDirs();
  const serverArgs = [CLI_PATH, 'serve', '--workspace', workspace, ...imports.flatMap((d) => ['--allow-import', d])];
  const toml = [`[mcp_servers.${name}]`, `command = ${tomlString(process.execPath)}`, `args = [${serverArgs.map(tomlString).join(', ')}]`, 'startup_timeout_sec = 20'].join('\n');

  process.stdout.write(`Workspace: ${workspace}\nReference folders Idra may read: ${imports.join('; ')}\n`);
  if (/[\\/]OpenAI[\\/]Codex[\\/]runtimes[\\/]/i.test(process.execPath)) {
    process.stdout.write('Warning: this uses the Node bundled inside Codex, whose path can change when Codex updates. Installing Node 22.13+ separately is more stable.\n');
  }
  const codex = findCodex(v.codex);
  if (v['dry-run'] || !codex) {
    process.stdout.write(`${codex ? '' : 'Codex CLI not found. '}Add this to ~/.codex/config.toml (keep your existing entries):\n\n${toml}\n`);
    if (codex) process.stdout.write(`\nOr run:\n${[codex, 'mcp', 'add', name, '--', process.execPath, ...serverArgs].map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(' ')}\n`);
    return 0;
  }
  const r = spawnSync(codex, ['mcp', 'add', name, '--', process.execPath, ...serverArgs], { stdio: 'inherit' });
  if (r.status !== 0) {
    process.stdout.write(`codex mcp add failed (exit ${r.status}). Add this to ~/.codex/config.toml instead:\n\n${toml}\n`);
    return 1;
  }
  process.stdout.write(`\nRegistered "${name}" with Codex. Restart Codex, then try:\n  "Use Idra Photo: make 10 photos in the same style as this image. <your prompt>"\n`);
  return 0;
}
