import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
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
  install-codex [--workspace <dir>] [--name idra_photo]   Connect Idra to Codex (restart Codex after).
  uninstall-codex [--name idra_photo]                     Disconnect it. Your images are kept.
  doctor [--workspace <dir>]                              Check that everything is ready.
  status [--workspace <dir>] [--batch <id>]               Show batches or one batch.
  serve [--workspace <dir>] [--allow-import <dir>]...     The MCP server Codex runs (stdio).
  manifest --batch <id> [--workspace <dir>]               Rewrite outputs/<batch>/manifest.json.
  simulate [--workspace <dir>] [--count N]                SIMULATION: fake host + fixture images.
                                                          It never calls a real image model.
The workspace defaults to $IDRA_WORKSPACE, then ~/Idra Photo.
`;

/** The script Node is running: dist/src/cli.js in a dev checkout, idra-photo.mjs in the bundle. */
export const CLI_PATH = path.resolve(process.argv[1] ?? 'idra-photo.mjs');
const LIST_SEP = process.platform === 'win32' ? ';' : ':';

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
      help: { type: 'boolean', short: 'h' },
    },
  }).values;
}

export function defaultWorkspace(): string {
  return path.join(os.homedir(), 'Idra Photo');
}

function workspaceFrom(v: { workspace?: string | undefined }, allowDefault: boolean): string {
  const w = v.workspace ?? process.env['IDRA_WORKSPACE'] ?? (allowDefault ? defaultWorkspace() : undefined);
  if (!w) throw new Error('no workspace: pass --workspace <absolute dir> or set IDRA_WORKSPACE (install-codex sets it for Codex)');
  return path.resolve(w);
}

function importsFrom(v: { 'allow-import'?: string[] | undefined }): string[] {
  if (v['allow-import']?.length) return v['allow-import'];
  return (process.env['IDRA_ALLOW_IMPORTS'] ?? '').split(LIST_SEP).filter(Boolean);
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
        root: workspaceFrom(v, false),
        allowImports: importsFrom(v),
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
      // When the host closes stdin, let in-flight replies finish and flush before exiting.
      process.stdin.on('end', () => setTimeout(() => process.stdout.write('', shutdown), 150));
      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
      await serveStdio(ctx);
      return new Promise<number>(() => undefined);
    }
    case 'status': {
      const ctx = openWorkspace({ root: workspaceFrom(v, true), log: () => undefined });
      try {
        process.stdout.write(JSON.stringify(status(ctx, { batch_id: v.batch, detail: !!v.batch }), null, 2) + '\n');
      } finally {
        closeWorkspace(ctx);
      }
      return 0;
    }
    case 'manifest': {
      const ctx = openWorkspace({ root: workspaceFrom(v, true), log: () => undefined });
      try {
        if (!v.batch) throw new Error('--batch is required');
        process.stdout.write(`${writeManifest(ctx, v.batch) ?? 'batch not found'}\n`);
      } finally {
        closeWorkspace(ctx);
      }
      return 0;
    }
    case 'doctor':
      return doctor(workspaceFrom(v, true), importsFrom(v));
    case 'simulate':
      return simulate(v.workspace ? path.resolve(v.workspace) : null, v.count ? Number(v.count) : 5);
    case 'install-codex':
      return installCodex(v);
    case 'uninstall-codex':
      return uninstallCodex(v);
    default:
      process.stderr.write(`unknown command: ${cmd}\n${HELP}`);
      return 2;
  }
}

// ---------------------------------------------------------------- doctor

export function cloudSynced(p: string): boolean {
  return /[\\/](OneDrive|Dropbox|Google Drive|iCloud Drive|Mobile Documents)([\\/ -]|$)/i.test(p);
}

async function doctor(workspace: string, allowImports: string[]): Promise<number> {
  const lines: [string, 'ok' | 'fail' | 'warn' | 'info', string][] = [];
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
    if (cloudSynced(ctx.rootReal)) lines.push(['workspace sync', 'warn', 'this folder is cloud-synced; sync tools can lock the database. A local folder is safer.']);
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
  lines.push(['codex', 'info', codex ? `client found: ${codex}` : 'Codex CLI not found (install-codex edits ~/.codex/config.toml directly)']);
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
  if (!workspace) fs.rmSync(ws, { recursive: true, force: true });
  return r.final.status === 'done' ? 0 : 1;
}

// ---------------------------------------------------------------- install / uninstall

export function findCodex(explicit?: string): string | null {
  if (explicit === 'none') return null;
  if (explicit) return fs.existsSync(explicit) ? explicit : null;
  const names = process.platform === 'win32' ? ['codex.exe', 'codex.cmd', 'codex'] : ['codex'];
  for (const dir of (process.env['PATH'] ?? '').split(path.delimiter)) {
    for (const n of names) {
      const p = path.join(dir, n);
      if (dir && fs.existsSync(p)) return p;
    }
  }
  const candidates: string[] = [];
  if (process.platform === 'win32' && process.env['LOCALAPPDATA']) {
    // The Codex desktop app ships its CLI here.
    const bin = path.join(process.env['LOCALAPPDATA'], 'OpenAI', 'Codex', 'bin');
    if (fs.existsSync(bin)) for (const d of fs.readdirSync(bin)) candidates.push(path.join(bin, d, 'codex.exe'));
  }
  if (process.platform === 'darwin') candidates.push('/Applications/Codex.app/Contents/Resources/codex');
  const found = candidates.filter((p) => fs.existsSync(p)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return found[0] ?? null;
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
  // Where Codex saves image_gen outputs; it may not exist until the first generation.
  dirs.push(path.join(codexHome, 'generated_images'));
  return [...new Set(dirs)];
}

/** How Codex should start Idra. A checkout uses the launcher, which finds Node at every start. */
export function launchSpec(): { command: string; args: string[] } {
  let dir = path.dirname(CLI_PATH);
  for (let i = 0; i < 4; i++) {
    const cmd = path.join(dir, 'idra-photo.cmd');
    const sh = path.join(dir, 'idra-photo.sh');
    if (process.platform === 'win32' && fs.existsSync(cmd)) return { command: cmd, args: ['serve'] };
    if (process.platform !== 'win32' && fs.existsSync(sh)) return { command: '/bin/sh', args: [sh, 'serve'] };
    dir = path.dirname(dir);
  }
  return { command: process.execPath, args: [CLI_PATH, 'serve'] };
}

function codexConfigPath(): string {
  return path.join(process.env['CODEX_HOME'] || path.join(os.homedir(), '.codex'), 'config.toml');
}

function tomlStr(s: string): string {
  return JSON.stringify(s);
}

/** Remove [mcp_servers.<name>] and its sub-tables; keep everything else byte for byte. */
export function removeTomlServer(text: string, name: string): string {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  let skipping = false;
  const own = new RegExp(`^\\s*\\[\\s*mcp_servers\\.(?:"${name}"|${name})(\\s*\\]|\\.)`);
  for (const line of lines) {
    if (/^\s*\[/.test(line)) skipping = own.test(line);
    if (!skipping) out.push(line);
  }
  return out.join('\n').replace(/\n{3,}$/, '\n\n');
}

export function tomlServerBlock(name: string, spec: { command: string; args: string[] }, env: Record<string, string>): string {
  return [
    `[mcp_servers.${name}]`,
    `command = ${tomlStr(spec.command)}`,
    `args = [${spec.args.map(tomlStr).join(', ')}]`,
    'startup_timeout_sec = 20',
    '',
    `[mcp_servers.${name}.env]`,
    ...Object.entries(env).map(([k, val]) => `${k} = ${tomlStr(val)}`),
    '',
  ].join('\n');
}

function writeConfigWithBackup(file: string, next: string): string | null {
  let backup: string | null = null;
  if (fs.existsSync(file)) {
    backup = `${file}.bak-idra-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    fs.copyFileSync(file, backup);
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.idra-tmp`;
  fs.writeFileSync(tmp, next);
  fs.renameSync(tmp, file);
  return backup;
}

function installCodex(v: ReturnType<typeof opts>): number {
  const name = v.name ?? 'idra_photo';
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(name)) throw new Error('--name may only contain letters, digits, _ and -');
  const workspace = path.resolve(v.workspace ?? defaultWorkspace());
  fs.mkdirSync(path.join(workspace, 'references'), { recursive: true });
  const imports = v['allow-import']?.length ? v['allow-import'].map((d) => path.resolve(d)) : defaultImportDirs();
  const spec = launchSpec();
  const env = { IDRA_WORKSPACE: workspace, IDRA_ALLOW_IMPORTS: imports.join(LIST_SEP) };
  const block = tomlServerBlock(name, spec, env);

  process.stdout.write(`Idra Photo ${VERSION}\n  images go to:   ${path.join(workspace, 'outputs')}\n  reads photos from: ${imports.join(', ')}\n`);
  if (cloudSynced(workspace)) process.stdout.write('  note: that folder is cloud-synced; a local folder is safer for the database.\n');
  if (v['dry-run']) {
    process.stdout.write(`\nDry run. This is what goes into ${codexConfigPath()}:\n\n${block}`);
    return 0;
  }

  const codex = findCodex(v.codex);
  let how: string;
  if (codex) {
    spawnSync(codex, ['mcp', 'remove', name], { stdio: 'ignore' });
    const r = spawnSync(codex, ['mcp', 'add', name, ...Object.entries(env).flatMap(([k, val]) => ['--env', `${k}=${val}`]), '--', spec.command, ...spec.args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
    });
    if (r.status !== 0) throw new Error(`codex mcp add failed: ${(r.stderr || r.stdout || '').trim()}`);
    how = `registered with ${codex}`;
  } else {
    const file = codexConfigPath();
    const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    const kept = removeTomlServer(current, name).replace(/\s*$/, '');
    const backup = writeConfigWithBackup(file, `${kept ? `${kept}\n\n` : ''}${block}`);
    how = `wrote ${file}${backup ? ` (backup: ${path.basename(backup)})` : ''}`;
  }
  process.stdout.write(
    `\nDone: ${how}.\nRestart Codex, drag in a photo, and say:\n  "Use Idra Photo: make 10 photos in the exact same style as this image. <your prompt>"\nTo remove it later: idra-photo uninstall-codex (your images stay).\n`,
  );
  return 0;
}

function uninstallCodex(v: ReturnType<typeof opts>): number {
  const name = v.name ?? 'idra_photo';
  const codex = findCodex(v.codex);
  if (codex) {
    const r = spawnSync(codex, ['mcp', 'remove', name], { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
    process.stdout.write(r.status === 0 ? `Removed "${name}" from Codex.\n` : `Codex had no "${name}" entry.\n`);
    return 0;
  }
  const file = codexConfigPath();
  if (!fs.existsSync(file)) {
    process.stdout.write('No Codex config found; nothing to remove.\n');
    return 0;
  }
  const current = fs.readFileSync(file, 'utf8');
  const next = removeTomlServer(current, name);
  if (next === current) {
    process.stdout.write(`Codex had no "${name}" entry.\n`);
    return 0;
  }
  writeConfigWithBackup(file, next);
  process.stdout.write(`Removed "${name}" from ${file}. Your images were not touched.\n`);
  return 0;
}
