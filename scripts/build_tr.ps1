# English for the treebank sentences the app shows -> app/tr-data.js (window.PADY_TR = { slovak: english }).
# Pairs work/tr/in_N.json (Slovak, from tr_collect.ps1) with work/tr/out_N.json (English, same order; written by
# Claude, so the app marks them AI). Earlier rounds are kept in work/tr/en.json, so re-running tr_collect.ps1
# only asks for sentences that are new.
param([string]$Root = (Split-Path $PSScriptRoot -Parent))
$ErrorActionPreference = 'Stop'
$map = [ordered]@{}
if (Test-Path "$Root/work/tr/en.json") { foreach ($p in (Get-Content "$Root/work/tr/en.json" -Raw -Encoding utf8 | ConvertFrom-Json).PSObject.Properties) { $map[$p.Name] = $p.Value } }
foreach ($f in Get-ChildItem "$Root/work/tr/in_*.json") {
  $o = $f.FullName -replace 'in_(\d+)\.json$', 'out_$1.json'
  if (-not (Test-Path $o)) { Write-Warning "no $([IO.Path]::GetFileName($o)) yet"; continue }
  $sk = @(Get-Content $f.FullName -Raw -Encoding utf8 | ConvertFrom-Json); $en = @(Get-Content $o -Raw -Encoding utf8 | ConvertFrom-Json)
  if ($sk.Count -ne $en.Count) { throw "$($f.Name): $($sk.Count) Slovak vs $($en.Count) English" }
  for ($i = 0; $i -lt $sk.Count; $i++) { if ($en[$i]) { $map[$sk[$i].Trim()] = $en[$i].Trim() } }
}
$map | ConvertTo-Json -Compress | Set-Content "$Root/work/tr/en.json" -Encoding utf8
$js = '// English for treebank sentences: translated by Claude (AI). Built by scripts/build_tr.ps1.' + "`n" + 'window.PADY_TR = ' + ($map | ConvertTo-Json -Compress) + ';'
[IO.File]::WriteAllText("$Root/app/tr-data.js", $js, [Text.UTF8Encoding]::new($false))
"tr-data.js: $($map.Count) sentences, $([int]((Get-Item "$Root/app/tr-data.js").Length / 1KB)) KB"
