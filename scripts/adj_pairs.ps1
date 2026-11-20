# Real adjective + noun pairs from the hand-annotated UD treebank (amod relations),
# kept only where we have the noun's table and the adjective's full declension.
# Output: work/adj_pairs.json  { noun: [ {a: adjective, n: count}, ... ] }
param([string]$Root = (Split-Path $PSScriptRoot -Parent))
$ErrorActionPreference = 'Stop'

$nouns = @{}; foreach ($n in (Get-Content "$Root/data/nouns.json" -Raw | ConvertFrom-Json)) { $nouns[$n.word] = 1 }
$adjOk = @{}
foreach ($a in (Get-Content "$Root/work/adj_candidates.json" -Raw | ConvertFrom-Json)) {
  if ($a.word -cmatch '^[a-záäčďéíĺľňóôŕšťúýž]+$' -and $a.forms.Count -ge 27) { $adjOk[$a.word] = 1 }
}

$pairs = @{}
function Add-Sentence($toks) {
  $byId = @{}; foreach ($t in $toks) { $byId[$t.id] = $t }
  foreach ($t in $toks) {
    if ($t.rel -ne 'amod' -or $t.upos -ne 'ADJ') { continue }
    if ($t.feats -notmatch 'Degree=Pos' -or $t.feats -match 'Polarity=Neg') { continue }   # plain, non-negated
    $h = $byId[$t.head]
    if (-not $h -or $h.upos -ne 'NOUN' -or -not $nouns[$h.lemma] -or -not $adjOk[$t.lemma]) { continue }
    $k = "$($h.lemma)|$($t.lemma)"
    $pairs[$k]++
  }
}
foreach ($f in Get-ChildItem "$Root/raw/ud/*.conllu") {
  $toks = [Collections.Generic.List[object]]::new()
  foreach ($l in [IO.File]::ReadLines($f.FullName)) {
    if ($l -eq '') { if ($toks.Count) { Add-Sentence $toks }; $toks = [Collections.Generic.List[object]]::new(); continue }
    if ($l[0] -eq '#') { continue }
    $p = $l.Split("`t"); if ($p[0] -notmatch '^\d+$') { continue }
    $toks.Add([pscustomobject]@{ id = $p[0]; lemma = $p[2]; upos = $p[3]; feats = $p[5]; head = $p[6]; rel = $p[7] })
  }
  if ($toks.Count) { Add-Sentence $toks }
}

$byNoun = [ordered]@{}
$pairs.GetEnumerator() | Sort-Object Value -Descending | ForEach-Object {
  $n, $a = $_.Key.Split('|')
  if (-not $byNoun[$n]) { $byNoun[$n] = [Collections.Generic.List[object]]::new() }
  $byNoun[$n].Add([ordered]@{ a = $a; n = $_.Value })
}
$byNoun | ConvertTo-Json -Depth 4 | Set-Content "$Root/work/adj_pairs.json" -Encoding utf8
$adjs = $pairs.Keys | ForEach-Object { $_.Split('|')[1] } | Sort-Object -Unique
"pairs: $($pairs.Count)  nouns covered: $($byNoun.Count) / $($nouns.Count)  adjectives used: $($adjs.Count)"
$byNoun.GetEnumerator() | Select-Object -First 25 | ForEach-Object { "$($_.Key): " + (($_.Value | Select-Object -First 5 | ForEach-Object { "$($_.a)($($_.n))" }) -join ', ') }
