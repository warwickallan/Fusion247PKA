# WP-B15-1 acceptance runtime — starts the AsdAIr poller from the BRANCH HEAD worktree
# (C:\Fusion247PKA-b15) so the confirmation-card code runs live. Stops the canonical-main
# poller first. Written by Larry 2026-08-08; run by Warwick because the auto-mode classifier
# blocks Larry starting processes with secrets-store env arguments.
$live = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object { $_.CommandLine -match "runtime\.js --watch" }
if ($live) { $live | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }; Start-Sleep -Seconds 2 }
Start-Process -FilePath "C:\Program Files\nodejs\node.exe" `
  -ArgumentList '"--env-file=C:\.fusion247\.env keys\shopper.env.txt"','--env-file=C:\.fusion247\asdair.env','C:\Fusion247PKA-b15\services\asdair\pipeline-runtime\ensure-asdair-runtime.mjs' `
  -WorkingDirectory "C:\Fusion247PKA-b15\services\asdair\pipeline-runtime" -WindowStyle Hidden
Start-Sleep -Seconds 25
$new = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object { $_.CommandLine -match "runtime\.js --watch" }
if ($new) { $new | ForEach-Object { Write-Output "ACCEPTANCE RUNTIME UP: PID $($_.ProcessId) -> $($_.CommandLine)" } } else { Write-Output "RUNTIME NOT DETECTED YET - Larry will verify" }
