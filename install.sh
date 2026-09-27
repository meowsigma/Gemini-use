#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v node >/dev/null 2>&1; then
  printf 'Node.js >=22.12 is required. Install Node.js 22 LTS, then rerun this installer.\n' >&2
  exit 1
fi
node "$SCRIPT_DIR/install.mjs" "$@"
