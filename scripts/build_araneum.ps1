# Araneum Slovacum VII (Ľ. Štúr Institute) lemma + POS frequency ranks, for the words we use only.
#   in : <Src>/.../araneum_top60k.tsv   (rank \t lemma \t POS \t freq \t ARF)   S noun, A adjective, V verb
#   out: data/freq_araneum.json         { "S": { lemma: rank }, "A": {...}, "V": {...} }
# build_bundle.ps1 blends this with the subtitle ranks (spoken, everyday) so the games start with words that are
# common in both: Araneum alone over-promotes web/news words (spoločnosť, európsky), subtitles over-promote homographs.
param([string]$Root = (Split-Path $PSScriptRoot -Parent), [string]$Src = 'C:\Users\ThomasHawkey\Desktop\Slovak App')
$ErrorActionPreference = 'Stop'
$want = @{ S = @{}; A = @{}; V = @{} }
foreach ($n in (Get-Content "$Root/data/nouns.json" -Raw | ConvertFrom-Json)) { $want.S[$n.word] = 1 }
foreach ($a in (Get-Content "$Root/data/adjectives.json" -Raw | ConvertFrom-Json)) { $want.A[$a.word] = 1 }
foreach ($f in 'work/conj_all.json', 'data/conj.json') { if (Test-Path "$Root/$f") { foreach ($v in (Get-Content "$Root/$f" -Raw | ConvertFrom-Json)) { $want.V[$v.w] = 1 } } }
$out = [ordered]@{ S = [ordered]@{}; A = [ordered]@{}; V = [ordered]@{} }
$file = (Get-ChildItem $Src -Recurse -Filter 'araneum_top60k.tsv' | Select-Object -First 1).FullName
foreach ($line in [IO.File]::ReadLines($file)) {
  $c = $line -split "`t"; $pos = $c[2]
  if ($out.Contains($pos) -and $want[$pos][$c[1]] -and -not $out[$pos].Contains($c[1])) { $out[$pos][$c[1]] = [int]$c[0] }
}
$out | ConvertTo-Json -Depth 3 -Compress | Set-Content "$Root/data/freq_araneum.json" -Encoding utf8
"nouns $($out.S.Count)/$($want.S.Count)  adjectives $($out.A.Count)/$($want.A.Count)  verbs $($out.V.Count)/$($want.V.Count)"
