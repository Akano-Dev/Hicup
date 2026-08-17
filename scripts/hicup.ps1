<#
  Hicup launcher logic. Driven by Hicup.bat — see there for usage.

  The server is started with Start-Process from this script, which then exits.
  Node is left with no living parent, so closing VS Code or the terminal that
  launched it cannot take it down.
#>
[CmdletBinding()]
param(
  [ValidateSet('start', 'stop', 'restart', 'status', 'rebuild', 'autostart', 'autostop')]
  [string]$Action = 'start'
)

$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot
$Port = if ($env:HICUP_PORT) { $env:HICUP_PORT } else { '5180' }
$Url = "http://localhost:$Port"
$StateDir = Join-Path $Root '.hicup'
$PidFile = Join-Path $StateDir 'server.pid'
$LogFile = Join-Path $StateDir 'server.log'
$ErrFile = Join-Path $StateDir 'server.err.log'
$Startup = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup\Hicup.lnk'

Set-Location $Root
if (-not (Test-Path $StateDir)) { New-Item -ItemType Directory -Path $StateDir | Out-Null }

function Write-Info($message) { Write-Host "  $message" }

function Get-ServerProcess {
  if (-not (Test-Path $PidFile)) { return $null }
  $recorded = (Get-Content $PidFile -Raw).Trim()
  if (-not $recorded) { return $null }
  $proc = Get-Process -Id $recorded -ErrorAction SilentlyContinue
  # Guard against a recycled PID belonging to something else entirely.
  if ($proc -and $proc.ProcessName -eq 'node') { return $proc }
  return $null
}

function Test-Port {
  try {
    $client = [System.Net.Sockets.TcpClient]::new()
    $ok = $client.ConnectAsync('127.0.0.1', [int]$Port).Wait(400)
    $client.Close()
    return $ok
  } catch { return $false }
}

function Start-Hicup {
  $existing = Get-ServerProcess
  if ($existing) {
    Write-Info "Hicup is already running at $Url  (PID $($existing.Id))"
    Start-Process $Url
    return
  }

  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Info 'Node.js was not found on your PATH.'
    Write-Info 'Install it from https://nodejs.org and run this again.'
    exit 1
  }

  if (Test-Port) {
    Write-Info "Something is already listening on port $Port."
    Write-Info "Set HICUP_PORT to use a different one, or stop the other program."
    exit 1
  }

  if (-not (Test-Path (Join-Path $Root 'node_modules'))) {
    Write-Info 'Installing dependencies (one time only)...'
    npm install
    if ($LASTEXITCODE -ne 0) { exit 1 }
  }

  if (-not (Test-Path (Join-Path $Root 'dist\index.html'))) {
    Write-Info 'Building Hicup (one time only)...'
    npm run build
    if ($LASTEXITCODE -ne 0) { exit 1 }
  }

  Write-Info 'Starting Hicup...'
  $env:HICUP_PORT = $Port
  $proc = Start-Process -FilePath 'node' -ArgumentList 'scripts/serve.mjs' `
    -WorkingDirectory $Root -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput $LogFile -RedirectStandardError $ErrFile
  $proc.Id | Set-Content -Path $PidFile -Encoding ascii

  $deadline = (Get-Date).AddSeconds(20)
  while ((Get-Date) -lt $deadline -and -not (Test-Port)) {
    if ($proc.HasExited) { break }
    Start-Sleep -Milliseconds 150
  }

  if (-not (Test-Port)) {
    Write-Info 'Hicup did not come up. Log output:'
    foreach ($file in @($ErrFile, $LogFile)) {
      if (Test-Path $file) { Get-Content $file -Tail 15 | ForEach-Object { Write-Host "    $_" } }
    }
    Remove-Item $PidFile -ErrorAction SilentlyContinue
    exit 1
  }

  Start-Process $Url
  Write-Host ''
  Write-Info "Hicup is running at $Url  (PID $($proc.Id))"
  Write-Info 'It stays running in the background - closing this window is fine.'
  Write-Info 'Stop it any time with:  Hicup.bat stop'
  Write-Host ''
}

function Stop-Hicup {
  $proc = Get-ServerProcess
  if (-not $proc) {
    Write-Info 'Hicup is not running.'
    Remove-Item $PidFile -ErrorAction SilentlyContinue
    return
  }
  Stop-Process -Id $proc.Id -Force
  Remove-Item $PidFile -ErrorAction SilentlyContinue
  Write-Info 'Hicup stopped.'
}

switch ($Action) {
  'start' { Start-Hicup }
  'stop' { Stop-Hicup }
  'restart' { Stop-Hicup; Start-Sleep -Milliseconds 400; Start-Hicup }
  'status' {
    $proc = Get-ServerProcess
    if ($proc) { Write-Info "Hicup is running at $Url  (PID $($proc.Id))" }
    else { Write-Info 'Hicup is not running.' }
  }
  'rebuild' {
    Write-Info 'Rebuilding from source...'
    npm run build
    if ($LASTEXITCODE -ne 0) { exit 1 }
    Stop-Hicup
    Start-Sleep -Milliseconds 400
    Start-Hicup
  }
  'autostart' {
    $shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut($Startup)
    $shortcut.TargetPath = Join-Path $Root 'Hicup.bat'
    $shortcut.Arguments = 'start'
    $shortcut.WorkingDirectory = $Root
    $shortcut.WindowStyle = 7
    $shortcut.Description = 'Start Hicup in the background'
    $shortcut.Save()
    Write-Info 'Hicup will now start automatically when Windows starts.'
    Write-Info 'Undo with:  Hicup.bat autostop'
  }
  'autostop' {
    if (Test-Path $Startup) { Remove-Item $Startup -Force }
    Write-Info 'Hicup will no longer start automatically.'
  }
}
