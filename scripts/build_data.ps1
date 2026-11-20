# Stage 5: build data/nouns.json + data/adjectives.json and validate them three ways:
#   1. completeness + alphabet,  2. agreement with kaikki's (deduped) form list,  3. agreement with the hand-annotated UD treebank.
param([int]$AdjTop = 150, [string]$Root = (Split-Path $PSScriptRoot -Parent))
$ErrorActionPreference = 'Stop'
$alpha = '^[a-záäčďéíĺľňóôŕšťúýž]+$'
$cases = 'nom', 'gen', 'dat', 'acc', 'loc', 'ins'
$udCase = @{ Nom = 'nom'; Gen = 'gen'; Dat = 'dat'; Acc = 'acc'; Loc = 'loc'; Ins = 'ins' }
$genderOf = @{ 'm-pr' = 'm-pers'; 'm-an' = 'm-anim'; 'm-anml' = 'm-anim'; 'm-in' = 'm-inan'; 'f' = 'f'; 'n' = 'n' }

# ---------- kaikki form sets (for check 2) ----------
$kForms = @{}

# ---------- nouns ----------
$raw = Get-Content "$Root/work/nouns_full.json" -Raw | ConvertFrom-Json
$wanted = @{}; foreach ($n in $raw) { $wanted[$n.word] = 1 }
foreach ($line in [IO.File]::ReadLines("$Root/raw/sk.jsonl")) {
  if (-not $line.Contains('"sk-ndecl"')) { continue }
  $o = $line | ConvertFrom-Json
  if ($o.lang_code -ne 'sk' -or -not $wanted[$o.word]) { continue }
  if (-not $kForms[$o.word]) { $kForms[$o.word] = [Collections.Generic.HashSet[string]]::new() }
  foreach ($f in $o.forms) { [void]$kForms[$o.word].Add($f.form) }
}

$rejected = [Collections.Generic.List[string]]::new()
$nouns = foreach ($n in $raw) {
  $why = $null
  $g = $genderOf[$n.type]
  if (-not $g) { $why = "unknown type '$($n.type)'" }
  $sg = [ordered]@{}; $pl = [ordered]@{}; $alt = [ordered]@{}
  foreach ($c in $cases) {
    foreach ($num in 's', 'p') {
      $cell = @($n.forms."${c}_$num")
      if (-not $cell -or -not $cell[0]) { $why = "missing ${c}_$num"; continue }
      foreach ($f in $cell) { if ($f -cnotmatch $alpha) { $why = "bad chars '$f'" } }
      if ($kForms[$n.word]) { foreach ($f in $cell) { if (-not $kForms[$n.word].Contains($f)) { $why = "form '$f' not in kaikki list" } } }
      if ($num -eq 's') { $sg[$c] = $cell[0] } else { $pl[$c] = $cell[0] }
      if ($cell.Count -gt 1) { $alt["${c}_$num"] = @($cell[1..($cell.Count - 1)]) }
    }
  }
  if (-not $why -and $sg.nom -ne $n.word) { $why = "nom sg '$($sg.nom)' != lemma" }
  if ($why) { $rejected.Add("noun $($n.word): $why"); continue }
  [pscustomobject]@{ word = $n.word; gloss = $n.gloss; gender = $g; pattern = $n.pattern; freqRank = 0; sg = $sg; pl = $pl; alt = $alt }
}
$r = 0; foreach ($n in $nouns) { $n.freqRank = ++$r }

# ---------- adjectives ----------
$slotOf = {
  param($t)
  $c = ($t | Where-Object { $_ -in 'nominative', 'genitive', 'dative', 'accusative', 'locative', 'instrumental' } | Select-Object -First 1)
  if (-not $c) { return $null }
  $c = $c.Substring(0, 3).Replace('acc', 'acc')
  if ($t -contains 'plural' -or $t -contains 'nonvirile') {
    if ($c -in 'nom', 'acc') { return "pl_${c}_" + $(if ($t -contains 'virile') { 'vir' } else { 'nonvir' }) }
    return "pl_$c"
  }
  $gen = if ($t -contains 'feminine') { 'f' } elseif ($t -contains 'neuter') { 'n' } elseif ($t -contains 'masculine') { 'm' } else { return $null }
  if ($c -eq 'acc' -and $gen -eq 'm') { return 'sg_acc_m_' + $(if ($t -contains 'animate') { 'anim' } else { 'inan' }) }
  "sg_${c}_$gen"
}
$need = @()
foreach ($c in $cases) { foreach ($gg in 'm', 'f', 'n') { if (-not ($c -eq 'acc' -and $gg -eq 'm')) { $need += "sg_${c}_$gg" } } }
$need += 'sg_acc_m_anim', 'sg_acc_m_inan', 'pl_nom_vir', 'pl_nom_nonvir', 'pl_acc_vir', 'pl_acc_nonvir', 'pl_gen', 'pl_dat', 'pl_loc', 'pl_ins'

