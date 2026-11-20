# Sentences for "Vyfarbi vetu" on the verb side: mark the person of every finite verb.
# Token: [form, personKey|'', kind ('v' verb, 'c' clue = subject pronoun, ''), lemma|'', tense ('pres'|'fut'|''), noSpaceAfter]
# Output: work/vsentences.json + work/vsentence_glosses.json (meanings of the verbs)
param([int]$Max = 600, [string]$Root = (Split-Path $PSScriptRoot -Parent))
$ErrorActionPreference = 'Stop'
$PERSONKEY = @{ '1Sing' = 'p1s'; '2Sing' = 'p2s'; '3Sing' = 'p3s'; '1Plur' = 'p1p'; '2Plur' = 'p2p'; '3Plur' = 'p3p' }
$CLUE = 'ja', 'ty', 'on', 'ona', 'ono', 'my', 'vy', 'oni', 'ony'
$out = [Collections.Generic.List[object]]::new()

function Add-Sentence($toks, $text) {
  if ($toks.Count -lt 4 -or $toks.Count -gt 16 -or $text.Length -gt 110) { return }
  $row = @(); $targets = 0
  foreach ($t in $toks) {
    $pk = ''; $kind = ''; $lemma = ''; $tense = ''
    if ($t.upos -in 'VERB', 'AUX' -and $t.feats -match 'VerbForm=Fin' -and $t.feats -match 'Mood=Ind' -and $t.feats -match 'Person=(\d)') {
      $per = $Matches[1]
      if ($t.feats -match 'Number=(Sing|Plur)') {
        $pk = $PERSONKEY["$per$($Matches[1])"]; $kind = 'v'; $lemma = $t.lemma; $targets++
        $tense = if ($t.feats -match 'Tense=Fut' -or $t.feats -match 'Aspect=Perf') { 'fut' } else { 'pres' }
      }
    } elseif ($t.upos -eq 'PRON' -and $t.form.ToLower() -in $CLUE -and $t.rel -like 'nsubj*') { $kind = 'c' }
    $row += , @($t.form, $pk, $kind, $lemma, $tense, $(if ($t.misc -match 'SpaceAfter=No') { 1 } else { 0 }))
  }
  if ($targets -lt 1 -or $targets -gt 3) { return }
  $out.Add($row)
}

foreach ($f in Get-ChildItem "$Root/raw/ud/*.conllu") {
  $toks = [Collections.Generic.List[object]]::new(); $text = ''
  foreach ($l in [IO.File]::ReadLines($f.FullName)) {
    if ($l.StartsWith('# text = ')) { $text = $l.Substring(9); continue }
    if ($l -eq '') { if ($toks.Count) { Add-Sentence $toks $text }; $toks = [Collections.Generic.List[object]]::new(); continue }
    if ($l[0] -eq '#') { continue }
    $p = $l.Split("`t"); if ($p[0] -notmatch '^\d+$') { continue }
    $toks.Add([pscustomobject]@{ form = $p[1]; lemma = $p[2]; upos = $p[3]; feats = $p[5]; rel = $p[7]; misc = $p[9] })
  }
}
# prefer sentences with 1st/2nd person (the treebank is mostly 3rd person), then spread across the rest
$allYouMe = @($out | Where-Object { $_ | Where-Object { $_[1] -match '^p[12]' } })
$ys = [math]::Max(1, [math]::Floor($allYouMe.Count / 350)); $withYouMe = @(for ($i = 0; $i -lt $allYouMe.Count -and ($i / $ys) -lt 350; $i += $ys) { , $allYouMe[$i] })
$rest = @($out | Where-Object { -not ($_ | Where-Object { $_[1] -match '^p[12]' }) })
$step = [math]::Max(1, [math]::Floor($rest.Count / [math]::Max(1, $Max - $withYouMe.Count)))
$pick = @($withYouMe) + @(for ($i = 0; $i -lt $rest.Count -and $withYouMe.Count + ($i / $step) -lt $Max; $i += $step) { , $rest[$i] })
ConvertTo-Json -InputObject @($pick) -Depth 5 -Compress | Set-Content "$Root/work/vsentences.json" -Encoding utf8

# meanings of the verbs (from the decoded conjugation data, then the dump)
$need = @{}; foreach ($s in $pick) { foreach ($t in $s) { if ($t[2] -eq 'v') { $need[$t[3]] = 1 } } }
$gl = [ordered]@{}
if (Test-Path "$Root/work/conj_all.json") { foreach ($v in (Get-Content "$Root/work/conj_all.json" -Raw | ConvertFrom-Json)) { if ($need[$v.w] -and $v.g) { $gl[$v.w] = $v.g } } }
$reWord = [regex]'"word": "([^"]+)", "lang": "Slovak"'
foreach ($line in [IO.File]::ReadLines("$Root/raw/sk.jsonl")) {
  $m = $reWord.Match($line); if (-not $m.Success -or -not $need[$m.Groups[1].Value] -or $gl.Contains($m.Groups[1].Value) -or $line -notmatch '^\{"pos": "verb"') { continue }
  $o = $line | ConvertFrom-Json
  $g = @($o.senses | Where-Object { $_.glosses -and -not $_.form_of } | Select-Object -First 2 | ForEach-Object { ($_.glosses[-1] -replace '\s*\([^)]*\)', '') -split '[,;]\s*' } | ForEach-Object { $_.Trim() } | Where-Object { $_ } | Select-Object -Unique -First 3) -join ', '
  if ($g) { $gl[$o.word] = $g }
}
$gl | ConvertTo-Json -Compress | Set-Content "$Root/work/vsentence_glosses.json" -Encoding utf8
$persons = @{}; foreach ($s in $pick) { foreach ($t in $s) { if ($t[1]) { $persons[$t[1]]++ } } }
"candidates: $($out.Count)  kept: $($pick.Count)  (with ja/ty/my/vy: $($withYouMe.Count))  verb meanings: $($gl.Count)/$($need.Count)"
"persons: " + (($persons.GetEnumerator() | Sort-Object Name | ForEach-Object { "$($_.Name)=$($_.Value)" }) -join ' ')
@($pick) | Select-Object -First 3 | ForEach-Object { ($_ | ForEach-Object { if ($_[1]) { "$($_[0])[$($_[1])]" } elseif ($_[2] -eq 'c') { "*$($_[0])*" } else { $_[0] } }) -join ' ' }
