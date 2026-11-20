# Lookup dictionary (bigger than the game data): every Slovak adjective with a complete table,
# and every Slovak noun's lemma + known forms (for identifying the lemma; the full case table is
# taken from the game data when available, otherwise fetched live from Wiktionary by the app).
# Output: app/lookup-data.js  (loaded only when the Hľadaj page is opened)
param([string]$Root = (Split-Path $PSScriptRoot -Parent))
$ErrorActionPreference = 'Stop'
$alpha = '^[a-záäčďéíĺľňóôŕšťúýž]+$'
$cases = 'nom', 'gen', 'dat', 'acc', 'loc', 'ins'

# adjective slots, fixed order (same naming as build_data.ps1)
$slots = @()
foreach ($c in $cases) {
  foreach ($g in 'm', 'f', 'n') { if (-not ($c -eq 'acc' -and $g -eq 'm')) { $slots += "sg_${c}_$g" } }
  if ($c -eq 'acc') { $slots += 'sg_acc_m_anim', 'sg_acc_m_inan' }
}
$slots += 'pl_nom_vir', 'pl_nom_nonvir', 'pl_gen', 'pl_dat', 'pl_acc_vir', 'pl_acc_nonvir', 'pl_loc', 'pl_ins'

function Get-Slot($t) {
  $c = ($t | Where-Object { $_ -in 'nominative', 'genitive', 'dative', 'accusative', 'locative', 'instrumental' } | Select-Object -First 1)
  if (-not $c) { return $null }
  $c = $c.Substring(0, 3)
  if ($t -contains 'plural' -or $t -contains 'nonvirile') {
    if ($c -in 'nom', 'acc') { return "pl_${c}_" + $(if ($t -contains 'virile') { 'vir' } else { 'nonvir' }) }
    return "pl_$c"
  }
  $g = if ($t -contains 'feminine') { 'f' } elseif ($t -contains 'neuter') { 'n' } elseif ($t -contains 'masculine') { 'm' } else { return $null }
  if ($c -eq 'acc' -and $g -eq 'm') { return 'sg_acc_m_' + $(if ($t -contains 'animate') { 'anim' } else { 'inan' }) }
  "sg_${c}_$g"
}
function Get-Gloss($o) {
  # first two senses, split into meanings, duplicates removed ("fresh, recent; fresh" -> "fresh, recent")
  $parts = @($o.senses | Where-Object { $_.glosses } | Select-Object -First 2 | ForEach-Object { ($_.glosses[-1] -replace '\s*\([^)]*\)', '') -split '[,;]\s*' } |
    ForEach-Object { $_.Trim() } | Where-Object { $_ } | Select-Object -Unique)
  $g = $parts -join ', '
  if ($g.Length -gt 70) { $g = $g.Substring(0, 70).TrimEnd() + '…' }
  $g
}
$genOf = @{ 'm-pr' = 'm-pers'; 'm-an' = 'm-anim'; 'm-anml' = 'm-anim'; 'm-in' = 'm-inan'; 'f' = 'f'; 'n' = 'n' }
$header = 'singular', 'plural', 'nominative', 'genitive', 'dative', 'accusative', 'locative', 'instrumental', 'vocative'

$adjs = [ordered]@{}; $nouns = [ordered]@{}
foreach ($line in [IO.File]::ReadLines("$Root/raw/sk.jsonl")) {
  $isA = $line.Contains('"sk-adecl"'); $isN = $line.Contains('"sk-ndecl"')
  if (-not ($isA -or $isN)) { continue }
  $o = $line | ConvertFrom-Json
  if ($o.lang_code -ne 'sk' -or $o.word -cnotmatch $alpha) { continue }
  if ($isA -and $o.pos -eq 'adj' -and -not $adjs.Contains($o.word)) {
    $f = @{}; $bad = $false
    foreach ($x in $o.forms) {
      if (-not $x.tags -or ($x.tags | Where-Object { $_ -in 'comparative', 'superlative', 'adverb', 'table-tags', 'inflection-template', 'error-unrecognized-form' })) { continue }
      $k = Get-Slot $x.tags; if (-not $k) { continue }
      if ($x.form -cnotmatch $alpha) { $bad = $true; break }
      if (-not $f[$k]) { $f[$k] = $x.form }
    }
    if ($bad -or ($slots | Where-Object { -not $f[$_] })) { continue }
    $adjs[$o.word] = @($o.word, (Get-Gloss $o), @($slots | ForEach-Object { $f[$_] }))
  }
  elseif ($isN -and $o.pos -eq 'noun' -and -not $nouns.Contains($o.word)) {
    $tpl = $o.inflection_templates | Where-Object name -eq 'sk-ndecl' | Select-Object -First 1
    if ($tpl.args.n) { continue }   # singular-/plural-only: skip (table shape differs)
    $gen = $genOf[$tpl.args.'1']; if (-not $gen) { continue }
    $forms = @($o.forms | Where-Object { -not $_.tags -and $_.form -cmatch $alpha -and $_.form -notin $header } | ForEach-Object form | Select-Object -Unique)
    if ($forms.Count -lt 4) { continue }
    $nouns[$o.word] = @($o.word, (Get-Gloss $o), $gen, $forms)
  }
}

# verbs (scripts/build_conj.ps1 -> work/conj_all.json): every decodable verb, for looking up verb forms
$verbsL = @()
if (Test-Path "$Root/work/conj_all.json") {
  $verbsL = @(Get-Content "$Root/work/conj_all.json" -Raw | ConvertFrom-Json | ForEach-Object {
    , @($_.w, $_.refl, $_.g, $_.asp, $_.partner, @($_.pres), @($_.past), @($_.imp))
  })
}

$bundle = [ordered]@{ slots = $slots; adjs = @($adjs.Values); nouns = @($nouns.Values); verbs = $verbsL }
$json = $bundle | ConvertTo-Json -Depth 5 -Compress
Set-Content "$Root/app/lookup-data.js" -Value "window.PADY_LOOKUP = $json;" -Encoding utf8
"lookup-data.js: $([math]::Round((Get-Item "$Root/app/lookup-data.js").Length / 1KB)) KB  adjectives $($adjs.Count)  nouns $($nouns.Count)"
$c = $adjs['čerstvý']; if ($c) { "čerstvý: $($c[1]) | " + ($c[2] -join ' ') }
