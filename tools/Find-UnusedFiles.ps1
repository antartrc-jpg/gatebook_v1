param(
  [string]$SrcDir = 'apps\web\app'
)

$ErrorActionPreference = 'Stop'

function Rel([string]$p, [string]$root) {
  $rx = '^' + [regex]::Escape($root + [IO.Path]::DirectorySeparatorChar)
  return ([regex]::Replace($p, $rx, ''))
}

$root = (Resolve-Path $SrcDir).Path
if (-not (Test-Path -LiteralPath $root)) { throw "Source folder not found: $root" }

# 1) Alle TS/TSX-Dateien finden
$allFiles = Get-ChildItem -LiteralPath $root -Recurse -Include *.ts, *.tsx -File

# 2) Inhalt aller Dateien einmal einlesen
$allText = @{}
foreach ($f in $allFiles) {
  $allText[$f.FullName] = Get-Content -LiteralPath $f.FullName -Raw
}

# 3) Prüfen, ob Dateiname irgendwo importiert wird
$unused = @()
foreach ($f in $allFiles) {
  $name = [IO.Path]::GetFileNameWithoutExtension($f.Name)
  $rel  = Rel $f.FullName $root
  $imported = $false
  foreach ($kv in $allText.GetEnumerator()) {
    if ($kv.Key -eq $f.FullName) { continue }
    if ($kv.Value -match ("import .*" + [regex]::Escape($name))) {
      $imported = $true
      break
    }
  }
  if (-not $imported) {
    $unused += $rel
  }
}

Write-Host ""
Write-Host "=== Unused TS/TSX files (candidates) ==="
if ($unused.Count -eq 0) {
  Write-Host "(none found)"
} else {
  $unused | Sort-Object | ForEach-Object { Write-Host $_ }
}
