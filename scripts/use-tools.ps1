# Dot-source this script: . .\scripts\use-tools.ps1
# Toolchains live in the ignored .tools directory; system configuration stays untouched.
$greivaRoot = Split-Path -Parent $PSScriptRoot
$greivaTools = Join-Path $greivaRoot '.tools'
$greivaNode = Join-Path $greivaTools 'node-v24.19.0-win-x64'
$greivaNpm = Join-Path $greivaTools 'npm-runtime\node_modules\.bin'
if (!(Test-Path -LiteralPath (Join-Path $greivaNode 'node.exe')) -or
    !(Test-Path -LiteralPath (Join-Path $greivaNpm 'npm.cmd'))) {
    throw 'Project Node 24.19.0 / npm 11.9.0 toolchains are missing. See README.md.'
}
$env:CARGO_HOME = Join-Path $greivaTools 'cargo'
$env:RUSTUP_HOME = Join-Path $greivaTools 'rustup'
$env:npm_config_cache = Join-Path $greivaTools 'npm-cache'
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $greivaTools 'playwright'
$env:PATH = "$greivaNpm;$greivaNode;$(Join-Path $env:CARGO_HOME 'bin');$env:PATH"
