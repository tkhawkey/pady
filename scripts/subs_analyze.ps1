# Subtitle test, offline analysis of the kept pairs (no web service):
#   lexicon = every word form in the UD Slovak treebank (with its lemma + tags) + every form in the app's dictionary
#             (data.js + lookup-data.js: nouns, adjectives, verbs) + personal pronouns
#   - typo / rare check: Slovak words found nowhere in the lexicon
#   - difficulty: each content word's lemma -> Araneum rank; "hard" = beyond the 3,000 most common words (or unranked)
#   - rough cases: nouns/adjectives whose form has only one case in the lexicon (ambiguous forms are left out)
#   out: work/subs/<name>/analysis.json  +  a summary printed here
param([Parameter(Mandatory)][string]$Name, [string]$Root = (Split-Path $PSScriptRoot -Parent),
  [string]$Src = 'C:\Users\ThomasHawkey\Desktop\Slovak App', [int]$Easy = 3000)
$ErrorActionPreference = 'Stop'
$dir = "$Root/work/subs/$Name"
$pairs = @(Get-Content "$dir/pairs.json" -Raw | ConvertFrom-Json | Where-Object kind -eq 'keep')
function Read-JsObject($p) { $t = Get-Content $p -Raw -Encoding utf8; $t.Substring($t.IndexOf('{')).TrimEnd().TrimEnd(';') | ConvertFrom-Json }

# ---- lexicon: form -> @{ lemmas = set; cases = set; upos = set } ----
$lex = @{}
function Add-Lex($form, $lemma, $upos, $case) {
  $f = $form.ToLowerInvariant(); if (-not $lex.ContainsKey($f)) { $lex[$f] = @{ lemmas = @{}; cases = @{}; upos = @{} } }
  if ($lemma) { $lex[$f].lemmas[$lemma.ToLowerInvariant()] = 1 }; if ($upos) { $lex[$f].upos[$upos] = 1 }; if ($case) { $lex[$f].cases[$case] = 1 }
}
$CK = @{ Nom = 'nom'; Gen = 'gen'; Dat = 'dat'; Acc = 'acc'; Loc = 'loc'; Ins = 'ins' }
foreach ($file in Get-ChildItem "$Root/raw/ud/*.conllu") {
  foreach ($line in [IO.File]::ReadLines($file.FullName)) {
    if (-not $line -or $line[0] -eq '#') { continue }
    $c = $line.Split("`t"); if ($c[0] -notmatch '^\d+$') { continue }
    $case = if ($c[5] -match 'Case=(\w+)') { $CK[$Matches[1]] } else { $null }
    Add-Lex $c[1] $c[2] $c[3] $(if ($c[3] -in 'NOUN', 'ADJ', 'DET', 'PRON', 'NUM') { $case })
  }
}
$tbForms = $lex.Count
$D = Read-JsObject "$Root/app/data.js"; $L = Read-JsObject "$Root/app/lookup-data.js"
$cases = 'nom', 'gen', 'dat', 'acc', 'loc', 'ins'
foreach ($n in $D.nouns) { for ($i = 0; $i -lt 6; $i++) { Add-Lex $n.s[$i] $n.w 'NOUN' $cases[$i]; Add-Lex $n.p[$i] $n.w 'NOUN' $cases[$i] } }
foreach ($n in $L.nouns) {
  if ($n.Count -ge 5 -and $n[4]) { for ($i = 0; $i -lt 6; $i++) { Add-Lex $n[4][0][$i] $n[0] 'NOUN' $cases[$i]; Add-Lex $n[4][1][$i] $n[0] 'NOUN' $cases[$i] } }
  else { foreach ($f in $n[3]) { Add-Lex $f $n[0] 'NOUN' $null } }
}
foreach ($a in $L.adjs) { for ($i = 0; $i -lt $L.slots.Count; $i++) { Add-Lex $a[2][$i] $a[0] 'ADJ' (($L.slots[$i] -split '_')[1]) } }
foreach ($v in $L.verbs) { Add-Lex $v[0] $v[0] 'VERB' $null; foreach ($k in 5, 6, 7) { foreach ($f in @($v[$k])) { if ($f) { Add-Lex $f $v[0] 'VERB' $null } } } }
"lexicon: $($lex.Count) forms ($tbForms from the treebank)"

