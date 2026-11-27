# Second opinion on the Hunspell verb tables (work/verbs_hun.json): every form the hand-annotated UD treebank has for
# the same verb, person, number and tense. A verb is drill-ready when the treebank confirms several cells and
# contradicts none.   out: work/verbs_hun_check.json { verb: { ok, bad, cells } }, report on screen
param([string]$Root = (Split-Path $PSScriptRoot -Parent), [int]$MinOk = 3)
$ErrorActionPreference = 'Stop'
$VERBS = @(Get-Content "$Root/work/verbs_hun.json" -Raw -Encoding utf8 | ConvertFrom-Json | ForEach-Object { $_ })
$byW = @{}; foreach ($v in $VERBS) { $byW[$v.w] = $v }
$seen = @{}   # "w|slot" -> set of forms
foreach ($file in Get-ChildItem "$Root/raw/ud/*.conllu") {
  foreach ($line in [IO.File]::ReadLines($file.FullName)) {
    if (-not $line -or $line[0] -eq '#') { continue }
    $c = $line.Split("`t"); if ($c[0] -notmatch '^\d+$' -or $c[3] -notin 'VERB', 'AUX') { continue }
    $w = $c[2].ToLowerInvariant(); if (-not $byW.ContainsKey($w)) { continue }
    $f = $c[1].ToLowerInvariant(); $ft = $c[5]
    if ($ft -match 'Polarity=Neg') { continue }
    $slot = $null
    if ($ft -match 'VerbForm=Fin' -and $ft -match 'Mood=Ind' -and $ft -match 'Person=(\d)' ) {
      $p = [int]$Matches[1]; $n = if ($ft -match 'Number=Plur') { 3 } else { 0 }; $slot = "p$($p - 1 + $n)"
    } elseif ($ft -match 'VerbForm=Part' -and $ft -match 'Tense=Past') {
      $slot = if ($ft -match 'Number=Plur') { 'l3' } elseif ($ft -match 'Gender=Fem') { 'l1' } elseif ($ft -match 'Gender=Neut') { 'l2' } elseif ($ft -match 'Gender=Masc') { 'l0' } else { $null }
    }
    if (-not $slot) { continue }
    $k = "$w|$slot"; if (-not $seen[$k]) { $seen[$k] = [System.Collections.Generic.HashSet[string]]::new() }; [void]$seen[$k].Add($f)
  }
}
$res = [ordered]@{}; $ready = @(); $conflicts = @()
foreach ($v in $VERBS) {
  $ok = 0; $bad = @()
  for ($i = 0; $i -lt 6; $i++) { $s = $seen["$($v.w)|p$i"]; if ($s) { if ($s.Contains($v.pres[$i])) { $ok++ } else { $bad += "p$i ours=$($v.pres[$i]) tb=$(@($s) -join '/')" } } }
  for ($i = 0; $i -lt 4; $i++) { $s = $seen["$($v.w)|l$i"]; if ($s -and $v.past[$i]) { if ($s.Contains($v.past[$i])) { $ok++ } else { $bad += "l$i ours=$($v.past[$i]) tb=$(@($s) -join '/')" } } }
  if (-not $ok -and -not $bad.Count) { continue }
  $res[$v.w] = [ordered]@{ ok = $ok; bad = $bad; rank = $v.rank }
  if ($bad.Count) { $conflicts += "$($v.w): $($bad -join '; ')" } elseif ($ok -ge $MinOk) { $ready += $v }
}
$res | ConvertTo-Json -Depth 4 | Set-Content "$Root/work/verbs_hun_check.json" -Encoding utf8
"verbs the treebank has: $($res.Count) / $($VERBS.Count)   no conflict and >= $MinOk cells confirmed: $($ready.Count)   with a conflict: $($conflicts.Count)"
"drill-ready in the Araneum top 500 / 1000: $(@($ready | Where-Object { $_.rank -le 500 }).Count) / $(@($ready | Where-Object { $_.rank -le 1000 }).Count)"
"top drill-ready: $(($ready | Sort-Object rank | Select-Object -First 50 | ForEach-Object { $_.w }) -join ', ')"
"conflicts (first 25):"; $conflicts | Select-Object -First 25
