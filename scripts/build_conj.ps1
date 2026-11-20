# Verb conjugation tables from the kaikki Wiktionary dump (no web fetch needed).
# The present/future rows are tagged correctly; past rows have shifted tags, so the past is decoded
# from the forms themselves (-l/-la/-lo/-li). Every form is then checked against the UD treebank.
# Output: work/conj_all.json (every decodable verb, for Hľadaj), data/conj.json (top N for the games)
param([int]$Top = 400, [string]$Root = (Split-Path $PSScriptRoot -Parent))
$ErrorActionPreference = 'Stop'
$alpha = '^[a-záäčďéíĺľňóôŕšťúýž]+$'
$PERS = @{ 'first-person|singular' = 0; 'second-person|singular' = 1; 'third-person|singular' = 2; 'first-person|plural' = 3; 'second-person|plural' = 4; 'third-person|plural' = 5 }

function Get-Slot($tags) {
  $p = ($tags | Where-Object { $_ -match '-person$' } | Select-Object -First 1)
  $n = ($tags | Where-Object { $_ -in 'singular', 'plural' } | Select-Object -First 1)
  if ($p -and $n) { return $PERS["$p|$n"] } ; return $null
}

$freq = @{}
foreach ($line in [IO.File]::ReadLines("$Root/raw/sk_50k.txt")) { $p = $line.Split(' '); if ($p.Length -eq 2) { $freq[$p[0]] = [long]$p[1] } }

# when Wiktionary lists variants (vzal / vzial), keep the more frequent one
function Get-Better($cur, $new) { if (-not $cur) { return $new }; if (($freq[$new] ?? 0) -gt ($freq[$cur] ?? 0)) { return $new }; return $cur }

$verbs = [ordered]@{}
foreach ($line in [IO.File]::ReadLines("$Root/raw/sk.jsonl")) {
  if (-not $line.Contains('"sk-conj"') -or $line -notmatch '^\{"pos": "verb"') { continue }
  $o = $line | ConvertFrom-Json
  if ($o.lang_code -ne 'sk' -or $o.word -cnotmatch $alpha -or $verbs.Contains($o.word)) { continue }
  $tpls = @($o.inflection_templates | Where-Object name -eq 'sk-conj')
  $kinds = @($tpls | ForEach-Object { "$($_.args.'1')" })
  $plain = $kinds | Where-Object { $_ -notmatch '-(sa|si)$' }
  $refl = if ($plain) { '' } elseif ($kinds -match '-si$') { 'si' } else { 'sa' }
  $asp = ((@($plain) + @($kinds)) | Select-Object -First 1) -replace '-(sa|si)$', ''
  $cls = "$($tpls[0].args.'2')"

  $pres = @($null) * 6; $fut = @($null) * 6; $imp = [ordered]@{}; $past = [ordered]@{}
  $pf = @(); $ipf = @(); $inf = $null
  foreach ($f in $o.forms) {
    $t = @($f.tags); $form = "$($f.form)".Trim()
    if (-not $form -or $form -eq '-' -or $t -contains 'table-tags' -or $t -contains 'inflection-template') { continue }
    if ($t -contains 'perfective' -and $t.Count -eq 1) { $pf += $form; continue }
    if ($t -contains 'imperfective' -and $t.Count -eq 1) { $ipf += $form; continue }
    $tok = @($form.Split(' '))
    if ($refl) {
      $i = [array]::LastIndexOf($tok, $refl); if ($i -lt 0) { continue }   # reflexive verb: keep its own forms
      $tok = @($tok | Select-Object -Index (0..($tok.Count - 1) | Where-Object { $_ -ne $i }))
    } elseif ($tok -contains 'sa') { continue }                               # skip the reflexive variant
    if ($t -contains 'infinitive' -and $tok.Count -eq 1 -and -not $inf -and $t.Count -eq 1) { $inf = $tok[0]; continue }
    if ($tok.Count -ne 1) { continue }
    $w = $tok[0]; if ($w -cnotmatch $alpha) { continue }
    if ($t -contains 'conditional' -or $t -contains 'participle' -or $t -contains 'transgressive' -or $t -contains 'noun-from-verb') { continue }
    if ($t -contains 'imperative') {
      $s = Get-Slot $t
      if ($s -in 1, 3, 4) { $imp["$s"] = Get-Better $imp["$s"] $w }
      continue
    }
    if ($t -contains 'past') {
      # decode from the form: -l (m), -la (f), -lo (n), -li (pl); the tags here are shifted
      $g = if ($w -match 'li$') { 'p' } elseif ($w -match 'la$') { 'f' } elseif ($w -match 'lo$') { 'n' } elseif ($w -match 'l$') { 'm' } else { $null }
      if ($g) { $past[$g] = Get-Better $past[$g] $w }
      continue
    }
    $s = Get-Slot $t; if ($null -eq $s) { continue }
    if ($t -contains 'future') { $fut[$s] = Get-Better $fut[$s] $w }
    elseif ($t -contains 'present') { $pres[$s] = Get-Better $pres[$s] $w }
  }
  if (-not $inf) { $inf = $o.word }
  # perfective verbs: the "present" forms mean future; keep them in one slot, the aspect says which
  $simple = if (-not ($pres -contains $null)) { $pres } elseif (-not ($fut -contains $null)) { $fut } else { $null }
  if (-not $simple -or $past.Count -lt 4) { continue }
  $gl = @($o.senses | Where-Object { $_.glosses -and -not $_.form_of } | Select-Object -First 2 | ForEach-Object { ($_.glosses[-1] -replace '\s*\([^)]*\)', '') -split '[,;]\s*' } |
    ForEach-Object { $_.Trim() } | Where-Object { $_ } | Select-Object -Unique -First 3) -join ', '
  $partner = if ($asp -eq 'impf') { $pf | Select-Object -First 1 } elseif ($asp -eq 'pf') { $ipf | Select-Object -First 1 } else { $null }
  $score = 0L; foreach ($x in @($inf) + $simple + @($past.Values)) { if ($freq[$x]) { $score += $freq[$x] } }
  $verbs[$o.word] = [ordered]@{
    w = $o.word; refl = $refl; g = $gl; asp = $asp; cls = $cls; partner = $partner
    pres = $simple; past = @($past.m, $past.f, $past.n, $past.p)
    imp = @($imp['1'], $imp['3'], $imp['4']); score = $score
  }
}

