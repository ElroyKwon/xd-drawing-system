param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path,
  [switch]$Once,
  [switch]$DryRun,
  [int]$PollSeconds = 5
)

$runner = Join-Path $PSScriptRoot "run-next-ai-loop-request.ps1"

Write-Warning "watch-ai-loop.ps1 is a compatibility wrapper. Use run-next-ai-loop-request.ps1 for AI terminal execution."

& powershell -ExecutionPolicy Bypass -File $runner `
  -ProjectRoot $ProjectRoot `
  -Once:$Once `
  -DryRun:$DryRun `
  -PollSeconds $PollSeconds

exit $LASTEXITCODE
