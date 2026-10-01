$ErrorActionPreference = 'Stop'
$probeRoot = (Get-Location).Path
$probeBuild = Join-Path $probeRoot 'tests/evidence/runs/container/step8-ime-trace-build'
$build = Get-Content (Join-Path $probeBuild 'build.json') -Raw | ConvertFrom-Json
if (-not $build.artifact -or $build.baselineVersion -ne '0.6.5') { throw 'Probe build missing' }
if (@(Get-Process greiva-poc -ErrorAction SilentlyContinue).Count) { throw 'Greiva already running' }
$probeArtifactDir = Join-Path $probeRoot '.data/host-ime/builds/ime-trace-0.6.5'
New-Item -ItemType Directory -Path $probeArtifactDir -Force | Out-Null
$probeExe = Join-Path $probeArtifactDir 'greiva-poc.exe'
Copy-Item -LiteralPath (Join-Path $probeBuild 'greiva-poc.exe') -Destination $probeExe
if ((Get-FileHash -LiteralPath $probeExe -Algorithm SHA256).Hash.ToLowerInvariant() -ne $build.artifact.sha256) { throw 'Probe artifact mismatch' }
$probeRun = Join-Path $probeRoot ('.data/host-ime/trace-' + [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH-mm-ss-fffZ'))
New-Item -ItemType Directory -Path $probeRun | Out-Null
$process = Start-Process -FilePath $probeExe -WorkingDirectory $probeRoot -WindowStyle Hidden -PassThru -Environment @{ WEBVIEW2_USER_DATA_FOLDER=(Join-Path $probeRun 'webview2'); GREIVA_TEST_DATA_DIR=(Join-Path $probeRun 'sqlite') } -RedirectStandardOutput (Join-Path $probeRun 'stdout.log') -RedirectStandardError (Join-Path $probeRun 'stderr.log')
[ordered]@{ startedAt=[DateTime]::UtcNow.ToString('o'); processId=$process.Id; baselineVersion='0.6.5'; checkpoint=(Get-Content VERSION -Raw).Trim(); sourceCommit=(git rev-parse HEAD); sha256=$build.artifact.sha256; bytes=$build.artifact.bytes; testDirectory=$probeRun; scope='Diagnostic-only modified 0.6.5 candidate. Native operation and IME outcome are separate from launch/build. Fresh isolated SQLite and WebView cache; original failure fixtures untouched.' } | ConvertTo-Json | Set-Content (Join-Path $probeRun 'launch.json') -Encoding utf8
Write-Output $probeRun