# Araneum ranks by lemma (any part of speech: the most common reading)
$ara = @{}
foreach ($line in [IO.File]::ReadLines((Get-ChildItem $Src -Recurse -Filter 'araneum_top60k.tsv' | Select-Object -First 1).FullName)) {
  $c = $line -split "`t"; $k = $c[1].ToLowerInvariant(); if (-not $ara.ContainsKey($k)) { $ara[$k] = [int]$c[0] }
}

. "$PSScriptRoot/hunspell_lib.ps1"
$hun = New-Hunspell "$Src/sk_SK"; $hunOk = @{}

# ---- per sentence ----
$names = @{}   # words capitalised mid-sentence everywhere = names (Rebecca, Rupert…)
foreach ($p in $pairs) { $w = @([regex]::Matches($p.sk, '\p{L}+') | ForEach-Object Value); for ($i = 1; $i -lt $w.Count; $i++) { if ($w[$i] -cmatch '^\p{Lu}') { $names[$w[$i].ToLowerInvariant()] = 1 } } }
$unknown = @{}; $caseCount = @{}; $rows = @()
foreach ($p in $pairs) {
  $words = @([regex]::Matches($p.sk, '\p{L}+') | ForEach-Object Value)
  $hard = @(); $unk = @(); $nCase = @()
  foreach ($w in $words) {
    $f = $w.ToLowerInvariant()
    if ($names[$f] -and -not $lex.ContainsKey($f)) { continue }
    $e = $lex[$f]
    if (-not $e) {
      # not in the treebank or the app: ask the Hunspell dictionary (a full Slovak spell-checker)
      if (-not $hunOk.ContainsKey($f)) { $hunOk[$f] = Test-HunWord $hun $w }
      if (-not $hunOk[$f]) { $unk += $w; $unknown[$f] = 1 + ($unknown[$f] ?? 0) }
      continue
    }
    $content = $e.upos.Keys | Where-Object { $_ -in 'NOUN', 'VERB', 'ADJ', 'ADV' }
    if ($content) {
      $best = ($e.lemmas.Keys | ForEach-Object { $ara[$_] ?? 999999 } | Measure-Object -Minimum).Minimum
      if ($best -gt $Easy) { $hard += $w }
    }
    if ($e.cases.Count -eq 1 -and ($e.upos.Keys | Where-Object { $_ -in 'NOUN', 'ADJ' })) { $ck = @($e.cases.Keys)[0]; $caseCount[$ck] = 1 + ($caseCount[$ck] ?? 0); $nCase += "$w=$ck" }
  }
  $rows += [ordered]@{ id = $p.id; sk = $p.sk; en = $p.en; words = $words.Count; hard = $hard; unknown = $unk; cases = $nCase }
}
$rows | ConvertTo-Json -Depth 4 | Set-Content "$dir/analysis.json" -Encoding utf8

$total = @($rows | ForEach-Object { $_.words } | Measure-Object -Sum).Sum
"kept pairs: $($rows.Count)   Slovak words: $total   words found nowhere: $(@($rows | ForEach-Object { $_.unknown }).Count)"
"--- not in any lexicon (form: times):"; ($unknown.GetEnumerator() | Sort-Object Value -Descending | ForEach-Object { "$($_.Key):$($_.Value)" }) -join ', '
"--- difficulty (content words beyond the $Easy most common):"
$bands = $rows | Group-Object { [math]::Min(3, $_.hard.Count) } | Sort-Object Name
foreach ($b in $bands) { "  $(if ($b.Name -eq '3') { '3+' } else { $b.Name }) hard words: $($b.Count) sentences" }
"  e.g. 1 hard word: " + (($rows | Where-Object { $_.hard.Count -eq 1 -and $_.words -ge 5 } | Select-Object -First 4 | ForEach-Object { "$($_.sk) [$($_.hard)]" }) -join '  /  ')
"--- unambiguous noun/adjective cases seen: " + (($cases | ForEach-Object { "$_ $($caseCount[$_] ?? 0)" }) -join ', ')
