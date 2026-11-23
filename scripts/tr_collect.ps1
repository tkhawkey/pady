# Collect every treebank sentence the app shows (Vyfarbi vetu, verb sentences, pronouns, Pasca, Magnet examples and
# Magnet Tvar) into work/tr/in.json, and split it into chunks for translating. The treebank has no English; the
# translations (work/tr/out_*.json, written by Claude) are bundled by build_bundle.ps1 and marked AI in the app.
param([string]$Root = (Split-Path $PSScriptRoot -Parent), [int]$Chunks = 6)
$ErrorActionPreference = 'Stop'
$t = Get-Content "$Root/app/data.js" -Raw -Encoding utf8
$D = $t.Substring($t.IndexOf('{')).TrimEnd().TrimEnd(';') | ConvertFrom-Json
# token arrays: [form, ..., noSpaceAfter] with noSpaceAfter as the last element
function Join-Toks($toks) {
  $sb = [Text.StringBuilder]::new()
  foreach ($x in $toks) { [void]$sb.Append($x[0]); if (-not $x[$x.Count - 1]) { [void]$sb.Append(' ') } }
  $sb.ToString().Trim()
}
$seen = [ordered]@{}
function Add-S([string]$s) { $s = $s.Trim(); if ($s -and -not $seen.Contains($s)) { $seen[$s] = 1 } }
foreach ($s in $D.sents) { Add-S (Join-Toks $s) }
foreach ($s in $D.vsents) { Add-S (Join-Toks $s) }
foreach ($s in $D.prons) { Add-S (Join-Toks $s.t) }
foreach ($s in $D.traps) { Add-S (Join-Toks $s.t) }
foreach ($v in $D.verbs) { foreach ($f in $v.fr) { foreach ($x in @($f.ex)) { if ($x) { Add-S $x } }; foreach ($z in @($f.cz)) { if ($z.t) { Add-S $z.t } } } }
$have = @{}
if (Test-Path "$Root/work/tr/en.json") {
  foreach ($p in (Get-Content "$Root/work/tr/en.json" -Raw -Encoding utf8 | ConvertFrom-Json).PSObject.Properties) { $have[$p.Name] = 1 }
}
New-Item -ItemType Directory -Force "$Root/work/tr" | Out-Null
$all = @($seen.Keys)
$todo = @($all | Where-Object { -not $have[$_] })
"sentences: $($all.Count)  already translated: $($all.Count - $todo.Count)  to do: $($todo.Count)"
$per = [Math]::Ceiling($todo.Count / [Math]::Max(1, $Chunks))
for ($c = 0; $c -lt $Chunks -and $c * $per -lt $todo.Count; $c++) {
  $part = $todo[($c * $per)..([Math]::Min($todo.Count, ($c + 1) * $per) - 1)]
  ConvertTo-Json @($part) | Set-Content "$Root/work/tr/in_$($c + 1).json" -Encoding utf8
  "  in_$($c + 1).json: $($part.Count)"
}
