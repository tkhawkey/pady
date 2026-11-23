# Úlovok pack: one subtitle title -> one importable file (work/packs/<name>.ulovok.json).
# Subtitle text is copyrighted: packs stay in work/ (gitignored) and are imported into the app on each device;
# they are never uploaded with the site.
#   in : work/subs/<name>/pairs.json      (scripts/subs_align.ps1)
#        work/subs/<name>/tagged.conllu   (UDPipe, one sentence per kept pair, same order)
#        work/subs/<name>/judgments.json  (optional: hand/AI check of a sample: loose / mismatch / error)
#        work/subs/<name>/fixes.json      (optional: { "exclude": [ids], "approx": [ids], "colloquial": { form: [lemma, gloss] } })
#   lex: Wiktionary dump glosses (raw/sk.jsonl) + app data glosses; Araneum lemma ranks
param([Parameter(Mandatory)][string]$Name, [Parameter(Mandatory)][string]$Title, [string]$Ep = '', [string]$From = '',
  [string]$Root = (Split-Path $PSScriptRoot -Parent), [string]$Src = 'C:\Users\ThomasHawkey\Desktop\Slovak App')
$ErrorActionPreference = 'Stop'
$dir = "$Root/work/subs/$Name"
$pairs = @(Get-Content "$dir/pairs.json" -Raw -Encoding utf8 | ConvertFrom-Json)
$keep = @($pairs | Where-Object kind -eq 'keep')
$judg = if (Test-Path "$dir/judgments.json") { Get-Content "$dir/judgments.json" -Raw | ConvertFrom-Json } else { $null }
$fixes = if (Test-Path "$dir/fixes.json") { Get-Content "$dir/fixes.json" -Raw -Encoding utf8 | ConvertFrom-Json } else { $null }
$exclude = @{}; foreach ($i in @($judg.mismatch) + @($judg.error) + @($fixes.exclude)) { if ($i) { $exclude[[int]$i] = 1 } }
$approx = @{}; foreach ($i in @($judg.loose) + @($fixes.approx)) { if ($i) { $approx[[int]$i] = 1 } }
$names = @{}; foreach ($n in @($fixes.names)) { if ($n) { $names[$n] = 1 } }
$colloq = @{}; if ($fixes.colloquial) { foreach ($p in $fixes.colloquial.PSObject.Properties) { $colloq[$p.Name] = $p.Value } }

# ---- UDPipe sentences ----
$CASEMAP = @{ Nom = 'nom'; Gen = 'gen'; Dat = 'dat'; Acc = 'acc'; Loc = 'loc'; Ins = 'ins' }
$sents = @(); $cur = $null
foreach ($line in [IO.File]::ReadLines("$dir/tagged.conllu")) {
  if ($line -match '^# text = (.*)$') { $cur = @{ text = $Matches[1]; rows = @() }; $sents += $cur; continue }
  if (-not $line -or $line[0] -eq '#') { continue }
  $cur.rows += , ($line.Split("`t"))
}
if ($sents.Count -ne $keep.Count) { throw "tagged sentences ($($sents.Count)) != kept pairs ($($keep.Count))" }

function Get-Feat($f, $k) { if ($f -match "(?:^|\|)$k=([^|]+)") { $Matches[1] } else { $null } }
# short morphology code: number s/p, gender m/f/n (+a/i animacy), person 1-3, tense pres/past/fut, imp, inf, neg, aspect
function Get-Morph($upos, $f) {
  $o = @()
  $n = Get-Feat $f 'Number'; if ($n) { $o += @{ Sing = 's'; Plur = 'p' }[$n] }
  $g = Get-Feat $f 'Gender'; if ($g) { $o += @{ Masc = 'm'; Fem = 'f'; Neut = 'n' }[$g] + $(if ((Get-Feat $f 'Animacy') -eq 'Anim') { 'a' } elseif ((Get-Feat $f 'Animacy') -eq 'Inan') { 'i' } else { '' }) }
  if ($upos -in 'VERB', 'AUX') {
    $p = Get-Feat $f 'Person'; if ($p) { $o += $p }
    $vf = Get-Feat $f 'VerbForm'; $mood = Get-Feat $f 'Mood'; $t = Get-Feat $f 'Tense'
    if ($mood -eq 'Imp') { $o += 'imp' } elseif ($mood -eq 'Cnd') { $o += 'cnd' }
    elseif ($vf -eq 'Inf') { $o += 'inf' } elseif ($vf -eq 'Part' -and $t -eq 'Past') { $o += 'past' }
    elseif ($t) { $o += @{ Pres = 'pres'; Past = 'past'; Fut = 'fut' }[$t] }
    $a = Get-Feat $f 'Aspect'; if ($a) { $o += @{ Imp = 'ipf'; Perf = 'pf' }[$a] }
  }
  if ((Get-Feat $f 'Polarity') -eq 'Neg') { $o += 'neg' }
  ($o | Where-Object { $_ }) -join ' '
}

