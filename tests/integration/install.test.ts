import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { runSimulatedBatch } from '../../src/sim/fakeHost.js';
import { removeTomlServer } from '../../src/main.js';
import { CLI, REPO_ROOT, tmpWorkspace } from '../helpers.js';

const EXISTING = `model = "some-model"
# my comment stays

[mcp_servers.other]
command = 'C:\tools\other.exe'
args = ["x"]

[mcp_servers.other.env]
TOKEN_NAME = "keep-me"
`;

function run(args: string[], codexHome: string) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', env: { ...process.env, CODEX_HOME: codexHome } });
}

test('install-codex without a Codex CLI edits config.toml safely, idempotently, and uninstall restores it', () => {
  const home = tmpWorkspace('idra-codexhome-');
  const ws = path.join(tmpWorkspace(), 'Idra Photo');
  const cfg = path.join(home, 'config.toml');
  fs.writeFileSync(cfg, EXISTING);
  for (let i = 0; i < 2; i++) {
    const r = run(['install-codex', '--codex', 'none', '--workspace', ws], home);
    assert.equal(r.status, 0, r.stderr);
  }
  const text = fs.readFileSync(cfg, 'utf8');
  assert.ok(text.startsWith(EXISTING.trimEnd()), 'existing settings are kept byte for byte');
  assert.equal(text.match(/^\[mcp_servers\.idra_photo\]$/gm)?.length, 1, 'exactly one entry after two installs');
  assert.match(text, /IDRA_WORKSPACE = ".*Idra Photo"/);
  assert.ok(fs.existsSync(path.join(ws, 'references')));
  assert.ok(fs.readdirSync(home).some((f) => f.startsWith('config.toml.bak-idra-')), 'a backup is written before editing');
  const u = run(['uninstall-codex', '--codex', 'none'], home);
  assert.equal(u.status, 0, u.stderr);
  assert.equal(fs.readFileSync(cfg, 'utf8').trimEnd(), EXISTING.trimEnd());
});

test('removeTomlServer only removes its own tables', () => {
  const t = `[a]\nx = 1\n[mcp_servers.idra_photo]\ncommand = "n"\n[mcp_servers.idra_photo.env]\nK = "v"\n[mcp_servers.idra_photo_extra]\nkeep = true\n`;
  const out = removeTomlServer(t, 'idra_photo');
  assert.doesNotMatch(out, /command = "n"|K = "v"/);
  assert.match(out, /\[mcp_servers\.idra_photo_extra\]\nkeep = true/);
  assert.match(out, /^\[a\]\nx = 1/);
});

test('the checkout launcher starts the bundled server and runs a batch, with the workspace passed by env', async () => {
  const bundle = path.join(REPO_ROOT, 'idra-photo.mjs');
  assert.ok(fs.existsSync(bundle), 'run npm run bundle first');
  const ws = tmpWorkspace();
  const launch =
    process.platform === 'win32'
      ? { command: path.join(REPO_ROOT, 'idra-photo.cmd'), args: ['serve'] }
      : { command: '/bin/sh', args: [path.join(REPO_ROOT, 'idra-photo.sh'), 'serve'] };
  const r = await runSimulatedBatch({ cliPath: bundle, workspace: ws, count: 4, launch: { ...launch, env: { IDRA_WORKSPACE: ws } } });
  assert.equal(r.final.status, 'done');
  assert.equal(r.final.progress, '4/4');
  assert.equal(fs.readdirSync(path.join(ws, 'outputs')).length, 1);
});
