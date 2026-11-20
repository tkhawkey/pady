# Stage 6: pack data/*.json into app/data.js (a plain script, so the app opens straight from disk).
#   nouns: { w, g, gen, pat, s:[6 forms], p:[6 forms], alt:{ "gen_p":[...] } }   case order: nom gen dat acc loc ins
#   adjs:  { w, g, k, f:{ slot: form } }
#   verbs: { v, g, fr:[{ p, c, n, ex:[...] }] }   core frames only
param([string]$Root = (Split-Path $PSScriptRoot -Parent))
$ErrorActionPreference = 'Stop'
$cases = 'nom', 'gen', 'dat', 'acc', 'loc', 'ins'

function Get-Short($gloss) {
  $g = ($gloss -split ';')[0] -replace '\([^)]*\)?', '' -replace '\s+', ' '
  ((($g -split ',') | ForEach-Object { $_.Trim() } | Where-Object { $_ } | Select-Object -First 2) -join ', ')
}

# drop blocklisted nouns; order the rest by "own" frequency from check_homographs.ps1 (if it has been run)
$block = @(Get-Content "$Root/scripts/noun_blocklist.txt" | ForEach-Object { ($_ -replace '#.*$', '').Trim() } | Where-Object { $_ })
$ownRank = @{}
if (Test-Path "$Root/work/noun_ownership.json") {
  foreach ($r in (Get-Content "$Root/work/noun_ownership.json" -Raw | ConvertFrom-Json)) { $ownRank[$r.word] = $r.ownRank }
}
$srcNouns = Get-Content "$Root/data/nouns.json" -Raw | ConvertFrom-Json |
  Where-Object { $_.word -notin $block } |
  Sort-Object { $ownRank[$_.word] ?? 9999 }

# blend the subtitle order (spoken, everyday) with Araneum lemma+POS ranks (scripts/build_araneum.ps1):
# position = geometric mean of the two positions within our list; words missing from Araneum keep their own.
$ara = if (Test-Path "$Root/data/freq_araneum.json") { Get-Content "$Root/data/freq_araneum.json" -Raw | ConvertFrom-Json } else { $null }
function Get-Blended($items, $pos, $key) {
  $items = @($items); if (-not $ara) { return $items }
  $sub = @{}; for ($i = 0; $i -lt $items.Count; $i++) { $sub[(& $key $items[$i])] = $i + 1 }
  $aPos = @{}; $j = 0
  foreach ($w in ($items | ForEach-Object { & $key $_ } | Where-Object { $ara.$pos.$_ } | Sort-Object { $ara.$pos.$_ })) { $j++; $aPos[$w] = $j }
  $items | Sort-Object { $w = & $key $_; [math]::Sqrt($sub[$w] * ($aPos[$w] ?? $sub[$w])) }
}
$srcNouns = Get-Blended $srcNouns 'S' { param($x) $x.word }
# hand fixes (scripts/noun_overrides.json) and extra accepted variants from the Štúr cross-check (data/stur_alts.json)
$over = Get-Content "$Root/scripts/noun_overrides.json" -Raw | ConvertFrom-Json
$sturAlts = if (Test-Path "$Root/data/stur_alts.json") { Get-Content "$Root/data/stur_alts.json" -Raw | ConvertFrom-Json } else { $null }
$nouns = foreach ($n in $srcNouns) {
  $o = $over.($n.word)
  if ($o) {
    if ($o.gender) { $n.gender = $o.gender }; if ($o.pattern) { $n.pattern = $o.pattern }
    for ($i = 0; $i -lt 6; $i++) { if ($o.sg) { $n.sg.($cases[$i]) = $o.sg[$i] }; if ($o.pl) { $n.pl.($cases[$i]) = $o.pl[$i] } }
    if ($null -ne $o.alt) { $n.alt = $o.alt }
  }
  $alt = [ordered]@{}
  foreach ($p in $n.alt.PSObject.Properties) { $alt[$p.Name] = @($p.Value) }
  if ($sturAlts.($n.word) -and -not $o) {
    foreach ($p in $sturAlts.($n.word).PSObject.Properties) { $alt[$p.Name] = @(@($alt[$p.Name]) + @($p.Value) | Where-Object { $_ } | Select-Object -Unique) }
  }
  [ordered]@{
    w = $n.word; g = (Get-Short $n.gloss).Trim(); gen = $n.gender
    pat = $(if ($n.pattern) { $n.pattern } else { 'other' })
    s = @($cases | ForEach-Object { $n.sg.$_ }); p = @($cases | ForEach-Object { $n.pl.$_ }); alt = $alt
  }
}

