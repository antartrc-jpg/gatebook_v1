param(
  [string]$WebDir = 'apps\web'
)

$ErrorActionPreference = 'Stop'

function Section([string]$t) {
  Write-Host ''
  Write-Host ('=' * 78)
  Write-Host ("= " + $t)
  Write-Host ('=' * 78)
}

function Rel([string]$p, [string]$root) {
  if (-not $p) { return $p }
  $rx = '^' + [regex]::Escape($root + [IO.Path]::DirectorySeparatorChar)
  return ([regex]::Replace($p, $rx, ''))
}

# Paths
$root    = (Resolve-Path '.').Path
$appRoot = Join-Path $root $WebDir
$srcRoot = Join-Path $appRoot 'app'
if (-not (Test-Path -LiteralPath $srcRoot)) { throw "Web app folder not found: $srcRoot" }

# Root layout
$rootLayout = Join-Path $srcRoot 'layout.tsx'

# Patterns (simple text, no regex fuss)
$patterns = @(
  '<header',           # html header tag
  'AppTopbar',         # our topbar component
  'SignOutButton',     # logout button
  'className="fixed',  # typical fixed header
  "className='fixed",
  'className="sticky',
  "className='sticky",
  'top-0',
  'border-b',
  'backdrop-blur'
)

Section "1) Root Topbar usage in app/layout.tsx"
if (Test-Path -LiteralPath $rootLayout) {
  $imp = Select-String -Path $rootLayout -SimpleMatch -Pattern 'AppTopbar' -AllMatches
  if ($imp) {
    Write-Host "FOUND: AppTopbar in app/layout.tsx"
    $imp | ForEach-Object {
      ('{0}:{1}: {2}' -f (Rel $_.Path $root), $_.LineNumber, $_.Line.Trim())
    } | Out-Host
  } else {
    Write-Host "NOT FOUND: AppTopbar is not used in app/layout.tsx"
  }
} else {
  Write-Host ("MISSING: " + (Rel $rootLayout $root))
}

Section "2) Other layout.tsx files with header/topbar markers (should be empty)"
$layoutFiles = Get-ChildItem -LiteralPath $srcRoot -Recurse -Filter layout.tsx -File |
  Where-Object { $_.FullName -ne $rootLayout } |
  Sort-Object FullName -Unique

$dupLayouts = @()

if ($layoutFiles) {
  foreach ($f in $layoutFiles) {
    $hits = @()
    foreach ($p in $patterns) {
      $hits += Select-String -Path $f.FullName -SimpleMatch -Pattern $p -AllMatches -ErrorAction SilentlyContinue
    }
    $hits = $hits | Where-Object { $_ }
    if ($hits.Count -gt 0) {
      $dupLayouts += $f
      Write-Host ""
      Write-Host ("--- SUSPECT ---  " + (Rel $f.FullName $root)) -ForegroundColor Yellow
      $hits | ForEach-Object {
        ('{0}:{1}: {2}' -f (Rel $_.Path $root), $_.LineNumber, $_.Line.Trim())
      } | Out-Host
    }
  }
} else {
  Write-Host "(no additional layout.tsx files found)"
}

Section "3) Pages/components directly rendering AppTopbar (outside app/layout.tsx)"
$tsxFiles = Get-ChildItem -LiteralPath $srcRoot -Recurse -Filter *.tsx -File |
  Where-Object { $_.FullName -ne $rootLayout }
$topbarUsages = $tsxFiles | Select-String -SimpleMatch -Pattern 'AppTopbar' -AllMatches
if ($topbarUsages) {
  $topbarUsages | ForEach-Object {
    ('{0}:{1}: {2}' -f (Rel $_.Path $root), $_.LineNumber, $_.Line.Trim())
  } | Out-Host
} else {
  Write-Host "(no direct AppTopbar usage outside app/layout.tsx)"
}

Section "4) Summary"
("{0} other layout.tsx files contain header/topbar markers." -f $dupLayouts.Count) | Out-Host
if ($dupLayouts.Count -gt 0) {
  $dupLayouts | ForEach-Object { " - " + (Rel $_.FullName $root) } | Out-Host
}
