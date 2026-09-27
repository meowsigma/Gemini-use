#!/usr/bin/env bash
set -uo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

printf 'Gemini-use installer\n\n'
installer_args=("$@")
if [[ "${GITHUB_ACTIONS:-}" == "true" ]]; then
  installer_args+=(--no-open)
fi
"$SCRIPT_DIR/install.sh" "${installer_args[@]}"
status=$?

if [ "$status" -eq 0 ]; then
  printf '\nOne-time Chrome/Chromium setup (same profile where you use Gemini):\n'
  printf '1. Open chrome://extensions and enable Developer mode.\n'
  printf '2. Click Load unpacked and choose each folder below:\n'
  printf '   %s\n' "$HOME/.gemini-use/vendor/MCP-SuperAssistant/dist"
  printf '   %s\n' "$HOME/.gemini-use/vendor/mcp-chrome/app/chrome-extension/.output/chrome-mv3"
  printf '3. Open Gemini, start a chat, hover MCP, and click Insert once. Follow-up requests work without reinserting.\n'
else
  printf '\nInstallation failed (exit %s). Fix the message above, then double-click this file again.\n' "$status"
fi

if [ -t 0 ]; then
  printf '\nPress Enter to close this window. '
  IFS= read -r _
fi
exit "$status"
