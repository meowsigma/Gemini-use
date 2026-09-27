$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  $winget = Get-Command winget -ErrorAction SilentlyContinue
  if (-not $winget) {
    throw 'Node.js >=22.12 is required. Install Node.js 22 LTS (or newer supported LTS) and rerun.'
  }
  Write-Host 'Installing Node.js LTS with winget...'
  winget install --id OpenJS.NodeJS.LTS --exact --accept-source-agreements --accept-package-agreements
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
  $node = Get-Command node -ErrorAction SilentlyContinue
}
if (-not $node) { throw 'Node.js installation did not become available in PATH. Open a new PowerShell window and rerun.' }

$versionText = (& node --version).Trim().TrimStart('v')
$versionParts = $versionText.Split('.') | ForEach-Object { [int]$_ }
if (($versionParts[0] -lt 22) -or (($versionParts[0] -eq 22) -and ($versionParts[1] -lt 12))) {
  throw "Node.js >=22.12 is required; found $versionText. Install Node.js 22 LTS or newer."
}
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'Git for Windows is required (it also provides Bash for the upstream build scripts).' }

if (-not (Get-Command bash -ErrorAction SilentlyContinue)) {
  $gitBashCandidates = @(
    (Join-Path $env:ProgramFiles 'Git\bin'),
    (Join-Path ${env:ProgramFiles(x86)} 'Git\bin'),
    (Join-Path $env:LOCALAPPDATA 'Programs\Git\bin')
  ) | Where-Object { $_ -and (Test-Path (Join-Path $_ 'bash.exe')) }
  if ($gitBashCandidates.Count -gt 0) { $env:Path = "$($gitBashCandidates[0]);$env:Path" }
}
if (-not (Get-Command bash -ErrorAction SilentlyContinue)) { throw 'Git for Windows Bash was not found. Reinstall Git for Windows with Bash enabled, then rerun.' }

& node (Join-Path $scriptDir 'install.mjs') @args
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
