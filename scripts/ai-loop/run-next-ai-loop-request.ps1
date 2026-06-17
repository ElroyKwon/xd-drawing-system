param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path,
  [switch]$Once,
  [switch]$DryRun,
  [int]$PollSeconds = 5
)

$ErrorActionPreference = "Stop"

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[Console]::InputEncoding = $utf8NoBom
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom
$env:LANG = "C.UTF-8"
$env:LC_ALL = "C.UTF-8"
$env:PYTHONUTF8 = "1"
$env:PYTHONIOENCODING = "utf-8"

function Ensure-Directory {
  param([Parameter(Mandatory=$true)][string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Force -Path $Path | Out-Null
  }
}

function Get-RequestId {
  param([Parameter(Mandatory=$true)][System.IO.FileInfo]$RequestFile)
  return [System.IO.Path]::GetFileNameWithoutExtension([System.IO.Path]::GetFileNameWithoutExtension($RequestFile.Name))
}

function Get-RequestMode {
  param([Parameter(Mandatory=$true)][string]$Content)
  $match = [regex]::Match($Content, "(?m)^mode:\s*(?<mode>[A-Za-z0-9_-]+)\s*$")
  if (-not $match.Success) {
    throw "Request is missing mode frontmatter."
  }
  return $match.Groups["mode"].Value
}

function Get-ModeConfig {
  param([Parameter(Mandatory=$true)][string]$Mode)

  switch ($Mode) {
    "review-only" {
      return [pscustomobject]@{
        Mode = "review-only"
        PromptFile = "baseline-review.md"
        Sandbox = "read-only"
      }
    }
    "validation-evidence" {
      return [pscustomobject]@{
        Mode = "validation-evidence"
        PromptFile = "validation-evidence.md"
        Sandbox = "workspace-write"
      }
    }
    "implementation" {
      return [pscustomobject]@{
        Mode = "implementation"
        PromptFile = "implementation.md"
        Sandbox = "workspace-write"
      }
    }
    default {
      throw "Unsupported mode '$Mode'. Supported modes: review-only, validation-evidence, implementation."
    }
  }
}

function Write-TextFile {
  param(
    [Parameter(Mandatory=$true)][string]$Path,
    [Parameter(Mandatory=$true)][string]$Content
  )
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

function Get-CodexCommand {
  $cmd = Get-Command "codex.cmd" -ErrorAction SilentlyContinue
  if ($cmd) {
    return $cmd.Source
  }

  $fallback = Get-Command "codex" -ErrorAction SilentlyContinue
  if ($fallback) {
    return $fallback.Source
  }

  throw "Codex CLI was not found on PATH."
}

function Invoke-AiLoopRequest {
  param([Parameter(Mandatory=$true)][System.IO.FileInfo]$RequestFile)

  $loopRoot = Join-Path $ProjectRoot ".ai-loop"
  $requestId = Get-RequestId -RequestFile $RequestFile
  $lockPath = Join-Path $loopRoot "locks\$requestId.lock"

  if (Test-Path -LiteralPath $lockPath) {
    Write-Output "Skipping locked request: $requestId"
    return
  }

  Write-TextFile -Path $lockPath -Content "started=$(Get-Date -Format o)`nrequest=$($RequestFile.FullName)`n"

  try {
    $requestContent = Get-Content -LiteralPath $RequestFile.FullName -Raw -Encoding UTF8
    $mode = Get-RequestMode -Content $requestContent
    $modeConfig = Get-ModeConfig -Mode $mode

    $workerInboxPath = Join-Path $loopRoot "workers\codex\inbox\$($RequestFile.Name)"
    $workerRunningPath = Join-Path $loopRoot "workers\codex\running\$($RequestFile.Name)"
    $workerProcessedPath = Join-Path $loopRoot "workers\codex\processed\$($RequestFile.Name)"
    $controlProcessedPath = Join-Path $loopRoot "control\processed\$($RequestFile.Name)"
    $workerResultPath = Join-Path $loopRoot "workers\codex\results\$requestId.result.md"
    $humanResultPath = Join-Path $loopRoot "results\$requestId.result.md"
    $eventPath = Join-Path $loopRoot "control\outbox\$requestId.done.md"
    $logPath = Join-Path $loopRoot "logs\$requestId.log"
    $templatePath = Join-Path $loopRoot "prompts\$($modeConfig.PromptFile)"
    $codexCommand = Get-CodexCommand

    Copy-Item -LiteralPath $RequestFile.FullName -Destination $workerInboxPath -Force
    Copy-Item -LiteralPath $RequestFile.FullName -Destination $workerRunningPath -Force

    $template = Get-Content -LiteralPath $templatePath -Raw -Encoding UTF8
    $prompt = $template + "`n`n---`n`n" + $requestContent

    if ($DryRun) {
      $dryRunResult = @"
# $requestId Result

Mode: $mode
Status: DRY-RUN
Prompt: $($modeConfig.PromptFile)
Sandbox: $($modeConfig.Sandbox)

The runner detected the request and would run:

~~~powershell
$codexCommand exec -C "$ProjectRoot" -s $($modeConfig.Sandbox) -o "$workerResultPath" -
~~~

No Codex worker was launched because -DryRun was set.
"@
      Write-TextFile -Path $workerResultPath -Content $dryRunResult
      Write-TextFile -Path $logPath -Content "dry-run=$(Get-Date -Format o)`nrequest=$($RequestFile.FullName)`n"
    } else {
      $promptPath = Join-Path $loopRoot "logs\$requestId.prompt.tmp.md"
      $stdoutPath = Join-Path $loopRoot "logs\$requestId.stdout.tmp.log"
      $stderrPath = Join-Path $loopRoot "logs\$requestId.stderr.tmp.log"

      Remove-Item -LiteralPath $stdoutPath, $stderrPath -Force -ErrorAction SilentlyContinue
      Write-TextFile -Path $promptPath -Content $prompt

      $arguments = @(
        "exec",
        "-C", $ProjectRoot,
        "-s", $modeConfig.Sandbox,
        "-o", $workerResultPath,
        "-"
      )

      try {
        $process = Start-Process `
          -FilePath $codexCommand `
          -ArgumentList $arguments `
          -RedirectStandardInput $promptPath `
          -RedirectStandardOutput $stdoutPath `
          -RedirectStandardError $stderrPath `
          -NoNewWindow `
          -Wait `
          -PassThru

        $stdout = if (Test-Path -LiteralPath $stdoutPath) { Get-Content -LiteralPath $stdoutPath -Raw -Encoding UTF8 } else { "" }
        $stderr = if (Test-Path -LiteralPath $stderrPath) { Get-Content -LiteralPath $stderrPath -Raw -Encoding UTF8 } else { "" }
        $log = @"
completed=$(Get-Date -Format o)
exit_code=$($process.ExitCode)
command=$codexCommand exec -C "$ProjectRoot" -s $($modeConfig.Sandbox) -o "$workerResultPath" -
mode=$mode
prompt=$($modeConfig.PromptFile)

--- stdout ---
$stdout

--- stderr ---
$stderr
"@
        Write-TextFile -Path $logPath -Content $log

        $hasResult = (Test-Path -LiteralPath $workerResultPath) -and ((Get-Item -LiteralPath $workerResultPath).Length -gt 0)
        if ($process.ExitCode -ne 0 -and -not $hasResult) {
          throw "codex exec failed with exit code $($process.ExitCode) and produced no result. See $logPath"
        }

        if (-not $hasResult) {
          throw "codex exec produced no result file. See $logPath"
        }
      } finally {
        Remove-Item -LiteralPath $promptPath, $stdoutPath, $stderrPath -Force -ErrorAction SilentlyContinue
      }
    }

    Copy-Item -LiteralPath $workerResultPath -Destination $humanResultPath -Force
    Move-Item -LiteralPath $workerRunningPath -Destination $workerProcessedPath -Force
    Move-Item -LiteralPath $RequestFile.FullName -Destination $controlProcessedPath -Force

    $event = @"
# $requestId Done

mode: $mode
result: $humanResultPath
worker_result: $workerResultPath
log: $logPath
completed: $(Get-Date -Format o)
"@
    Write-TextFile -Path $eventPath -Content $event
    Write-Output "Processed request: $requestId"
  } finally {
    Remove-Item -LiteralPath $lockPath -Force -ErrorAction SilentlyContinue
  }
}

$paths = @(
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

foreach ($relativePath in $paths) {
  Ensure-Directory -Path (Join-Path $ProjectRoot $relativePath)
}

do {
  $inboxPath = Join-Path $ProjectRoot ".ai-loop\control\inbox"
  $requests = Get-ChildItem -LiteralPath $inboxPath -Filter "*.request.md" -File | Sort-Object Name

  foreach ($request in $requests) {
    Invoke-AiLoopRequest -RequestFile $request
  }

  if ($Once) {
    break
  }

  Start-Sleep -Seconds $PollSeconds
} while ($true)
