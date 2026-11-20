# Homograph check: how much of each noun's frequency really belongs to it?
# A form shared with another word (stopy = stop's plural AND stopa's plural) gets its subtitle frequency
# split between the words: by real usage in the hand-annotated UD treebank when it has >= 3 examples,
# otherwise evenly. Output: work/noun_ownership.json + a readable report.
param([string]$Root = (Split-Path $PSScriptRoot -Parent))
$ErrorActionPreference = 'Stop'

$nouns = Get-Content "$Root/data/nouns.json" -Raw | ConvertFrom-Json
$formsOf = @{}; $want = [Collections.Generic.HashSet[string]]::new()
foreach ($n in $nouns) {
  $fs = [Collections.Generic.HashSet[string]]::new()
  foreach ($v in @($n.sg.PSObject.Properties.Value) + @($n.pl.PSObject.Properties.Value)) { [void]$fs.Add($v) }
  foreach ($p in $n.alt.PSObject.Properties) { foreach ($v in $p.Value) { [void]$fs.Add($v) } }
  $formsOf[$n.word] = $fs
  foreach ($f in $fs) { [void]$want.Add($f) }
}

# 1. subtitle frequency
$freq = @{}
foreach ($line in [IO.File]::ReadLines("$Root/raw/sk_50k.txt")) { $p = $line.Split(' '); if ($p.Length -eq 2) { $freq[$p[0]] = [long]$p[1] } }

# 2. which Wiktionary lemmas own each of our forms.
#    - only the entry's own inflection table counts (not synonyms, derived terms, etc.)
#    - "form-of" pages (e.g. the page "ulici" = dative of ulica) are traced back to their lemma
$owners = @{}   # form -> HashSet of "lemma|pos"
function Add-Owner($f, $key) {
  if (-not $want.Contains($f)) { return }
  if (-not $owners[$f]) { $owners[$f] = [Collections.Generic.HashSet[string]]::new() }
  [void]$owners[$f].Add($key)
}
$reWord = [regex]'"word": "([^"]+)", "lang": "Slovak"'
$reFormQ = [regex]'"form": "([^"]+)"'
$skipPos = 'name', 'phrase', 'proverb', 'abbrev', 'character', 'symbol', 'prefix', 'suffix'
foreach ($line in [IO.File]::ReadLines("$Root/raw/sk.jsonl")) {
  $wm = $reWord.Match($line); if (-not $wm.Success) { continue }
  $head = $wm.Groups[1].Value
  # cheap prefilter: does this line mention any of our forms as its headword or as a form?
  $hit = $want.Contains($head)
  if (-not $hit) { foreach ($m in $reFormQ.Matches($line)) { if ($want.Contains($m.Groups[1].Value)) { $hit = $true; break } } }
  if (-not $hit) { continue }
  $o = $line | ConvertFrom-Json
  if ($o.lang_code -ne 'sk' -or $o.pos -in $skipPos) { continue }
  $targets = @($o.senses | ForEach-Object { $_.form_of } | Where-Object { $_ } | ForEach-Object { $_.word } | Select-Object -Unique)
  if ($targets) {
    # an inflected-form page: the headword belongs to each lemma it is a form of
    foreach ($t in $targets) { Add-Owner $o.word "$t|$($o.pos)" }
    continue
  }
  $key = "$($o.word)|$($o.pos)"
  Add-Owner $o.word $key
  foreach ($f in $o.forms) {
    if ($f.tags -and ($f.tags | Where-Object { $_ -in 'table-tags', 'inflection-template', 'declension-pattern-of', 'diminutive', 'augmentative', 'relational', 'perfective', 'imperfective', 'feminine-equivalent', 'masculine-equivalent', 'comparative', 'superlative', 'adverb' })) { continue }
    Add-Owner $f.form $key
  }
}

# 3. treebank: per form, counts by lemma
$tb = @{}; $tbLemmas = @{}
foreach ($file in Get-ChildItem "$Root/raw/ud/*.conllu") {
  foreach ($l in [IO.File]::ReadLines($file.FullName)) {
    if (-not $l -or $l[0] -eq '#') { continue }
    $p = $l.Split("`t"); if ($p.Length -lt 4 -or $p[0] -notmatch '^\d+$') { continue }
    $tbLemmas["$($p[2])|$($p[3])"]++
    $f = $p[1].ToLower(); if (-not $want.Contains($f)) { continue }
    if (-not $tb[$f]) { $tb[$f] = @{} }
    $tb[$f]["$($p[2])|$($p[3])"]++
  }
}

$rows = foreach ($n in $nouns) {
  $total = 0.0; $own = 0.0; $shared = [Collections.Generic.List[string]]::new()
  foreach ($f in $formsOf[$n.word]) {
    $fq = [double]($freq[$f] ?? 0); if (-not $fq) { continue }
    $total += $fq
    # same spelling + different part of speech (stop! the interjection) counts as a different word
    $others = @($owners[$f] | Where-Object { $_ -and $_ -ne "$($n.word)|noun" })
    # real usage first: the treebank knows clashes Wiktionary lacks (stopy = stopa, which has no entry)
    $t = $tb[$f]; $all = if ($t) { ($t.Values | Measure-Object -Sum).Sum } else { 0 }
    if ($all -ge 3) {
      $mine = ($t.GetEnumerator() | Where-Object { $_.Key -eq "$($n.word)|NOUN" } | ForEach-Object Value | Measure-Object -Sum).Sum
      $share = $mine / $all; $how = "tb $mine/$all"
      if ($share -ge 0.99) { $own += $fq; continue }
      $who = ($t.GetEnumerator() | Where-Object { $_.Key -ne "$($n.word)|NOUN" } | Sort-Object Value -Descending | Select-Object -First 2 | ForEach-Object { $_.Key }) -join ','
    } elseif ($others.Count) {
      $share = 1.0 / (1 + $others.Count); $how = 'even'; $who = ($others | Select-Object -First 3) -join ','
    } else { $own += $fq; continue }
    $own += $fq * $share
    $shared.Add("$f(${fq}; $who; $how -> $([math]::Round($share,2)))")
  }
  $tbLemma = $tbLemmas["$($n.word)|NOUN"] ?? 0
  [pscustomobject]@{
    word = $n.word; pattern = $n.pattern; total = [long]$total; own = [long]$own; tbLemma = $tbLemma
    ownPct = if ($total) { [math]::Round(100 * $own / $total) } else { 0 }
    shared = ($shared | Sort-Object { -[double]($_ -replace '^[^(]+\((\d+).*', '$1') } | Select-Object -First 4) -join '  '
  }
}
$rank = 0; $rows | Sort-Object own -Descending | ForEach-Object { $_ | Add-Member ownRank (++$rank) }
$rank = 0; $rows | Sort-Object total -Descending | ForEach-Object { $_ | Add-Member oldRank (++$rank) }
$rows | ConvertTo-Json -Depth 3 | Set-Content "$Root/work/noun_ownership.json" -Encoding utf8
$rows | Sort-Object ownPct | Select-Object -First 30 | ForEach-Object {
  "{0,-12} own {1,3}%  tb {2,3}  rank {3,3} -> {4,3}   {5}" -f $_.word, $_.ownPct, $_.tbLemma, $_.oldRank, $_.ownRank, $_.shared
}
''
'--- in the top 150 by own score, but (almost) never in the treebank:'
$rows | Where-Object { $_.ownRank -le 150 -and $_.tbLemma -le 1 } | Sort-Object ownRank | ForEach-Object {
  "{0,-12} rank {1,3}  tb {2}  own {3}%" -f $_.word, $_.ownRank, $_.tbLemma, $_.ownPct
}
