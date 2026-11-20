# Sentences for "Vyfarbi vetu" (colour the sentence), from the hand-annotated UD treebank.
# Each token: [form, caseLetter|'', kind ('n' noun, 'a' adjective, 'p' preposition, ''), lemma|'', num|'', noSpaceAfter 0/1]
# Output: work/sentences.json (build_bundle.ps1 puts it into app/data.js)
param([int]$Max = 700, [string]$Root = (Split-Path $PSScriptRoot -Parent))
$ErrorActionPreference = 'Stop'
$caseMap = @{ Nom = 'N'; Gen = 'G'; Dat = 'D'; Acc = 'A'; Loc = 'L'; Ins = 'I' }
$out = [Collections.Generic.List[object]]::new()

function Add-Sentence($toks, $text) {
  if ($toks.Count -lt 5 -or $toks.Count -gt 16 -or $text.Length -gt 110) { return }
  $row = @(); $targets = 0
  foreach ($t in $toks) {
    $kind = ''; $case = ''; $lemma = ''; $num = ''
    if ($t.upos -in 'NOUN', 'ADJ') {
      if ($t.feats -notmatch 'Case=(\w+)') { return }          # untagged noun/adjective: skip sentence
      $case = $caseMap[$Matches[1]]; if (-not $case) { return } # vocative etc.
      $kind = if ($t.upos -eq 'NOUN') { 'n' } else { 'a' }
      $lemma = $t.lemma
      $num = if ($t.feats -match 'Number=Plur') { 'p' } else { 's' }
      $targets++
    } elseif ($t.upos -eq 'ADP') { $kind = 'p' }
    $row += , @($t.form, $case, $kind, $lemma, $num, $(if ($t.misc -match 'SpaceAfter=No') { 1 } else { 0 }))
  }
  if ($targets -lt 2 -or $targets -gt 5) { return }
  $out.Add($row)
}

foreach ($f in Get-ChildItem "$Root/raw/ud/*.conllu") {
  $toks = [Collections.Generic.List[object]]::new(); $text = ''
  foreach ($l in [IO.File]::ReadLines($f.FullName)) {
    if ($l.StartsWith('# text = ')) { $text = $l.Substring(9); continue }
    if ($l -eq '') { if ($toks.Count) { Add-Sentence $toks $text }; $toks = [Collections.Generic.List[object]]::new(); continue }
    if ($l[0] -eq '#') { continue }
    $p = $l.Split("`t"); if ($p[0] -notmatch '^\d+$') { continue }
    $toks.Add([pscustomobject]@{ form = $p[1]; lemma = $p[2]; upos = $p[3]; feats = $p[5]; misc = $p[9] })
  }
}
# spread across the corpus rather than taking the first N
$step = [math]::Max(1, [math]::Floor($out.Count / $Max))
$pick = for ($i = 0; $i -lt $out.Count -and ($i / $step) -lt $Max; $i += $step) { , $out[$i] }
ConvertTo-Json -InputObject @($pick) -Depth 5 -Compress | Set-Content "$Root/work/sentences.json" -Encoding utf8

# meanings for every noun/adjective lemma in the kept sentences, straight from the Wiktionary dump
$need = @{}; foreach ($s in $pick) { foreach ($t in $s) { if ($t[3]) { $need[$t[3]] = 1 } } }
$gl = [ordered]@{}
$reWord = [regex]'"word": "([^"]+)", "lang": "Slovak"'
foreach ($line in [IO.File]::ReadLines("$Root/raw/sk.jsonl")) {
  $m = $reWord.Match($line); if (-not $m.Success -or -not $need[$m.Groups[1].Value] -or $gl.Contains($m.Groups[1].Value)) { continue }
  if ($line -notmatch '^\{"pos": "(noun|adj|name)"') { continue }
  $o = $line | ConvertFrom-Json
  $g = @($o.senses | Where-Object { $_.glosses -and -not $_.form_of } | Select-Object -First 2 | ForEach-Object { ($_.glosses[-1] -replace '\s*\([^)]*\)', '') -split '[,;]\s*' } | ForEach-Object { $_.Trim() } | Where-Object { $_ } | Select-Object -Unique -First 3) -join ', '
  if ($g) { $gl[$o.word] = $g }
}
$gl | ConvertTo-Json -Compress | Set-Content "$Root/work/sentence_glosses.json" -Encoding utf8
"meanings: $($gl.Count) of $($need.Count) sentence lemmas"
"candidates: $($out.Count)  kept: $(@($pick).Count)"
@($pick) | Select-Object -First 3 | ForEach-Object { ($_ | ForEach-Object { if ($_[1]) { "$($_[0])[$($_[1])]" } elseif ($_[2] -eq 'p') { "*$($_[0])*" } else { $_[0] } }) -join ' ' }