# ---- lexicon sources ----
function Read-JsObject($p) { $t = Get-Content $p -Raw -Encoding utf8; $t.Substring($t.IndexOf('{')).TrimEnd().TrimEnd(';') | ConvertFrom-Json }
$ara = @{}
foreach ($line in [IO.File]::ReadLines((Get-ChildItem $Src -Recurse -Filter 'araneum_top60k.tsv' | Select-Object -First 1).FullName)) {
  $c = $line -split "`t"; $k = $c[1].ToLowerInvariant(); if (-not $ara.ContainsKey($k)) { $ara[$k] = [int]$c[0] }
}
# glosses from the app data (curated) - also the set of lemmas we trust
$gloss = @{}
$D = Read-JsObject "$Root/app/data.js"; $L = Read-JsObject "$Root/app/lookup-data.js"
foreach ($n in @($D.nouns) + @($D.adjs) + @($D.conj)) { if ($n.g -and -not $gloss[$n.w]) { $gloss[$n.w] = $n.g } }
if ($D.glosses) { foreach ($p in $D.glosses.PSObject.Properties) { if (-not $gloss[$p.Name]) { $gloss[$p.Name] = $p.Value } } }
foreach ($a in $L.adjs) { if ($a[1] -and -not $gloss[$a[0]]) { $gloss[$a[0]] = $a[1] } }
foreach ($n in $L.nouns) { if ($n[1] -and -not $gloss[$n[0]]) { $gloss[$n[0]] = $n[1] } }
foreach ($v in $L.verbs) { if ($v[2] -and -not $gloss[$v[0]]) { $gloss[$v[0]] = $v[2] } }
# learner glosses: work/vocab_glosses.json (3,000 A1-B1 words; 'ai' = written by Claude, unchecked) and
# work/ai_glosses.json (words met in subtitles that no dictionary here glosses; written by Claude)
$glossSrc = @{}
foreach ($f in 'vocab_glosses.json', 'ai_glosses.json') {
  if (-not (Test-Path "$Root/work/$f")) { continue }
  foreach ($p in (Get-Content "$Root/work/$f" -Raw -Encoding utf8 | ConvertFrom-Json).PSObject.Properties) {
    if ($gloss[$p.Name]) { continue }
    $v = @($p.Value); $gloss[$p.Name] = $v[0]; if ($f -eq 'ai_glosses.json' -or $v[1] -eq 'ai') { $glossSrc[$p.Name] = 'ai' }
  }
}

