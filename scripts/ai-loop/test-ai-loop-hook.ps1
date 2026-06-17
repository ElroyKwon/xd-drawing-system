param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
)

$ErrorActionPreference = "Stop"

function Assert-PathExists {
  param(
    [Parameter(Mandatory=$true)][string]$Path,
    [Parameter(Mandatory=$true)][string]$Label
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Missing ${Label}: $Path"
  }
}

function Assert-FileContains {
  param(
    [Parameter(Mandatory=$true)][string]$Path,
    [Parameter(Mandatory=$true)][string]$Pattern,
    [Parameter(Mandatory=$true)][string]$Label
  )

  $content = Get-Content -LiteralPath $Path -Raw -Encoding UTF8
  if ($content -notmatch $Pattern) {
    throw "Missing ${Label} in ${Path}: ${Pattern}"
  }
}

function Assert-FileDoesNotContain {
  param(
    [Parameter(Mandatory=$true)][string]$Path,
    [Parameter(Mandatory=$true)][string]$Pattern,
    [Parameter(Mandatory=$true)][string]$Label
  )

  $content = Get-Content -LiteralPath $Path -Raw -Encoding UTF8
  if ($content -match $Pattern) {
    throw "Unexpected ${Label} in ${Path}: ${Pattern}"
  }
}

function Assert-AnyPathExists {
  param(
    [Parameter(Mandatory=$true)][string[]]$Paths,
    [Parameter(Mandatory=$true)][string]$Label
  )

  foreach ($path in $Paths) {
    if (Test-Path -LiteralPath $path) {
      return
    }
  }

  throw "Missing ${Label}: $($Paths -join ', ')"
}

$requiredDirectories = @(
  ".ai-loop",
  ".ai-loop\control\inbox",
  ".ai-loop\control\outbox",
  ".ai-loop\control\processed",
  ".ai-loop\workers\codex\inbox",
  ".ai-loop\workers\codex\running",
  ".ai-loop\workers\codex\results",
  ".ai-loop\workers\codex\processed",
  ".ai-loop\results",
  ".ai-loop\locks",
  ".ai-loop\state",
  ".ai-loop\logs",
  ".ai-loop\prompts"
)

foreach ($relativePath in $requiredDirectories) {
  Assert-PathExists -Path (Join-Path $ProjectRoot $relativePath) -Label $relativePath
}

$requiredFiles = @(
  ".ai-loop\README.md",
  ".ai-loop\prompts\baseline-review.md",
  ".ai-loop\state\loop-state.json",
  "scripts\ai-loop\run-next-ai-loop-request.ps1",
  "scripts\ai-loop\watch-ai-loop.ps1"
)

foreach ($relativePath in $requiredFiles) {
  Assert-PathExists -Path (Join-Path $ProjectRoot $relativePath) -Label $relativePath
}

Assert-FileContains -Path (Join-Path $ProjectRoot ".ai-loop\README.md") -Pattern "review-only" -Label "review-only protocol"
Assert-FileContains -Path (Join-Path $ProjectRoot ".ai-loop\prompts\baseline-review.md") -Pattern "Do not modify files" -Label "read-only worker instruction"
Assert-AnyPathExists -Paths @(
  (Join-Path $ProjectRoot ".ai-loop\control\inbox\0001-baseline-review.request.md"),
  (Join-Path $ProjectRoot ".ai-loop\control\processed\0001-baseline-review.request.md")
) -Label "0001 baseline review request"
Assert-FileContains -Path (Join-Path $ProjectRoot "scripts\ai-loop\run-next-ai-loop-request.ps1") -Pattern "codex\.cmd" -Label "Codex cmd invocation"
Assert-FileContains -Path (Join-Path $ProjectRoot "scripts\ai-loop\run-next-ai-loop-request.ps1") -Pattern "Start-Process" -Label "native command isolation"
Assert-FileContains -Path (Join-Path $ProjectRoot "scripts\ai-loop\run-next-ai-loop-request.ps1") -Pattern "LC_ALL" -Label "UTF-8 child process locale"
Assert-FileContains -Path (Join-Path $ProjectRoot "scripts\ai-loop\run-next-ai-loop-request.ps1") -Pattern "\[Console\]::OutputEncoding" -Label "UTF-8 console output"
Assert-FileContains -Path (Join-Path $ProjectRoot "scripts\ai-loop\run-next-ai-loop-request.ps1") -Pattern 'Remove-Item -LiteralPath \$promptPath' -Label "temporary prompt cleanup"
Assert-FileDoesNotContain -Path (Join-Path $ProjectRoot "scripts\ai-loop\run-next-ai-loop-request.ps1") -Pattern "\$prompt\s*\|\s*&" -Label "PowerShell pipeline native command invocation"
Assert-FileDoesNotContain -Path (Join-Path $ProjectRoot "scripts\ai-loop\run-next-ai-loop-request.ps1") -Pattern "-a\s+never" -Label "unsupported approval flag"
Assert-FileContains -Path (Join-Path $ProjectRoot "scripts\ai-loop\watch-ai-loop.ps1") -Pattern "run-next-ai-loop-request.ps1" -Label "compatibility wrapper"

Write-Output "AI loop hook scaffold verification passed."