# ---- validate against the treebank ----
$tb = @{}   # lemma -> list of [kind, slot, form]
$caseNum = @{ Sing = 0; Plur = 3 }
foreach ($file in Get-ChildItem "$Root/raw/ud/*.conllu") {
  foreach ($l in [IO.File]::ReadLines($file.FullName)) {
    if (-not $l -or $l[0] -eq '#') { continue }
    $p = $l.Split("`t"); if ($p.Length -lt 6 -or $p[3] -notin 'VERB', 'AUX' -or -not $verbs.Contains($p[2])) { continue }
    $ft = $p[5]; $form = $p[1].ToLower()
    if ($ft -match 'VerbForm=Fin' -and $ft -match 'Mood=Ind' -and $ft -match 'Tense=Pres' -and $ft -match 'Person=(\d)' ) {
      $per = [int]$Matches[1]; if ($ft -notmatch 'Number=(Sing|Plur)') { continue }
      if ($ft -match 'Polarity=Neg') { continue }
      $slot = $caseNum[$Matches[1]] + $per - 1
      $tb[$p[2]] += , @('pres', $slot, $form)
    } elseif ($ft -match 'VerbForm=Part' -and $ft -match 'Tense=Past' -and $ft -notmatch 'Voice=Pass') {
      if ($ft -match 'Polarity=Neg') { continue }
      $g = if ($ft -match 'Number=Plur') { 3 } elseif ($ft -match 'Gender=Fem') { 1 } elseif ($ft -match 'Gender=Neut') { 2 } else { 0 }
      $tb[$p[2]] += , @('past', $g, $form)
    }
  }
}
# Wiktionary occasionally lists only a rare variant (vziať: "vzial"; real usage "vzal").
# Override a slot when the treebank uses another form at least twice AND it is 5x more frequent.
$overrides = @()
foreach ($k in @($tb.Keys)) {
  $v = $verbs[$k]
  $groups = $tb[$k] | Group-Object { "$($_[0])|$($_[1])|$($_[2])" }
  foreach ($gr in $groups) {
    $kind, $slot, $form = $gr.Name.Split('|'); $slot = [int]$slot
    $ours = if ($kind -eq 'pres') { $v.pres[$slot] } else { $v.past[$slot] }
    if ($form -eq $ours -or $gr.Count -lt 2) { continue }
    if ($kind -eq 'past' -and $form -notmatch @('[^aeiouyáéíóúý]l$', 'la$', 'lo$', 'li$')[$slot]) { continue }   # must be the right past form for the slot
    if ((($freq[$form] ?? 0) -lt 5 * [math]::Max(1, ($freq[$ours] ?? 0)))) { continue }
    if ($kind -eq 'pres') { $v.pres[$slot] = $form } else {
      # past: -l/-la/-lo/-li share one stem, so fix the whole row consistently
      $stemOld = $ours -replace '(l|la|lo|li)$', ''; $stemNew = $form -replace '(l|la|lo|li)$', ''
      for ($i = 0; $i -lt 4; $i++) { if ($v.past[$i] -and $v.past[$i].StartsWith($stemOld)) { $v.past[$i] = $stemNew + $v.past[$i].Substring($stemOld.Length) } }
    }
    $overrides += "$k ${kind}${slot}: $ours → $form ($($freq[$form]) vs $($freq[$ours] ?? 0))"
  }
}
"overrides from usage: " + ($(if ($overrides) { $overrides -join '; ' } else { 'none' }))

$hit = 0; $miss = 0; $bad = @{}
foreach ($k in $tb.Keys) {
  $v = $verbs[$k]
  foreach ($x in $tb[$k]) {
    $ours = if ($x[0] -eq 'pres') { $v.pres[$x[1]] } else { $v.past[$x[1]] }
    if ($ours -eq $x[2]) { $hit++ } else { $miss++; $bad[$k] = @($bad[$k]) + "$($x[0])$($x[1]):$($x[2])≠$ours" }
  }
}
foreach ($k in $verbs.Keys) { $verbs[$k].tb = @($tb[$k]).Count }

New-Item -ItemType Directory -Force "$Root/work" | Out-Null
@($verbs.Values) | ConvertTo-Json -Depth 4 -Compress | Set-Content "$Root/work/conj_all.json" -Encoding utf8
$keep = @($verbs.Values | Sort-Object { -$_.score } | Select-Object -First $Top)
$keep | ConvertTo-Json -Depth 4 | Set-Content "$Root/data/conj.json" -Encoding utf8
"decoded verbs: $($verbs.Count)   top kept: $($keep.Count)"
"treebank check: $hit match / $miss mismatch  (verbs with a mismatch: $($bad.Count))"
$bad.GetEnumerator() | Sort-Object { -$verbs[$_.Key].score } | Select-Object -First 20 | ForEach-Object { "  $($_.Key): $(($_.Value | Select-Object -Unique -First 4) -join ' ')" }
"top 40: " + (($keep | Select-Object -First 40 | ForEach-Object { $_.w + $(if ($_.refl) { ' ' + $_.refl }) }) -join ', ')