# form -> possible lemmas (UD treebank + app dictionary). UDPipe guesses a lemma for words it has never seen
# (urobť, pracuť, zema); when its lemma is unknown anywhere, a real lemma for that exact form wins.
$formLex = @{}
function Add-Form($form, $lemma) { $f = $form.ToLowerInvariant(); if (-not $formLex.ContainsKey($f)) { $formLex[$f] = @{} }; $formLex[$f][$lemma.ToLowerInvariant()] = 1 }
foreach ($file in Get-ChildItem "$Root/raw/ud/*.conllu") {
  foreach ($line in [IO.File]::ReadLines($file.FullName)) {
    if (-not $line -or $line[0] -eq '#') { continue }
    $c = $line.Split("`t"); if ($c[0] -match '^\d+$' -and $c[3] -ne 'PROPN') { Add-Form $c[1] $c[2] }
  }
}
foreach ($n in $D.nouns) { foreach ($x in @($n.s) + @($n.p)) { if ($x) { Add-Form $x $n.w } } }
foreach ($n in $L.nouns) { if ($n.Count -ge 5 -and $n[4]) { foreach ($x in @($n[4][0]) + @($n[4][1])) { Add-Form $x $n[0] } } else { foreach ($x in $n[3]) { Add-Form $x $n[0] } } }
foreach ($a in $L.adjs) { foreach ($x in $a[2]) { Add-Form $x $a[0] } }
foreach ($v in $L.verbs) { Add-Form $v[0] $v[0]; foreach ($k in 5, 6, 7) { foreach ($x in @($v[$k])) { if ($x) { Add-Form $x $v[0] } } } }
$trusted = @{}; foreach ($k in $ara.Keys) { $trusted[$k] = 1 }; foreach ($k in $gloss.Keys) { $trusted[$k] = 1 }
foreach ($e in $formLex.Values) { foreach ($k in $e.Keys) { $trusted[$k] = 1 } }
$nFixed = 0; $fixedEx = @()

# names: word forms that only ever appear capitalised in this episode, at least once mid-sentence (Ted, Rebecca, Natov)
$seenLower = @{}; $midCap = @{}
foreach ($p in $keep) {
  $w = @([regex]::Matches($p.sk, '\p{L}+') | ForEach-Object Value)
  for ($i = 0; $i -lt $w.Count; $i++) {
    $k = $w[$i].ToLowerInvariant()
    if ($w[$i] -cmatch '^\p{Ll}') { $seenLower[$k] = 1 } elseif ($i -gt 0) { $midCap[$k] = 1 }
  }
}

# ---- tokens ----
$lemmas = @{}   # lemma -> upos (most frequent content reading)
$out = @(); $nEx = 0; $nApprox = 0
for ($si = 0; $si -lt $keep.Count; $si++) {
  $p = $keep[$si]; $s = $sents[$si]
  if ($s.text.Trim() -ne $p.sk.Trim()) { throw "text mismatch at pair $($p.id): '$($s.text)' vs '$($p.sk)'" }
  if ($exclude[[int]$p.id]) { $nEx++; continue }
  $rows = $s.rows
  # which tokens sit under a preposition: ADP with deprel 'case' -> its head gets the preposition
  $byId = @{}; foreach ($r in $rows) { if ($r[0] -match '^\d+$') { $byId[$r[0]] = $r } }
  $prepOf = @{}
  foreach ($r in $rows) { if ($r[0] -match '^\d+$' -and $r[3] -eq 'ADP' -and $r[7] -eq 'case') { $prepOf[$r[6]] = $r[2].ToLowerInvariant() } }
  $toks = @(); $skipTo = 0
  foreach ($r in $rows) {
    if ($r[0] -match '^(\d+)-(\d+)$') {
      # contracted form (naň, preňho): show the surface word, analyse its non-preposition part
      $a = [int]$Matches[1]; $b = [int]$Matches[2]; $skipTo = $b
      $main = $null; $prep = $null
      for ($j = $a; $j -le $b; $j++) { $x = $byId["$j"]; if ($x[3] -eq 'ADP') { if (-not $prep) { $prep = $x } } elseif (-not $main) { $main = $x } }
      if (-not $main) { $main = $byId["$b"] }
      $r2 = $main.Clone(); $r2[1] = $r[1]; $r2[9] = $r[9]; $r = $r2
      if ($prep) { $prepOf[$main[0]] = $prep[2].ToLowerInvariant() }
    }
    elseif ($r[0] -match '^\d+$' -and [int]$r[0] -le $skipTo) { continue }
    $form = $r[1]; $lemma = $r[2].ToLowerInvariant(); $upos = $r[3]; $f = $r[5]
    $ck = ''
    if ($upos -in 'NOUN', 'PROPN', 'ADJ', 'PRON', 'DET', 'NUM') { $c = Get-Feat $f 'Case'; if ($c) { $ck = $CASEMAP[$c] } }
    # jeho / jej / ich (his, her, their) never change form: UDPipe gives them the noun's case, but colouring them would mislead
    if ($upos -in 'DET', 'PRON' -and (Get-Feat $f 'Poss') -eq 'Yes' -and $form.ToLowerInvariant() -in 'jeho', 'jej', 'ich') { $ck = '' }
    $pr = $prepOf[$r[0]]
    if (-not $pr -and $upos -in 'ADJ', 'DET', 'NUM' -and $byId[$r[6]]) { $pr = $prepOf[$r[6]] }   # adjective takes its noun's preposition
    $cf = $form.ToLowerInvariant()
    if ($colloq.ContainsKey($cf)) { $lemma = $colloq[$cf][0] }
    elseif (($names[$cf] -or ($midCap[$cf] -and -not $seenLower[$cf])) -and $upos -ne 'PUNCT') { $upos = 'PROPN'; $ck = '' ; $lemma = $cf }
    # najskôr, najmä, najprv: superlative adverbs that are words of their own (najskôr = at first, not "soonest" of skoro)
    elseif ($upos -eq 'ADV' -and (Get-Feat $f 'Degree') -eq 'Sup' -and $ara[$cf]) { $lemma = $cf }
    elseif ($upos -notin 'PUNCT', 'PROPN', 'NUM', 'X', 'SYM' -and -not $trusted[$lemma] -and $formLex[$cf]) {
      $best = $formLex[$cf].Keys | Sort-Object { $ara[$_] ?? 999999 } | Select-Object -First 1
      if ($fixedEx.Count -lt 40) { $fixedEx += "$form`:$lemma→$best" }
      $lemma = $best; $nFixed++
    }
    $ns = if ($r[9] -match 'SpaceAfter=No') { 1 } else { 0 }
    $toks += , @($form, $lemma, $upos, $ck, (Get-Morph $upos $f), $(if ($pr) { $pr } else { '' }), $ns)
    if ($upos -ne 'PUNCT' -and $upos -ne 'PROPN' -and $form -match '\p{L}') { if (-not $lemmas.ContainsKey($lemma)) { $lemmas[$lemma] = $upos } }
  }
  $fl = @(); if ($approx[[int]$p.id] -or @($p.flags).Count) { $fl += 'approx'; $nApprox++ }
  $out += [ordered]@{ id = $p.id; t = $toks; en = $p.en; f = $fl }
}