$adjs = foreach ($a in (Get-Blended (Get-Content "$Root/data/adjectives.json" -Raw | ConvertFrom-Json) 'A' { param($x) $x.word })) {
  $f = [ordered]@{}
  foreach ($p in $a.forms.PSObject.Properties) { $f[$p.Name] = $p.Value }
  [ordered]@{ w = $a.word; g = (Get-Short $a.gloss).Trim(); k = $a.kind; f = $f }
}

$nounLemmas = @{}
foreach ($n in $nouns) { $nounLemmas[$n.w] = 1 }
foreach ($m in (Get-Content "$Root/data/models.json" -Raw | ConvertFrom-Json)) { $nounLemmas[$m.w] = 1 }
$verbs = foreach ($v in (Get-Content "$Root/data/verbs.json" -Raw | ConvertFrom-Json)) {
  $fr = @($v.frames | Where-Object core | ForEach-Object {
    $exs = @($_.examples)
    # ex: sentences to show; cz: fill-the-blank items (the governed word is a noun we have a table for)
    $cz = @($exs | Where-Object { $_.u -eq 'NOUN' -and $nounLemmas[$_.l] -and $_.t -match "(?<![\p{L}])$([regex]::Escape($_.f))(?![\p{L}])" } |
      Select-Object -First 4 | ForEach-Object { [ordered]@{ t = $_.t; f = $_.f; l = $_.l; num = $_.num } })
    [ordered]@{ p = $_.prep; c = $_.case; n = $_.corpusCount; ex = @($exs | Select-Object -First 3 | ForEach-Object { $_.t }); cz = $cz }
  })
  if ($fr.Count) { [ordered]@{ v = $v.verb; g = $v.gloss; gs = $v.glossSource; fr = $fr } }
}

$models = @(Get-Content "$Root/data/models.json" -Raw | ConvertFrom-Json | ForEach-Object {
  $alt = [ordered]@{}; foreach ($p in $_.alt.PSObject.Properties) { $alt[$p.Name] = @($p.Value) }
  [ordered]@{ w = $_.w; gen = $_.gen; s = @($_.s); p = @($_.p); alt = $alt }
})

# real adjective+noun pairs (treebank), only where both words made it into the bundle
$pairs = [ordered]@{}
if (Test-Path "$Root/work/adj_pairs.json") {
  $haveA = @{}; foreach ($a in $adjs) { $haveA[$a.w] = 1 }
  $haveN = @{}; foreach ($n in $nouns) { $haveN[$n.w] = 1 }
  foreach ($p in (Get-Content "$Root/work/adj_pairs.json" -Raw | ConvertFrom-Json).PSObject.Properties) {
    if (-not $haveN[$p.Name]) { continue }
    $list = @($p.Value | Where-Object { $haveA[$_.a] } | ForEach-Object { $_.a })
    if ($list.Count) { $pairs[$p.Name] = $list }
  }
}

$sents = if (Test-Path "$Root/work/sentences.json") { Get-Content "$Root/work/sentences.json" -Raw | ConvertFrom-Json } else { @() }

# meanings for every noun/adjective lemma in the sentences (shown inline after "Vyfarbi vetu")
$sentGloss = [ordered]@{}
if (Test-Path "$Root/work/sentence_glosses.json") {
  foreach ($p in (Get-Content "$Root/work/sentence_glosses.json" -Raw | ConvertFrom-Json).PSObject.Properties) { $sentGloss[$p.Name] = $p.Value }
}
$need = @{}; foreach ($s in $sents) { foreach ($t in $s) { if ($t[3]) { $need[$t[3]] = 1 } } }
foreach ($f in 'nouns_candidates.json', 'adj_candidates.json') {
  if (-not (Test-Path "$Root/work/$f")) { continue }
  foreach ($c in (Get-Content "$Root/work/$f" -Raw | ConvertFrom-Json)) {
    if ($need[$c.word] -and -not $sentGloss.Contains($c.word) -and $c.gloss) { $sentGloss[$c.word] = (Get-Short $c.gloss).Trim() }
  }
}

