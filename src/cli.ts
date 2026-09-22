#!/usr/bin/env node
// Refuse old Node with a clear message before loading anything that needs node:sqlite.
const [major = 0, minor = 0] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  process.stderr.write(`Idra Photo needs Node.js 22.13 or newer (found ${process.versions.node}). Get it from https://nodejs.org\n`);
  process.exit(1);
}
// Keep stdout protocol-clean: Node prints an ExperimentalWarning for node:sqlite on stderr.
// Silence only that one warning, then load everything else.
process.removeAllListeners('warning');
process.on('warning', (w) => {
  if (w.name === 'ExperimentalWarning' && /SQLite/i.test(w.message)) return;
  process.stderr.write(`${w.name}: ${w.message}\n`);
});

const { main } = await import('./main.js');
main(process.argv.slice(2)).then(
  (code) => {
    if (typeof code === 'number') process.exitCode = code;
  },
  (err: unknown) => {
    const e = err as { code?: string; message?: string };
    process.stderr.write(`idra-photo: ${e.code ? `[${e.code}] ` : ''}${e.message ?? String(err)}\n`);
    process.exitCode = 1;
  },
);
