param([string]$AsepritePath = $env:ASEPRITE_PATH, [switch]$RebuildFromReferences)
$ErrorActionPreference = 'Stop'
if (-not $AsepritePath) {
  $AsepritePath = Join-Path $env:LOCALAPPDATA 'Programs\Aseprite\aseprite.exe'
}
if (-not (Test-Path -LiteralPath $AsepritePath -PathType Leaf)) {
  throw 'Aseprite is unavailable. Set ASEPRITE_PATH to the installed executable.'
}
$motionRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$luaScript = Join-Path $PSScriptRoot 'export-motion.lua'
New-Item -ItemType Directory -Force -Path (Join-Path $motionRoot 'art\animations') | Out-Null
$rebuildAlignment = $RebuildFromReferences
foreach ($stem in @('combat_attack_bow_flow','combat_attack_ribbon_flow','awakening_f06_flow')) {
  if (-not (Test-Path -LiteralPath (Join-Path $motionRoot "art\animations\$stem.aseprite"))) { $rebuildAlignment = $true }
}
$arguments = @('-b', '--script-param', ('"root={0}"' -f $motionRoot), '--script', ('"{0}"' -f $luaScript))
if ($RebuildFromReferences) {
  $arguments = @('-b', '--script-param', ('"root={0}"' -f $motionRoot), '--script-param', 'rebuild=true', '--script', ('"{0}"' -f $luaScript))
}
$process = Start-Process -FilePath $AsepritePath -ArgumentList $arguments -WindowStyle Hidden -Wait -PassThru
if ($process.ExitCode -ne 0) { throw "Aseprite export failed (exit $($process.ExitCode))." }
if ($rebuildAlignment) {
  foreach ($alignmentScript in @('stabilize-bow.lua','stabilize-silk.lua')) {
  $stabilizeScript = Join-Path $PSScriptRoot $alignmentScript
  $alignArguments = @('-b', '--script-param', ('"root={0}"' -f $motionRoot), '--script', ('"{0}"' -f $stabilizeScript))
  $alignment = Start-Process -FilePath $AsepritePath -ArgumentList $alignArguments -WindowStyle Hidden -Wait -PassThru
  if ($alignment.ExitCode -ne 0) { throw "Alignment failed (exit $($alignment.ExitCode))." }
  }
  $exportArguments = @('-b', '--script-param', ('"root={0}"' -f $motionRoot), '--script', ('"{0}"' -f $luaScript))
  $alignedExport = Start-Process -FilePath $AsepritePath -ArgumentList $exportArguments -WindowStyle Hidden -Wait -PassThru
  if ($alignedExport.ExitCode -ne 0) { throw "Aligned export failed (exit $($alignedExport.ExitCode))." }
}
$exports = @()
foreach ($stem in @('combat_attack_bow_flow','combat_attack_ribbon_flow','awakening_f06_flow')) {
  foreach ($extension in @('png','json')) {
    $output = Join-Path $motionRoot "apps\client\public\assets\vfx\$stem.$extension"
    if (-not (Test-Path -LiteralPath $output -PathType Leaf)) { throw "Missing export: $output" }
    if ($extension -eq 'json') {
      # Repository checkouts normalize text to LF; hash that portable representation.
      $jsonText = [System.IO.File]::ReadAllText($output).Replace("`r`n", "`n")
      [System.IO.File]::WriteAllText($output, $jsonText, [System.Text.UTF8Encoding]::new($false))
    }
    $exports += [ordered]@{ path="apps/client/public/assets/vfx/$stem.$extension"; sha256=(Get-FileHash -LiteralPath $output -Algorithm SHA256).Hash.ToLowerInvariant() }
  }
  $editable = Join-Path $motionRoot "art\animations\$stem.aseprite"
  $exports += [ordered]@{ path="art/animations/$stem.aseprite"; sha256=(Get-FileHash -LiteralPath $editable -Algorithm SHA256).Hash.ToLowerInvariant() }
}
$exports | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $motionRoot 'docs\assets\aseprite-motion-files.json')
Write-Output 'Three Aseprite sources and PNG/JSON sprite sheets exported and reimported successfully.'
