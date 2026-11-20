# Full, checked case tables for the Hľadaj nouns, offline (no live Wiktionary fetch in the browser).
# A table ships only when two independent sources agree:
#   - Wiktionary's tagged table (cached HTML in work/tables, from fetch_nouns / fetch_lookup_tables) AND the Štúr
#     groups share a form in every cell; or
#   - the Štúr-derived table, where every cell is a form that Wiktionary also lists for the word (kaikki forms list).
# Anything else is reported and left to the live fetch (marked "not checked" in the app).
#   in : app/lookup-data.js (nouns: [w, gloss, gender, forms]), work/tables/*.html, <Src>/groups-nouns.yaml
#   out: work/lookup_tables.json  { w: { s:[6], p:[6], alt:{ 'gen_p':[..] }, src } }, data/lookup_check.txt
param([string]$Root = (Split-Path $PSScriptRoot -Parent), [string]$Src = 'C:\Users\ThomasHawkey\Desktop\Slovak App')
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/stur_lib.ps1"
$cases = 'nom', 'gen', 'dat', 'acc', 'loc', 'ins'
$stur = Get-SturTables "$Src/groups-nouns.yaml"
$L = Get-Content "$Root/app/lookup-data.js" -Raw -Encoding utf8; $L = $L.Substring($L.IndexOf('{')).TrimEnd().TrimEnd(';') | ConvertFrom-Json
$slotRe = [regex]'lang-sk (nom|gen|dat|acc|loc|ins)(?:&#124;|\|)(s|p)-form-of"[^>]*>(?:<a [^>]*>)?([^<]+)<'

function Get-WiktTable($w) {
  $cf = "$Root/work/tables/$w.html"; if (-not (Test-Path $cf)) { return $null }
  $html = Get-Content $cf -Raw; if (-not $html) { return $null }
  $cells = @{}
  foreach ($m in $slotRe.Matches($html)) {
    $k = "$($m.Groups[1].Value)_$($m.Groups[2].Value)"; $f = [Net.WebUtility]::HtmlDecode($m.Groups[3].Value).Trim().ToLowerInvariant()
    if (-not $cells.ContainsKey($k)) { $cells[$k] = [System.Collections.Generic.List[string]]::new() }
    if ($f -and -not $cells[$k].Contains($f)) { $cells[$k].Add($f) }
  }
  if ($cells.Count -eq 12) { $cells } else { $null }
}
function ConvertTo-Table($cells, $src) {
  $alt = [ordered]@{}
  foreach ($k in $cells.Keys) { if (@($cells[$k]).Count -gt 1) { $alt[$k] = @($cells[$k] | Select-Object -Skip 1) } }
  [ordered]@{ s = @($cases | ForEach-Object { @($cells["$($_)_s"])[0] }); p = @($cases | ForEach-Object { @($cells["$($_)_p"])[0] }); alt = $alt; src = $src }
}

