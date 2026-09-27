import { spawnSync } from 'node:child_process';
import { extensionIdFromPublicKey } from './scripts/extension-id.mjs';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = '0.1.0';
const PNPM_VERSION = '9.15.1';
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const CONFIG = {
  superassistant: {
    name: 'MCP-SuperAssistant',
    url: 'https://github.com/srbhptl39/MCP-SuperAssistant.git',
    ref: 'c26168ee2c5708a3a65ef5afd88cda1a97c81734',
    patch: path.join(ROOT, 'patches', 'MCP-SuperAssistant.patch'),
  },
  mcpChrome: {
    name: 'mcp-chrome',
    url: 'https://github.com/hangwin/mcp-chrome.git',
    ref: 'f48e71751e00bc09725c7e173423cff4f2ccd12a',
    patch: path.join(ROOT, 'patches', 'mcp-chrome.patch'),
  },
};

function parseArgs(argv) {
  const options = { skipRegister: false, noOpen: false, workspace: path.join(os.homedir(), '.gemini-use') };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--skip-register') options.skipRegister = true;
    else if (arg === '--no-open') options.noOpen = true;
    else if (arg === '--workspace') {
      if (!argv[i + 1]) throw new Error('--workspace needs a directory path');
      options.workspace = path.resolve(argv[++i]);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  return options;
}

function printHelp() {
  console.log(`Gemini-use installer ${VERSION}

Usage:
  node install.mjs [--workspace PATH] [--skip-register] [--no-open]

Options:
  --workspace PATH   Install the pinned upstream worktrees under PATH (default: ~/.gemini-use)
  --skip-register    Build only; do not write Native Messaging registration (for CI)
  --no-open          Do not open chrome://extensions after the build
  --help             Show this help
`);
}

const windows = process.platform === 'win32';
const shell = windows;

function run(command, args, { cwd, env = process.env, quiet = false, allowFailure = false } = {}) {
  if (!quiet) console.log(`\n> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd,
    env,
    stdio: quiet ? 'pipe' : 'inherit',
    encoding: 'utf8',
    windowsHide: true,
    shell,
  });
  if (result.error) {
    if (allowFailure) return { status: 1, output: '', error: result.error };
    throw result.error;
  }
  if (result.status !== 0 && !allowFailure) {
    const details = result.stderr || result.stdout || '';
    throw new Error(`${command} exited with ${result.status}${details ? `: ${details.trim()}` : ''}`);
  }
  return { status: result.status ?? 1, output: `${result.stdout || ''}${result.stderr || ''}`.trim() };
}

function commandAvailable(command, args = ['--version']) {
  return run(command, args, { quiet: true, allowFailure: true }).status === 0;
}

function requireNode() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 12)) {
    throw new Error(`Node.js >=22.12 is required; found ${process.versions.node}. Install Node.js 22 LTS and rerun.`);
  }
  if (!commandAvailable('git')) throw new Error('Git is required. Install Git, reopen the terminal, and rerun.');
  if (process.platform !== 'win32' && process.platform !== 'linux') {
    throw new Error('This installer supports Linux and Windows only.');
  }
  if (windows && !commandAvailable('bash')) {
    const candidates = [
      process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Git', 'bin'),
      process.env['ProgramFiles(x86)'] && path.join(process.env['ProgramFiles(x86)'], 'Git', 'bin'),
      process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'Git', 'bin'),
    ].filter(Boolean);
    const bashDir = candidates.find((candidate) => existsSync(path.join(candidate, 'bash.exe')));
    if (bashDir) process.env.PATH = `${bashDir}${path.delimiter}${process.env.PATH || ''}`;
    if (!commandAvailable('bash')) throw new Error('Git for Windows with Bash is required (the upstream SuperAssistant build uses Bash scripts).');
  }
}

function ensurePnpm() {
  const version = run('pnpm', ['--version'], { quiet: true, allowFailure: true });
  if (version.status === 0 && version.output === PNPM_VERSION) return;

  if (commandAvailable('corepack')) {
    run('corepack', ['prepare', `pnpm@${PNPM_VERSION}`, '--activate']);
  } else if (commandAvailable('npm')) {
    run('npm', ['install', '--global', `pnpm@${PNPM_VERSION}`]);
  } else {
    throw new Error(`pnpm ${PNPM_VERSION} is required. Install it with Corepack or npm, then rerun.`);
  }
  const installed = run('pnpm', ['--version'], { quiet: true, allowFailure: true });
  if (installed.status !== 0 || installed.output !== PNPM_VERSION) {
    throw new Error(`Could not activate pnpm ${PNPM_VERSION}; found ${installed.output || 'no pnpm'}.`);
  }
}

function gitHead(repoDir) {
  return run('git', ['-C', repoDir, 'rev-parse', 'HEAD'], { quiet: true }).output;
}

function prepareRepository(config, repoDir) {
  if (existsSync(repoDir)) {
    throw new Error(`Refusing to overwrite existing directory: ${repoDir}`);
  }
  mkdirSync(path.dirname(repoDir), { recursive: true });
  run('git', ['clone', '--no-checkout', config.url, repoDir]);
  run('git', ['-C', repoDir, 'checkout', '--detach', config.ref]);
  const checkedOut = gitHead(repoDir);
  if (checkedOut !== config.ref) throw new Error(`${config.name}: expected ${config.ref}, checked out ${checkedOut}`);
  run('git', ['-C', repoDir, 'apply', '--check', config.patch]);
  run('git', ['-C', repoDir, 'apply', config.patch]);
  console.log(`Applied Gemini-use compatibility patch to ${config.name}.`);
}

function prepareSources(workspace, mcpExtensionId) {
  const vendorDir = path.join(workspace, 'vendor');
  const statePath = path.join(workspace, 'install-state.json');
  const expected = { version: VERSION, superassistant: CONFIG.superassistant.ref, mcpChrome: CONFIG.mcpChrome.ref, mcpExtensionId };
  mkdirSync(workspace, { recursive: true });

  if (existsSync(statePath)) {
    const existing = JSON.parse(readFileSync(statePath, 'utf8'));
    if (JSON.stringify(existing) !== JSON.stringify(expected)) {
      throw new Error(`Existing install state in ${workspace} does not match this release. Back it up or use a new --workspace path.`);
    }
    for (const config of Object.values(CONFIG)) {
      const repoDir = path.join(vendorDir, config.name);
      if (!existsSync(repoDir) || gitHead(repoDir) !== config.ref) {
        throw new Error(`Installed source is missing or changed: ${repoDir}. Use a fresh workspace to avoid overwriting local changes.`);
      }
      console.log(`Reusing pinned ${config.name} source at ${config.ref}.`);
    }
    return { vendorDir, statePath };
  }

  if (existsSync(vendorDir)) {
    throw new Error(`Found ${vendorDir} without an install-state marker. Move it aside or choose a fresh --workspace path.`);
  }

  const installingPath = path.join(workspace, '.installing');
  writeFileSync(installingPath, JSON.stringify(expected, null, 2));
  const saDir = path.join(vendorDir, CONFIG.superassistant.name);
  const mcpDir = path.join(vendorDir, CONFIG.mcpChrome.name);
  try {
    prepareRepository(CONFIG.superassistant, saDir);
    prepareRepository(CONFIG.mcpChrome, mcpDir);
    const iconSource = path.join(ROOT, 'assets', 'mcp-superassistant-icon-16.png');
    const iconTarget = path.join(saDir, 'chrome-extension', 'public', 'icon-16.png');
    if (!existsSync(iconSource)) throw new Error(`Required build asset missing: ${iconSource}`);
    writeFileSync(iconTarget, readFileSync(iconSource));
    writeFileSync(statePath, JSON.stringify(expected, null, 2) + '\n');
    rmSync(installingPath, { force: true });
  } catch (error) {
    console.error(`Install source setup stopped. Partial files are under ${vendorDir}; remove that folder before retrying.`);
    throw error;
  }
  return { vendorDir, statePath };
}

function buildSources(vendorDir, extensionKey, mcpExtensionId) {
  const ciEnv = { ...process.env, CI: 'true' };
  delete ciEnv.NODE_ENV;

  const saDir = path.join(vendorDir, CONFIG.superassistant.name);
  run('pnpm', ['install', '--frozen-lockfile', '--prod=false'], { cwd: saDir, env: ciEnv });
  run('pnpm', ['build'], { cwd: saDir, env: ciEnv });
  const saManifest = path.join(saDir, 'dist', 'manifest.json');
  if (!existsSync(saManifest)) throw new Error(`SuperAssistant build did not produce ${saManifest}`);

  const mcpDir = path.join(vendorDir, CONFIG.mcpChrome.name);
  const mcpEnv = { ...ciEnv, CHROME_EXTENSION_KEY: extensionKey };
  run('pnpm', ['install', '--frozen-lockfile', '--ignore-scripts'], { cwd: mcpDir, env: mcpEnv });
  run('pnpm', ['build'], { cwd: mcpDir, env: mcpEnv });
  run('pnpm', ['--filter', 'mcp-chrome-bridge', 'rebuild', 'better-sqlite3'], { cwd: mcpDir, env: mcpEnv });

  const mcpExtensionDir = path.join(mcpDir, 'app', 'chrome-extension', '.output', 'chrome-mv3');
  const mcpManifestPath = path.join(mcpExtensionDir, 'manifest.json');
  const nativeCliPath = path.join(mcpDir, 'app', 'native-server', 'dist', 'cli.js');
  if (!existsSync(mcpManifestPath) || !existsSync(nativeCliPath)) {
    throw new Error('mcp-chrome build is incomplete; expected the unpacked extension and native CLI.');
  }
  const manifest = JSON.parse(readFileSync(mcpManifestPath, 'utf8'));
  if (manifest.key !== extensionKey) throw new Error('Built mcp-chrome manifest does not contain the pinned public key; extension ID would be unstable.');
  const actualId = extensionIdFromPublicKey(manifest.key);
  if (actualId !== mcpExtensionId) throw new Error(`Built extension ID ${actualId} did not match expected ID ${mcpExtensionId}.`);
  console.log(`Built mcp-chrome extension ID: ${actualId}`);
  return { saDir, mcpDir, mcpExtensionDir, nativeCliPath };
}

function verifyNativeRegistration(mcpExtensionId, mcpDir) {
  const hostName = 'com.chromemcp.nativehost';
  const manifestFile = `${hostName}.json`;
  const manifestRoot = windows
    ? (process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'))
    : path.join(os.homedir(), '.config');
  const browserDirs = windows
    ? [
        path.join(manifestRoot, 'Google', 'Chrome', 'NativeMessagingHosts'),
        path.join(manifestRoot, 'Chromium', 'NativeMessagingHosts'),
      ]
    : [
        path.join(manifestRoot, 'google-chrome', 'NativeMessagingHosts'),
        path.join(manifestRoot, 'chromium', 'NativeMessagingHosts'),
      ];
  const hostPath = path.resolve(mcpDir, 'app', 'native-server', 'dist', windows ? 'run_host.bat' : 'run_host.sh');
  const allowedOrigin = `chrome-extension://${mcpExtensionId}/`;

  for (const manifestDir of browserDirs) {
    const manifestPath = path.join(manifestDir, manifestFile);
    if (!existsSync(manifestPath)) throw new Error(`Native host registration missing: ${manifestPath}`);
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    if (manifest.name !== hostName || !manifest.allowed_origins?.includes(allowedOrigin)) {
      throw new Error(`Native host registration has the wrong extension origin: ${manifestPath}`);
    }
    if (path.resolve(manifest.path) !== hostPath) {
      throw new Error(`Native host registration points to ${manifest.path}, expected ${hostPath}`);
    }
  }

  if (windows) {
    const registrations = [
      {
        key: `HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${hostName}`,
        manifestPath: path.join(manifestRoot, 'Google', 'Chrome', 'NativeMessagingHosts', manifestFile),
      },
      {
        key: `HKCU\\Software\\Chromium\\NativeMessagingHosts\\${hostName}`,
        manifestPath: path.join(manifestRoot, 'Chromium', 'NativeMessagingHosts', manifestFile),
      },
    ];
    for (const registration of registrations) {
      const registry = run('reg.exe', ['query', registration.key, '/ve'], { quiet: true, allowFailure: true });
      const normalized = registry.output.toLowerCase();
      const expectedPath = registration.manifestPath.toLowerCase();
      if (registry.status !== 0 || !normalized.includes(expectedPath)) {
        throw new Error(`Windows Native Messaging registry entry is missing or incorrect: ${registration.key}`);
      }
    }
  }
  console.log('Verified Native Messaging registration for Chrome and Chromium.');
}

function openExtensionManager() {
  try {
    if (windows) run('cmd.exe', ['/d', '/s', '/c', 'start "" chrome://extensions/'], { allowFailure: true });
    else if (process.platform === 'linux' && commandAvailable('xdg-open')) run('xdg-open', ['chrome://extensions/'], { allowFailure: true });
  } catch {
    // The install is still complete; the URL and exact directories are printed below.
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) return printHelp();
  requireNode();
  ensurePnpm();
  const extensionKey = readFileSync(path.join(ROOT, 'keys', 'chrome-extension-public-key.base64'), 'utf8').trim();
  const mcpExtensionId = extensionIdFromPublicKey(extensionKey);
  console.log(`Pinned mcp-chrome extension ID: ${mcpExtensionId}`);
  const { vendorDir } = prepareSources(options.workspace, mcpExtensionId);
  const built = buildSources(vendorDir, extensionKey, mcpExtensionId);

  if (!options.skipRegister) {
    const env = { ...process.env, CHROME_MCP_EXTENSION_ID: mcpExtensionId };
    run(process.execPath, [built.nativeCliPath, 'register', '--browser', 'all'], { cwd: built.mcpDir, env });
    verifyNativeRegistration(mcpExtensionId, built.mcpDir);
  }

  console.log(`\nBuild complete. Load these unpacked extensions in Chrome/Chromium:`);
  console.log(`  MCP SuperAssistant: ${path.join(built.saDir, 'dist')}`);
  console.log(`  mcp-chrome:         ${built.mcpExtensionDir}`);
  console.log('Open chrome://extensions, enable Developer mode, then use Load unpacked for both folders.');
  console.log('After loading, open Gemini and hover MCP → Insert once in each new chat; follow-up browser actions run automatically.');
  if (!options.noOpen) openExtensionManager();
}

main().catch((error) => {
  console.error(`\nGemini-use installation failed: ${error?.stack || error}`);
  process.exitCode = 1;
});