# ---- glosses: app data first (curated, loaded above), then the Wiktionary dump for the rest ----
$POSW = @{ NOUN = 'noun'; VERB = 'verb'; AUX = 'verb'; ADJ = 'adj'; ADV = 'adv'; PRON = 'pron'; DET = 'pron'; NUM = 'num'; ADP = 'prep'; CCONJ = 'conj'; SCONJ = 'conj'; PART = 'particle'; INTJ = 'intj' }
$need = @{}; foreach ($k in $lemmas.Keys) { if (-not $gloss[$k]) { $need[$k] = $POSW[$lemmas[$k]] } }
$wk = @{}
foreach ($line in [IO.File]::ReadLines("$Root/raw/sk.jsonl")) {
  # cheap pre-check: any "word" value on the line that we need; then parse and use the entry's own headword
  $hit = $false
  foreach ($m in [regex]::Matches($line, '"word": "([^"]+)"')) { if ($need.ContainsKey($m.Groups[1].Value)) { $hit = $true; break } }
  if (-not $hit) { continue }
  $o = $line | ConvertFrom-Json
  $w = $o.word; if ($o.lang_code -ne 'sk' -or -not $need.ContainsKey($w)) { continue }
  $senses = @($o.senses | Where-Object { $_.glosses -and -not ($_.tags -contains 'form-of') -and -not $_.form_of -and -not $_.alt_of })
  if (-not $senses) { continue }
  $parts = @($senses | Select-Object -First 2 | ForEach-Object { ($_.glosses[-1] -replace '\s*\([^)]*\)', '') -split '[,;]\s*' } | ForEach-Object { $_.Trim() } | Where-Object { $_ } | Select-Object -Unique)
  $g = $parts -join ', '; if ($g.Length -gt 70) { $g = $g.Substring(0, 70).TrimEnd() + '…' }
  if (-not $g) { continue }
  $score = if ($o.pos -eq $need[$w]) { 2 } else { 1 }
  if (-not $wk[$w] -or $score -gt $wk[$w][1]) { $wk[$w] = @($g, $score) }
}
foreach ($k in $wk.Keys) { $gloss[$k] = $wk[$k][0] }

