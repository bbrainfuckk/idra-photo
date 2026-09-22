/**
 * The "clone and install" experience, checked end to end: git clone the committed repo into a temp
 * folder, then use ONLY the files in that clone (no npm install) to install into a throwaway
 * CODEX_HOME, run doctor, run a simulated batch, and uninstall.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { REPO_ROOT } from '../helpers.js';

const tmp = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'idra-clone-')));
const clone = path.join(tmp, 'idra photo clone');
execFileSync('git', ['clone', '--quiet', REPO_ROOT, clone]);
const win = process.platform === 'win32';
const launcher = path.join(clone, win ? 'idra-photo.cmd' : 'idra-photo.sh');
const codexHome = path.join(tmp, 'codex-home');
const ws = path.join(tmp, 'Idra Photo');
fs.mkdirSync(codexHome);

function launch(args: string[], env: Record<string, string> = {}) {
  const e = { ...process.env, CODEX_HOME: codexHome, ...env };
  const r = win
    ? spawnSync('cmd.exe', ['/d', '/s', '/c', `"${[launcher, ...args].map((a) => `"${a}"`).join(' ')}"`], { encoding: 'utf8', env: e, windowsVerbatimArguments: true })
    : spawnSync('/bin/sh', [launcher, ...args], { encoding: 'utf8', env: e });
  return { code: r.status, out: `${r.stdout}${r.stderr}`.trim() };
}

const report: Record<string, unknown> = {
  clone_has_node_modules: fs.existsSync(path.join(clone, 'node_modules')),
  clone_has_bundle: fs.existsSync(path.join(clone, 'idra-photo.mjs')),
};
const install = launch(['install-codex', '--workspace', ws]);
report['install'] = { code: install.code, out: install.out.split('\n').slice(-6) };
const cfg = fs.existsSync(path.join(codexHome, 'config.toml')) ? fs.readFileSync(path.join(codexHome, 'config.toml'), 'utf8') : '';
report['config_mentions_launcher'] = cfg.includes(path.basename(launcher));
const doctor = launch(['doctor'], { IDRA_WORKSPACE: ws });
report['doctor'] = { code: doctor.code, lines: doctor.out.split('\n').map((l) => l.slice(0, 110)) };
const sim = launch(['simulate', '--workspace', path.join(tmp, 'sim'), '--count', '3']);
report['simulate'] = { code: sim.code, tail: sim.out.split('\n').slice(-4) };
const un = launch(['uninstall-codex']);
report['uninstall'] = { code: un.code, out: un.out };
console.log(JSON.stringify(report, null, 2));
const ok = !report['clone_has_node_modules'] && report['clone_has_bundle'] && install.code === 0 && report['config_mentions_launcher'] && doctor.code === 0 && sim.code === 0 && un.code === 0;
try {
  fs.rmSync(tmp, { recursive: true, force: true });
} catch {
  /* best effort */
}
process.exit(ok ? 0 : 1);
