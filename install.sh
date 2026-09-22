#!/bin/sh
# Connect Idra Photo to Codex. Extra options pass through, e.g. --workspace "$HOME/Idra".
exec /bin/sh "$(dirname -- "$0")/idra-photo.sh" install-codex "$@"
