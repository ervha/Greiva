# Guest-only helper. Never installs tools globally or changes system PATH.
$ErrorActionPreference = 'Stop'
$vmMachine = Get-CimInstance Win32_ComputerSystem
if ($vmMachine.Model -notmatch 'Virtual|VMware|KVM|QEMU|HVM|Parallels') {
    throw 'Run this script inside a Windows VM. Host execution is disabled.'
}
$vmRoot = Split-Path -Parent $PSScriptRoot
$vmTools = Join-Path $vmRoot '.tools'
New-Item -ItemType Directory -Force -Path $vmTools | Out-Null
$vmNodeArchive = Join-Path $vmTools 'node-v24.19.0-win-x64.zip'
$vmNodeHashes = Join-Path $vmTools 'node-SHASUMS256.txt'
Invoke-WebRequest -Uri 'https://nodejs.org/dist/v24.19.0/SHASUMS256.txt' -OutFile $vmNodeHashes
Invoke-WebRequest -Uri 'https://nodejs.org/dist/v24.19.0/node-v24.19.0-win-x64.zip' -OutFile $vmNodeArchive
$vmNodeExpected = ((Get-Content -LiteralPath $vmNodeHashes | Where-Object { $_ -match ' node-v24.19.0-win-x64.zip$' }) -split '\s+')[0]
if (!$vmNodeExpected -or (Get-FileHash -LiteralPath $vmNodeArchive -Algorithm SHA256).Hash -ne $vmNodeExpected) {
    throw 'Node archive checksum mismatch'
}
Expand-Archive -LiteralPath $vmNodeArchive -DestinationPath $vmTools -Force
$vmNode = Join-Path $vmTools 'node-v24.19.0-win-x64\node.exe'
$vmBootstrapNpm = Join-Path $vmTools 'node-v24.19.0-win-x64\node_modules\npm\bin\npm-cli.js'
& $vmNode $vmBootstrapNpm install --prefix (Join-Path $vmTools 'npm-runtime') npm@11.9.0 --cache (Join-Path $vmTools 'npm-cache') --ignore-scripts --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw 'Project npm install failed' }
$env:CARGO_HOME = Join-Path $vmTools 'cargo'
$env:RUSTUP_HOME = Join-Path $vmTools 'rustup'
$vmRustInstaller = Join-Path $vmTools 'rustup-init.exe'
Invoke-WebRequest -Uri 'https://static.rust-lang.org/rustup/dist/x86_64-pc-windows-msvc/rustup-init.exe' -OutFile $vmRustInstaller
Invoke-WebRequest -Uri 'https://static.rust-lang.org/rustup/dist/x86_64-pc-windows-msvc/rustup-init.exe.sha256' -OutFile "$vmRustInstaller.sha256"
$vmRustExpected = ((Get-Content -LiteralPath "$vmRustInstaller.sha256") -split '\s+')[0]
if (!$vmRustExpected -or (Get-FileHash -LiteralPath $vmRustInstaller -Algorithm SHA256).Hash -ne $vmRustExpected) {
    throw 'Rust installer checksum mismatch'
}
& $vmRustInstaller -y --no-modify-path --profile minimal --default-toolchain 1.98.1
if ($LASTEXITCODE -ne 0) { throw 'Project Rust install failed' }
Write-Output 'Guest toolchains ready. Dot-source scripts/use-tools.ps1, then run npm.cmd ci and npm.cmd run desktop.'
