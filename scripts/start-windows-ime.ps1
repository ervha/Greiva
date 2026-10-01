# Run a verified development executable, optionally with embedded assets. No host build.
[CmdletBinding()]
param([string]$ExecutablePath = '', [switch]$Embedded, [switch]$FreshWebview)
$ErrorActionPreference = 'Stop'
if (!$IsWindows) { throw 'Run this launcher on Windows with PowerShell 7.' }
$imeProject = Split-Path -Parent $PSScriptRoot
$imeExecutable = if ($ExecutablePath) { [IO.Path]::GetFullPath($ExecutablePath, $imeProject) } else { Join-Path $imeProject 'apps/client/src-tauri/target/debug/greiva-poc.exe' }
if (!$imeExecutable.StartsWith($imeProject + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Use a verified executable inside this project.' }
if (!(Test-Path -LiteralPath $imeExecutable)) {
    throw 'An existing Windows development executable is required. This launcher does not install or build toolchains.'
}
$imeRunning = @(Get-Process -Name greiva-poc -ErrorAction SilentlyContinue)
if ($imeRunning.Count) { throw 'Greiva is already running. Keep that test session rather than starting a duplicate.' }
if (!$Embedded) {
    $imeResponse = Invoke-WebRequest -Uri 'http://127.0.0.1:1420/' -TimeoutSec 10
    if ($imeResponse.StatusCode -ne 200) { throw 'Docker frontend is unavailable.' }
}
$imeStamp = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH-mm-ssZ')
$imeRun = Join-Path $imeProject ".data/host-ime/runs/$imeStamp"
$imeUserDataRelative = if ($FreshWebview) { ".data/host-ime/runs/$imeStamp/webview2" } else { '.data/host-ime/webview2' }
$imeUserData = Join-Path $imeProject $imeUserDataRelative
$imeDatabaseDirectory = Join-Path $imeProject '.data/host-ime/sqlite'
New-Item -ItemType Directory -Force -Path $imeRun, $imeUserData, $imeDatabaseDirectory | Out-Null
$imeFile = Get-Item -LiteralPath $imeExecutable
$imeMetadata = [ordered]@{
    startedAt = [DateTime]::UtcNow.ToString('o')
    execution = if ($Embedded) { 'Windows host; verified debug native shell with embedded production assets' } else { 'Windows host; existing debug native shell; Docker frontend' }
    executableSha256 = (Get-FileHash -LiteralPath $imeExecutable -Algorithm SHA256).Hash
    executableVersion = $imeFile.VersionInfo.ProductVersion
    executableLastWriteUtc = $imeFile.LastWriteTimeUtc.ToString('o')
    frontend = if ($Embedded) { 'embedded assets; no development server required' } else { 'http://127.0.0.1:1420/' }
    requestedWebviewUserData = $imeUserDataRelative
    requestedDebugDatabaseDirectory = '.data/host-ime/sqlite'
    checkpoint = (Get-Content -LiteralPath (Join-Path $imeProject 'VERSION') -Raw).Trim()
    gitCommit = (& git -C $imeProject rev-parse HEAD)
    stdout = 'stdout.log'
    stderr = 'stderr.log'
    hostToolchainInstalled = $false
    nativeRendering = 'Not verified'
    microsoftIme = 'Not run; requires actual keyboard composition and observed results'
}
# Hide the debug console; Tauri creates its own visible application window.
# The environment override applies only to this child process, not the host.
$imeProcess = Start-Process -FilePath $imeExecutable -WorkingDirectory $imeProject -WindowStyle Hidden -PassThru `
    -Environment @{ WEBVIEW2_USER_DATA_FOLDER = $imeUserData; GREIVA_TEST_DATA_DIR = $imeDatabaseDirectory } `
    -RedirectStandardOutput (Join-Path $imeRun 'stdout.log') -RedirectStandardError (Join-Path $imeRun 'stderr.log')
$imeMetadata.processId = $imeProcess.Id
$imeMetadata | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $imeRun 'launch.json') -Encoding utf8
Start-Sleep -Seconds 3
$imeProcess.Refresh()
if ($imeProcess.HasExited) {
    $imeMetadata.processState = 'Exited during startup'
    $imeMetadata.exitCode = $imeProcess.ExitCode
    $imeMetadata | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $imeRun 'launch.json') -Encoding utf8
    throw "Greiva exited during startup ($($imeProcess.ExitCode)). Inspect $imeRun/stderr.log before retrying."
}
$imeMetadata.processState = 'Running after initial startup check; rendering not verified'
$imeMetadata | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $imeRun 'launch.json') -Encoding utf8
Write-Output "Greiva process started: $($imeProcess.Id). Launch record: $imeRun"
Write-Output 'Observe the native window and execute docs/development/windows-host-ime.md. Process launch alone is not an IME Pass.'
