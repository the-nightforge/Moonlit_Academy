param([string]$AsepritePath=$env:ASEPRITE_PATH,[switch]$RebuildFromReferences)
$ErrorActionPreference='Stop'
if (-not $AsepritePath) { $AsepritePath='C:\Users\Hienq\AppData\Local\Programs\Aseprite\aseprite.exe' }
if (-not (Test-Path -LiteralPath $AsepritePath -PathType Leaf)) { throw 'Set ASEPRITE_PATH to an installed Aseprite executable.' }
$motionRoot=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
foreach ($folder in @('art\animations','docs\reviews\assets')) { New-Item -ItemType Directory -Force -Path (Join-Path $motionRoot $folder) | Out-Null }
$arguments=@('-b','--script-param',('"root={0}"' -f $motionRoot))
if ($RebuildFromReferences) { $arguments+=@('--script-param','rebuild=true') }
$arguments+=@('--script',('"{0}"' -f (Join-Path $PSScriptRoot 'export-motion-library.lua')))
$logFolder=Join-Path $motionRoot '.tmp\motion-library-export'
New-Item -ItemType Directory -Force -Path $logFolder | Out-Null
$stdout=Join-Path $logFolder 'stdout.txt'
$stderr=Join-Path $logFolder 'stderr.txt'
$process=Start-Process -FilePath $AsepritePath -ArgumentList $arguments -WindowStyle Hidden -Wait -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
if ($process.ExitCode -ne 0) {
  Get-Content -LiteralPath $stdout -Tail 8
  Get-Content -LiteralPath $stderr -Tail 8
  throw "Aseprite library export failed: $($process.ExitCode)"
}
$config=Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot 'motion-library.config.json') | ConvertFrom-Json
$exports=@()
foreach ($asset in $config.assets) {
  foreach ($relative in @("apps/client/public/assets/vfx/$($asset.stem).png","apps/client/public/assets/vfx/$($asset.stem).json","art/animations/$($asset.stem).aseprite")) {
    $output=Join-Path $motionRoot $relative
    if (-not (Test-Path -LiteralPath $output -PathType Leaf)) { throw "Missing export: $relative" }
    if ($relative.EndsWith('.json')) {
      $normalized=[System.IO.File]::ReadAllText($output).Replace("`r`n","`n")
      [System.IO.File]::WriteAllText($output,$normalized,[System.Text.UTF8Encoding]::new($false))
    }
    $exports+=[ordered]@{path=$relative;sha256=(Get-FileHash -LiteralPath $output -Algorithm SHA256).Hash.ToLowerInvariant()}
  }
}
$exports | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $motionRoot 'docs\assets\motion-library-files.json')
Write-Output '49 Aseprite sources and PNG/JSON sheets exported and reimported.'
