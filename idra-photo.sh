#!/bin/sh
# Idra Photo launcher for macOS/Linux. Finds Node 22.13+ at every start (GUI apps do not inherit
# your shell PATH, so common install locations are checked too), then runs idra-photo.mjs.
DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ok() { [ -n "$1" ] && [ -x "$1" ] && "$1" -e "const[a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)" </dev/null >/dev/null 2>&1; }
for n in "${IDRA_NODE_EXE:-}" "$(command -v node 2>/dev/null)" /opt/homebrew/bin/node /usr/local/bin/node /usr/bin/node "$HOME/.volta/bin/node" "$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"; do
  if ok "$n"; then exec "$n" "$DIR/idra-photo.mjs" "$@"; fi
done
for n in $(ls -d "$HOME"/.nvm/versions/node/*/bin/node "$HOME"/.local/share/fnm/node-versions/*/installation/bin/node 2>/dev/null | sort -r); do
  if ok "$n"; then exec "$n" "$DIR/idra-photo.mjs" "$@"; fi
done
echo "Idra Photo needs Node.js 22.13 or newer. Install it from https://nodejs.org and try again." >&2
exit 1
