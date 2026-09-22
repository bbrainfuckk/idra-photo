#!/usr/bin/env node
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