# verb conjugations for the Slovesá side (scripts/build_conj.ps1)
$conj = @()
if (Test-Path "$Root/data/conj.json") {
  # aspect pairs are only trusted when BOTH verbs name each other as partner (checked across all ~800 decoded verbs)
  $partnerOf = @{}
  if (Test-Path "$Root/work/conj_all.json") { foreach ($v in (Get-Content "$Root/work/conj_all.json" -Raw | ConvertFrom-Json)) { if ($v.partner) { $partnerOf[$v.w] = $v.partner } } }
  $crude = @('prdieť', 'srať', 'jebať', 'chcať', 'drbať', 'šukať', 'mrdať', 'naštvať', 'močiť')
  $conjSrc = Get-Blended (Get-Content "$Root/data/conj.json" -Raw | ConvertFrom-Json | Where-Object { $_.asp -in 'impf', 'pf' -and $_.w -notin $crude }) 'V' { param($x) $x.w }
  $conj = @($conjSrc | ForEach-Object {
    $pr = $_.partner
    # trusted: mutual, or the perfective = a standard prefix + the imperfective (vidieť → uvidieť, čítať → prečítať)
    $prefixed = $pr -and $_.asp -eq 'impf' -and $pr -match "^(u|na|z|s|zo|so|po|pre|vy|za|o|ob|pri|do|od|roz|pod|nad|v)$([regex]::Escape($_.w))$"
    $mutual = $pr -and ($partnerOf[$pr] -eq $_.w -or $prefixed)
    [ordered]@{ w = $_.w; r = $_.refl; g = (Get-Short $_.g).Trim(); a = $_.asp; c = $_.cls; pr = $(if ($mutual) { $pr } else { $null }); s = @($_.pres); l = @($_.past); i = @($_.imp) }
  })
  "aspect pairs (mutual): $(@($conj | Where-Object { $_.pr -and $_.a -eq 'impf' }).Count)"
}

# verb sentences for "Vyfarbi vetu" on the verb side (scripts/build_vsentences.ps1)
$vsents = if (Test-Path "$Root/work/vsentences.json") { Get-Content "$Root/work/vsentences.json" -Raw | ConvertFrom-Json } else { @() }
$vgloss = [ordered]@{}
if (Test-Path "$Root/work/vsentence_glosses.json") {
  foreach ($p in (Get-Content "$Root/work/vsentence_glosses.json" -Raw | ConvertFrom-Json).PSObject.Properties) { $vgloss[$p.Name] = (Get-Short $p.Value).Trim() }
}

# real example sentences with English (scripts/build_tatoeba.ps1): game words here, the rest go to lookup-data.js
$ex = [ordered]@{}
if (Test-Path "$Root/work/tatoeba_ex.json") {
  $tat = Get-Content "$Root/work/tatoeba_ex.json" -Raw | ConvertFrom-Json
  foreach ($w in (@($nouns | ForEach-Object { $_.w }) + @($adjs | ForEach-Object { $_.w }) + @($conj | ForEach-Object { $_.w }) + @($models | ForEach-Object { $_.w }))) {
    if ($tat.$w -and -not $ex.Contains($w)) { $ex[$w] = @($tat.$w | ForEach-Object { , @($_) }) }
  }
  "examples (game words): $($ex.Count)"
}

# Pasca (traps) items from the treebank (scripts/build_traps.ps1)
$traps = if (Test-Path "$Root/work/traps.json") { @(Get-Content "$Root/work/traps.json" -Raw | ConvertFrom-Json) } else { @() }

$prons = if (Test-Path "$Root/work/pron_sents.json") { @(Get-Content "$Root/work/pron_sents.json" -Raw | ConvertFrom-Json) } else { @() }

$bundle = [ordered]@{ prons = $prons; traps = $traps; ex = $ex; conj = $conj; vsents = @($vsents); vglosses = $vgloss; nouns = @($nouns); adjs = @($adjs); verbs = @($verbs); models = $models; pairs = $pairs; sents = @($sents); glosses = $sentGloss; built = (Get-Date -Format 'yyyy-MM-dd') }
New-Item -ItemType Directory -Force "$Root/app" | Out-Null
$json = $bundle | ConvertTo-Json -Depth 8 -Compress
Set-Content "$Root/app/data.js" -Value "window.PADY_DATA = $json;" -Encoding utf8
"data.js: $([math]::Round((Get-Item "$Root/app/data.js").Length / 1KB)) KB  nouns $($nouns.Count)  adjs $($adjs.Count)  verbs $(@($verbs).Count)"