# forms of each noun / adjective / verb (Hunspell sk_SK), for fill-in drills: the wrong options are other forms of
# the same word. Rule artefacts dropped: "-násobne" (number-word rule) and regular comparatives (-ejší: dobrý has lepší).
. "$PSScriptRoot/hunspell_lib.ps1"
$hun = New-Hunspell "$Src/sk_SK"
$formsOf = @{}
foreach ($k in $lemmas.Keys) {
  if ($lemmas[$k] -notin 'NOUN', 'ADJ', 'VERB') { continue }
  $all = Get-HunForms $hun $k
  $fs = @($all | Where-Object { $_ -notmatch 'násob|ejš' -and $_ -ne $k })
  if ($fs.Count) { $formsOf[$k] = $fs }
}
"forms from Hunspell: $($formsOf.Count) lemmas"

# lex: lemma -> [gloss, rank (0 = unranked), upos, source, colloquial, forms]   source: '' dictionary, 'ai' = written by Claude (colloquial)
$lex = [ordered]@{}; $noGloss = @()
foreach ($k in ($lemmas.Keys | Sort-Object)) {
  $src = if ($glossSrc[$k]) { 'ai' } else { '' }; $g = $gloss[$k]
  $c = $colloq.Values | Where-Object { $_[0] -eq $k } | Select-Object -First 1
  if ($c -and -not $g) { $g = $c[1]; $src = 'ai' }
  if (-not $g) { $noGloss += "$k ($($lemmas[$k]))" }
  # 5th field 'c' = colloquial / slang: listed in fixes.json and not among the 60k most common Araneum lemmas
  $isColl = if ($c -and -not $ara[$k] -and $k -notmatch '\d|-') { 'c' } else { '' }
  $lex[$k] = @($(if ($g) { $g } else { '' }), $(if ($ara[$k]) { $ara[$k] } else { 0 }), $lemmas[$k], $src, $isColl, $(if ($formsOf[$k]) { $formsOf[$k] -join ' ' } else { '' }))
}

# context: every line of the episode in order (also the short ones: "Áno." "Dobre."), so a sentence can show its neighbours
$ctx = @($pairs | Where-Object { $_.kind -in 'keep', 'short' } | ForEach-Object { , @($_.id, $_.sk, $_.en) })

$pack = [ordered]@{ v = 1; id = $Name; title = $Title; ep = $Ep; from = $From; made = (Get-Date -Format 'yyyy-MM-dd'); lex = $lex; s = $out; ctx = $ctx }
New-Item -ItemType Directory -Force "$Root/work/packs" | Out-Null
$path = "$Root/work/packs/$Name.ulovok.json"
[IO.File]::WriteAllText($path, ($pack | ConvertTo-Json -Depth 6 -Compress), [Text.UTF8Encoding]::new($false))
"pack: $path  $([math]::Round((Get-Item $path).Length / 1KB)) KB"
"sentences $($out.Count) (excluded $nEx, approximate $nApprox)  lemmas $($lex.Count)  context lines $($ctx.Count)"
"lemmas corrected from the dictionary: $nFixed  e.g. $($fixedEx -join ', ')"
"no gloss ($($noGloss.Count)): $($noGloss -join ', ')"
# the sentence each unglossed lemma comes from (to write a gloss that fits)
$ng = @{}; foreach ($x in $noGloss) { $ng[($x -split ' ')[0]] = 1 }
$ctxOut = foreach ($s in $out) { foreach ($t in $s.t) { if ($ng[$t[1]]) { $ng.Remove($t[1]); "$($t[1])`t$($t[2])`t$($t[0])`t$(($s.t | ForEach-Object { $_[0] }) -join ' ')`t$($s.en)" } } }
[IO.File]::WriteAllLines("$dir/no_gloss.tsv", [string[]]@($ctxOut), [Text.UTF8Encoding]::new($false))
