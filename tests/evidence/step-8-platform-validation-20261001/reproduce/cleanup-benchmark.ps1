$ErrorActionPreference='Stop'
if(@(Get-CimInstance Win32_Process -Filter "Name='greiva-poc.exe'").Count){throw 'Greiva must be closed'}
$cleanupRecords=@()
foreach($cleanupId in @('dev.greiva.poc.bench20261001','dev.greiva.poc.bench20261001b')){
 $cleanupExpected=[IO.Path]::GetFullPath((Join-Path ([Environment]::GetFolderPath('ApplicationData')) $cleanupId))
 $cleanupResolved=(Resolve-Path -LiteralPath $cleanupExpected).Path
 if(-not [StringComparer]::OrdinalIgnoreCase.Equals($cleanupResolved,$cleanupExpected)){throw 'Resolved benchmark path mismatch'}
 $cleanupBackup=Join-Path '.data/host-ime/benchmark-closed-data' $cleanupId
 $cleanupProof=Get-Content -LiteralPath (Join-Path $cleanupBackup 'snapshot-files.json') -Raw|ConvertFrom-Json
 if($cleanupProof.identifier -ne $cleanupId -or $cleanupProof.sourceDirectory -ne $cleanupResolved){throw 'Backup identity mismatch'}
 $cleanupFiles=@(Get-ChildItem -LiteralPath $cleanupResolved -Force)
 if($cleanupFiles.Count -ne $cleanupProof.fileCount){throw 'Benchmark contents changed'}
 foreach($cleanupFile in $cleanupFiles){
  if($cleanupFile.PSIsContainer -or $cleanupFile.Name -notin @('greiva.sqlite','greiva.sqlite-wal','greiva.sqlite-shm')){throw 'Unexpected benchmark file'}
  $cleanupEntry=@($cleanupProof.files|Where-Object name -eq $cleanupFile.Name)
  if($cleanupEntry.Count -ne 1){throw 'Backup entry missing'}
  $cleanupCopied=Join-Path $cleanupBackup $cleanupFile.Name
  if((Get-FileHash -LiteralPath $cleanupFile.FullName -Algorithm SHA256).Hash.ToLowerInvariant() -ne $cleanupEntry[0].sha256 -or (Get-FileHash -LiteralPath $cleanupCopied -Algorithm SHA256).Hash.ToLowerInvariant() -ne $cleanupEntry[0].sha256){throw 'Backup byte mismatch'}
 }
 foreach($cleanupFile in $cleanupFiles){Remove-Item -LiteralPath $cleanupFile.FullName -Force}
 Remove-Item -LiteralPath $cleanupResolved
 $cleanupRecords += [ordered]@{identifier=$cleanupId;backedUpAndByteChecked=$true;removedOwnGeneratedFiles=$cleanupFiles.Count;directoryRemoved=(-not (Test-Path -LiteralPath $cleanupResolved));recursiveDeleteUsed=$false}
}
[ordered]@{at=[DateTime]::UtcNow.ToString('o');records=$cleanupRecords;scope='Only the two initially absent benchmark directories created in this run; production dev.greiva.poc and project debug SQLite untouched. Local backups retained.'}|ConvertTo-Json -Depth 6|Set-Content .data/host-ime/benchmark-cleanup.json -Encoding utf8
Get-Content .data/host-ime/benchmark-cleanup.json