$adjRaw = Get-Content "$Root/work/adj_candidates.json" -Raw | ConvertFrom-Json
$seenA = @{}
$adjs = foreach ($a in $adjRaw) {
  if ($a.word -cnotmatch $alpha -or $seenA[$a.word]) { continue }
  $seenA[$a.word] = 1
  $s = [ordered]@{}; $why = $null
  foreach ($f in $a.forms) {
    if ($f.t -contains 'comparative' -or $f.t -contains 'superlative' -or $f.t -contains 'adverb') { continue }
    $k = & $slotOf $f.t
    if (-not $k) { continue }
    if ($f.f -cnotmatch $alpha) { $why = "bad chars '$($f.f)'"; break }
    if (-not $s[$k]) { $s[$k] = $f.f }
  }
  foreach ($k in $need) { if (-not $s[$k]) { $why = "missing $k" } }
  if (-not $why -and $s.sg_nom_m -ne $a.word) { $why = 'nom sg != lemma' }
  if ($why) { $rejected.Add("adj $($a.word): $why"); continue }
  $kind = if ($a.forms | Where-Object { $_.t -contains 'possessive' }) { 'possessive' } else { 'regular' }
  [pscustomobject]@{ word = $a.word; gloss = $a.gloss; kind = $kind; forms = $s }
}
# keep the top N, plus every adjective that occurs in a real adjective+noun pair (scripts/adj_pairs.ps1)
$pairAdj = @{}
if (Test-Path "$Root/work/adj_pairs.json") {
  foreach ($p in (Get-Content "$Root/work/adj_pairs.json" -Raw | ConvertFrom-Json).PSObject.Properties) { foreach ($x in $p.Value) { $pairAdj[$x.a] = 1 } }
}
$i = 0
$adjs = @($adjs | Where-Object { ($i++) -lt $AdjTop -or $pairAdj[$_.word] })

# ---------- check 3: UD treebank ----------
$nIdx = @{}; foreach ($n in $nouns) { $nIdx[$n.word] = $n }
$aIdx = @{}; foreach ($a in $adjs) { $aIdx[$a.word] = $a }
$stats = @{ nounHit = 0; nounMiss = 0; adjHit = 0; adjMiss = 0 }
$miss = @{}
foreach ($f in Get-ChildItem "$Root/raw/ud/*.conllu") {
  foreach ($l in [IO.File]::ReadLines($f.FullName)) {
    if (-not $l -or $l[0] -eq '#') { continue }
    $p = $l.Split("`t")
    if ($p.Length -lt 8 -or $p[0] -notmatch '^\d+$') { continue }
    $form = $p[1].ToLower(); $lemma = $p[2]; $feats = $p[5]
    if ($feats -notmatch 'Case=(\w+)') { continue }; $c = $udCase[$Matches[1]]; if (-not $c) { continue }
    $num = if ($feats -match 'Number=Plur') { 'p' } else { 's' }
    if ($p[3] -eq 'NOUN' -and $nIdx[$lemma]) {
      $n = $nIdx[$lemma]
      $ok = @($(if ($num -eq 's') { $n.sg[$c] } else { $n.pl[$c] })) + @($n.alt."${c}_$num")
      if ($ok -contains $form) { $stats.nounHit++ } else { $stats.nounMiss++; $miss["noun $lemma ${c}_$num"] = "$form (ours: $($ok -join '/'))" }
    }
    elseif ($p[3] -eq 'ADJ' -and $aIdx[$lemma] -and $feats -match 'Degree=Pos') {
      if ($aIdx[$lemma].forms.Values -contains $form) {
        # form exists; check it is in a slot compatible with case/number
        $cands = $aIdx[$lemma].forms.GetEnumerator() | Where-Object { $_.Value -eq $form } | ForEach-Object Key
        if ($cands | Where-Object { $_ -match "^$(if($num -eq 's'){'sg'}else{'pl'})_$c" }) { $stats.adjHit++ } else { $stats.adjMiss++; $miss["adj $lemma ${c}_$num"] = $form }
      } else { $stats.adjMiss++; $miss["adj $lemma ${c}_$num"] = "$form (absent)" }
    }
  }
}

New-Item -ItemType Directory -Force "$Root/data" | Out-Null
$nouns | ConvertTo-Json -Depth 5 | Set-Content "$Root/data/nouns.json" -Encoding utf8
$adjs | ConvertTo-Json -Depth 5 | Set-Content "$Root/data/adjectives.json" -Encoding utf8
$report = @(
  "nouns kept: $($nouns.Count)   adjectives kept: $($adjs.Count)   rejected: $($rejected.Count)"
  "treebank check - noun tokens: $($stats.nounHit) match / $($stats.nounMiss) mismatch;  adj tokens: $($stats.adjHit) match / $($stats.adjMiss) mismatch"
  ''; '--- rejected'; $rejected
  ''; '--- treebank mismatches'; ($miss.GetEnumerator() | Sort-Object Key | ForEach-Object { "$($_.Key): $($_.Value)" })
)
$report | Set-Content "$Root/data/validation_report.txt" -Encoding utf8
$report | Select-Object -First 2
