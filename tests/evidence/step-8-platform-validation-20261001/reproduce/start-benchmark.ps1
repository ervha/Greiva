$ErrorActionPreference='Stop'
$benchmarkRoot=(Get-Location).Path
$benchmarkExe=Join-Path $benchmarkRoot '.data/host-ime/builds/0.6.5-benchmark-release/greiva-poc.exe'
$benchmarkConfig=Join-Path ([Environment]::GetFolderPath('ApplicationData')) 'dev.greiva.poc.bench20261001'
if(@(Get-Process greiva-poc -ErrorAction SilentlyContinue).Count){throw 'Close the existing Greiva session before measuring'}
if(Test-Path -LiteralPath $benchmarkConfig){throw 'Benchmark config must not exist before first launch'}
if((Get-FileHash -LiteralPath $benchmarkExe -Algorithm SHA256).Hash.ToLowerInvariant() -ne '70e7f7298bda60abce5a5844a60f92fcac07361e1b37dbf92cc304f5fc53ea92'){throw 'Artifact identity mismatch'}
$benchmarkRun=Join-Path $benchmarkRoot '.data/host-ime/benchmark-first-launch'
New-Item -ItemType Directory -Force $benchmarkRun | Out-Null
$benchmarkUserData=Join-Path $benchmarkRun 'webview2'
if(Test-Path -LiteralPath $benchmarkUserData){throw 'Fresh WebView cache required'}
$benchmarkStarted=[DateTime]::UtcNow
$benchmarkWatch=[Diagnostics.Stopwatch]::StartNew()
$benchmarkProcess=Start-Process -FilePath $benchmarkExe -WorkingDirectory $benchmarkRoot -WindowStyle Hidden -PassThru -Environment @{WEBVIEW2_USER_DATA_FOLDER=$benchmarkUserData} -RedirectStandardOutput (Join-Path $benchmarkRun 'stdout.log') -RedirectStandardError (Join-Path $benchmarkRun 'stderr.log')
$benchmarkStartCallMs=$benchmarkWatch.Elapsed.TotalMilliseconds
[ordered]@{startedAt=$benchmarkStarted.ToString('o');processId=$benchmarkProcess.Id;startProcessCallMs=$benchmarkStartCallMs;version='0.6.5';build='release';identifier='dev.greiva.poc.bench20261001';initialPageId='01a0f900-0000-7000-8000-000000000001';appConfigExistedBefore=$false;freshWebViewCache=$true;executableSha256='70e7f7298bda60abce5a5844a60f92fcac07361e1b37dbf92cc304f5fc53ea92';sourceSha256='c0f39a8a19274ef4150c4c770189fce4b927e21befb9c542bb24402975846205';scope='Launch-call timing only. Main UI observation timestamp is separately recorded; includes cross-tool observation overhead.'}|ConvertTo-Json|Set-Content (Join-Path $benchmarkRun 'launch.json') -Encoding utf8
Write-Output $benchmarkStarted.ToString('o')
