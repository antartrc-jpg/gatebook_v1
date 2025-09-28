param(
  [string]$RootDir = '.',
  [int]$MaxDepth = 6
)

$ErrorActionPreference = 'Stop'

function Show-Tree {
  param(
    [string]$Path,
    [string]$Prefix = '',
    [int]$Depth = 0
  )

  if ($Depth -ge $MaxDepth) { return }

  $items = Get-ChildItem -LiteralPath $Path | Sort-Object { !$_.PSIsContainer }, Name
  $count = $items.Count
  for ($i=0; $i -lt $count; $i++) {
    $item = $items[$i]
    $isLast = ($i -eq $count-1)
    $connector = if ($isLast) { '└─' } else { '├─' }
    $line = $Prefix + $connector + $item.Name
    Write-Host $line

    if ($item.PSIsContainer) {
      if ($isLast) {
        $newPrefix = $Prefix + '  '
      } else {
        $newPrefix = $Prefix + '│ '
      }
      Show-Tree -Path $item.FullName -Prefix $newPrefix -Depth ($Depth+1)
    }
  }
}

Write-Host "Repository tree from: $((Resolve-Path $RootDir).Path)"
Show-Tree -Path (Resolve-Path $RootDir).Path
