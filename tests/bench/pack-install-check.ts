/**
 * Install Idra from a packed tarball into a clean prefix and run the installed CLI, to catch
 * missing executables, migrations, or runtime files. Uses npm (dependency install only).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { REPO_ROOT } from '../helpers.js';

const npmCli = process.env['npm_execpath'];
function npm(args: string[], cwd: string): string {
  if (npmCli && npmCli.endsWith('.js')) return execFileSync(process.execPath, [npmCli, ...args], { cwd, encoding: 'utf8' });
  return execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, { cwd, encoding: 'utf8', shell: process.platform === 'win32' });
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'idra-pack-'));
const packOut = npm(['pack', '--json', '--pack-destination', tmp], REPO_ROOT);
// npm <= 10 prints an array; npm 12 prints an object keyed by package name.
const jsonBlock = /^[[{][\s\S]*?^[\]}]\r?$/m.exec(packOut);
if (!jsonBlock) throw new Error('npm pack --json output not found');
const parsed = JSON.parse(jsonBlock[0]) as unknown;
type PackInfo = { filename: string; files: { path: string }[] };
const info = (Array.isArray(parsed) ? parsed[0] : Object.values(parsed as Record<string, PackInfo>)[0]) as PackInfo;
const tarball = path.join(tmp, info.filename);
const packed = info.files.map((f) => f.path.replace(/\\/g, '/'));
const required = ['dist/src/cli.js', 'dist/src/main.js', 'dist/src/server.js', 'migrations/001_init.sql', 'README.md', 'LICENSE'];
const missing = required.filter((f) => !packed.includes(f));
const leaked = packed.filter((f) => /^(dist\/tests|tests|src)\/|\.idra|outputs\/|\.sqlite$|\.env/.test(f));
if (missing.length || leaked.length) {
  console.error(JSON.stringify({ missing, leaked }, null, 2));
  process.exit(1);
}

const prefix = path.join(tmp, 'install');
fs.mkdirSync(prefix);
fs.writeFileSync(path.join(prefix, 'package.json'), '{"name":"idra-pack-check","private":true}');
npm(['install', '--no-audit', '--no-fund', tarball], prefix);
const cli = path.join(prefix, 'node_modules', 'idra-photo', 'dist', 'src', 'cli.js');
const ws = path.join(tmp, 'workspace');
const doctor = spawnSync(process.execPath, [cli, 'doctor', '--workspace', ws], { encoding: 'utf8' });
const sim = spawnSync(process.execPath, [cli, 'simulate', '--workspace', path.join(tmp, 'sim'), '--count', '3'], { encoding: 'utf8' });
const binName = process.platform === 'win32' ? 'idra-photo.cmd' : 'idra-photo';
const report = {
  tarball: path.basename(tarball),
  packed_files: packed.length,
  bin_shim_present: fs.existsSync(path.join(prefix, 'node_modules', '.bin', binName)),
  doctor_exit: doctor.status,
  doctor_output: doctor.stdout.trim().split('\n'),
  simulate_exit: sim.status,
  simulate_tail: sim.stdout.trim().split('\n').slice(-6),
};
console.log(JSON.stringify(report, null, 2));
process.exit(report.doctor_exit === 0 && report.simulate_exit === 0 && report.bin_shim_present ? 0 : 1);
