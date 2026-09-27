# Gemini-use

A small installer and compatibility patch set that wires your **normal, signed-in Gemini website chat** to browser actions by combining only these existing open-source projects:

- [MCP SuperAssistant](https://github.com/srbhptl39/MCP-SuperAssistant) — Gemini web-chat tool detection, result insertion, and agent loop.
- [mcp-chrome](https://github.com/hangwin/mcp-chrome) — Chrome/Chromium browser actions and the Native Messaging bridge.

No Gemini API client, LLM backend, separate chat UI, or second browser automation engine is included. Gemini remains the model and conversation UI.

## Install

### Double-click launchers

- **Linux:** double-click `Install-Gemini-use.desktop`. If the desktop asks, choose **Allow Launching** / **Trust and Launch**. It opens a terminal, runs the installer, and leaves the browser setup steps visible. If your file manager does not launch `.desktop` files, right-click `Install-Gemini-use.sh` and choose **Run in Terminal**.
- **Windows:** double-click `Install-Gemini-use.cmd`. It runs the PowerShell installer and then displays the manual browser steps.

### Linux

Prerequisites: Git, Node.js **22.12+**, Python 3 (for the `.desktop` double-click launcher), a Chrome/Chromium browser, and an interactive desktop session. The installer bootstraps pnpm 9.15.1 with Corepack or npm when needed.

```bash
git clone https://github.com/meowsigma/Gemini-use.git
cd Gemini-use
./install.sh
```

### Windows

Prerequisites: Git for Windows (including Bash), Chrome/Chromium, and PowerShell. If Node.js is missing, `install.ps1` attempts to install Node LTS with `winget`.

```powershell
git clone https://github.com/meowsigma/Gemini-use.git
cd Gemini-use
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
```

The installer checks out pinned upstream commits, applies the small compatibility patches, builds both extensions, and registers the mcp-chrome Native Messaging host for the current user. It keeps the upstream worktrees under `~/.gemini-use/vendor` (Windows: `%USERPROFILE%\.gemini-use\vendor`) and does not overwrite an existing workspace with unknown contents. If an older install reports a state/version mismatch, move that workspace aside or pass a new `--workspace PATH`; the installer will not destroy it.

### One-time browser step (required by Chrome/Chromium)

Chrome does not allow third-party installers to silently load unpacked extensions into an existing profile. The installer opens `chrome://extensions` when possible. In the browser profile where you use Gemini:

1. Enable **Developer mode**.
2. Choose **Load unpacked** and select both build folders:
   - Linux: `~/.gemini-use/vendor/MCP-SuperAssistant/dist` and `~/.gemini-use/vendor/mcp-chrome/app/chrome-extension/.output/chrome-mv3`
   - Windows: `%USERPROFILE%\.gemini-use\vendor\MCP-SuperAssistant\dist` and `%USERPROFILE%\.gemini-use\vendor\mcp-chrome\app\chrome-extension\.output\chrome-mv3` (browse to your user folder if the picker does not expand `%USERPROFILE%`).
3. Confirm both extensions are enabled. The mcp-chrome extension ID is pinned by the public key included in this repo, so Native Messaging is registered for the correct ID.

This is a one-time browser setup, not a step you repeat for each task. Chrome/Chromium may ask you to confirm developer-mode extensions after an update.

## Use

1. Open `https://gemini.google.com` in that same browser profile and start a conversation.
2. Hover over the **MCP** button beside the Gemini composer and choose **Insert** once in that conversation. This supplies SuperAssistant’s existing tool descriptions and the browser-agent instructions to Gemini.
3. Give Gemini a normal-language task, e.g. “Open my Wikipedia tab, find the ‘Mosaic’ link, click it, and tell me the page title.”
4. Gemini’s requested browser actions run through mcp-chrome. Results are sent back into the same conversation and Gemini continues automatically; you do not manually run or approve each tool call.

Insert instructions once per new Gemini conversation. Follow-up messages in that conversation should use the browser without inserting again.

The browser toolset supports page reading, click/double-click, typing and form filling, keyboard input, scrolling, screenshots, tab opening/switching/navigation, local file uploads, and download detection. Sites that require a login, CAPTCHA, or user confirmation still require the user to complete that step.

## Verify / troubleshoot

- The mcp-chrome local bridge listens on `http://127.0.0.1:12306`.
- In the mcp-chrome worktree, run `node app/native-server/dist/cli.js doctor --json` for Native Messaging diagnostics.
- If Gemini’s MCP panel says disconnected, use its **Reconnect** action, then reload the Gemini tab.
- If a tab ID is stale, ask Gemini to refresh its open-tab list; the included instructions tell it to use current IDs on each request.
- To see exact install paths without changing files: `node install.mjs --help`.

`node install.mjs --workspace PATH --skip-register --no-open` is intended for CI/build verification; it does not register a host or open a browser.

## What the patches change

The patch series stays in the two upstream projects and addresses only integration gaps found in end-to-end use: Streamable HTTP defaults/permissions and CORS, per-session MCP server instances, controller-tab-aware tab selection, target tab ID and screenshot forwarding, Gemini result/hidden-tab handling, upload submission timing, download result lookup, Gemini’s string-serialized tab IDs/boolean parameters, a Windows-safe workspace build filter, and staging helper/worker/locale assets through WXT’s standard public-asset path without exposing the internal helpers to web pages. Upstream tools implement the actual browser actions.

Upstream revisions are pinned in `install.mjs`; review/update those pins and the patch series together when upstream changes.

## License and upstream attribution

The installer glue and test helper are MIT-licensed. The compatibility patches are applied to the upstream MIT-licensed repositories above; retain their copyright and license notices in the installed source trees. See [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