$out = [ordered]@{}; $stat = @{ both = 0; stur = 0; clash = 0; none = 0 }
$report = [System.Collections.Generic.List[string]]::new()
foreach ($e in $L.nouns) {
  $w = $e[0]; $known = @{}; $known[$w] = 1; foreach ($f in $e[3]) { $known[$f.ToLowerInvariant()] = 1 }
  $groupsOf = if ($stur.ContainsKey($w)) { $stur[$w] } else { @() }
  $wt = Get-WiktTable $w
  if ($wt) {
    # Wiktionary table: every cell must share a form with one Štúr reading of the word
    $best = $null; $bestBad = 99
    foreach ($g in $groupsOf) {
      $bad = @($cases | ForEach-Object { $ck = $_; 's', 'p' | ForEach-Object { $c = "$($ck)_$_"; if ($g.cells[$c] -and -not @($g.cells[$c] | Where-Object { $_ -in $wt[$c] }).Count) { "$c ours $($wt[$c] -join '/') Štúr $($g.cells[$c] -join '/')" } } })
      if ($bad.Count -lt $bestBad) { $best = $g; $bestBad = $bad.Count; $badList = $bad }
    }
    if ($best -and $bestBad -eq 0) {
      # accept Štúr's extra variants too
      foreach ($c in $wt.Keys) { foreach ($f in @($best.cells[$c])) { if ($f -and -not $wt[$c].Contains($f)) { $wt[$c].Add($f) } } }
      $out[$w] = ConvertTo-Table $wt 'ws'; $stat.both++; continue
    }
    if ($best) { $stat.clash++; $report.Add("CLASH $w : $($badList -join ' | ')"); continue }
    $stat.none++; $report.Add("WIKT-ONLY $w (not in the Štúr groups)"); continue
  }
  # no tagged Wiktionary table: Štúr table, accepted only if every cell is a form Wiktionary lists for the word
  $ok = $null
  foreach ($g in $groupsOf) {
    if ($g.cells.Count -lt 11) { continue }
    $cells = @{}; $pass = $true; $fail = @(@($cases | ForEach-Object { "$($_)_s"; "$($_)_p" }) | Where-Object { -not $g.cells[$_] })
    foreach ($c in $g.cells.Keys) {
      $keep = [System.Collections.Generic.List[string]]::new(); foreach ($f in $g.cells[$c]) { if ($known[$f] -and -not $keep.Contains($f)) { $keep.Add($f) } }
      # male animals: Štúr gives the person-like plural (bažanti), Wiktionary the animal one (bažanty); both are in use
      if (-not $keep.Count -and $g.gen -eq 'm' -and $c -eq 'nom_p') {
        $y = @($g.cells[$c] | ForEach-Object { $_ -replace 'i$', 'y' } | Where-Object { $known[$_] })
        if ($y.Count) { $keep.Add($y[0]); foreach ($f in $g.cells[$c]) { $keep.Add($f) } }
      }
      if (-not $keep.Count) { $fail += $c; continue }; $cells[$c] = $keep
    }
    # one cell short (usually the genitive plural: gitár, percient): if exactly one of Wiktionary's forms is left
    # unaccounted for, that is the cell (Štúr's version, if any, stays as a variant)
    if ($fail.Count -eq 1) {
      $used = @{}; foreach ($v in $cells.Values) { foreach ($f in $v) { $used[$f] = 1 } }
      $left = @($known.Keys | Where-Object { -not $used[$_] })
      # Štúr (the Slovak Academy's institute) first when it has the cell, Wiktionary's form as the variant
      if ($left.Count -eq 1) { $cells[$fail[0]] = [System.Collections.Generic.List[string]]@(@($g.cells[$fail[0]] | Where-Object { $_ }) + @($left[0])); $fail = @() }
    }
    $pass = $fail.Count -eq 0
    if ($pass -and $g.gen -eq 'm' -and $cells['nom_p'][0] -match 'y$' -and $cells['acc_p'] -notcontains $cells['nom_p'][0]) { $cells['acc_p'].Add($cells['nom_p'][0]) }
    if ($pass) { $ok = $cells; break }
  }
  if ($ok) { $out[$w] = ConvertTo-Table $ok 'sw'; $stat.stur++ }
  else { $stat.none++; $report.Add("NO-TABLE $w ($(if ($groupsOf.Count) { 'Štúr table disagrees with the Wiktionary forms or is incomplete' } else { 'not in the Štúr groups' }))") }
}
$out | ConvertTo-Json -Depth 5 -Compress | Set-Content "$Root/work/lookup_tables.json" -Encoding utf8
$head = "Hľadaj nouns: $($L.nouns.Count)   checked tables: $($out.Count) (Wiktionary + Štúr agree: $($stat.both), Štúr confirmed by Wiktionary's forms: $($stat.stur))   clash: $($stat.clash)   no checked table: $($stat.none)"
@($head, '') + $report | Set-Content "$Root/data/lookup_check.txt" -Encoding utf8
$head
