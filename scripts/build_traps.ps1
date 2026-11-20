# "Pasca" (trap) items: real treebank sentences with one spot blanked where Slovak writers really slip
# (the chiby learner/native error lists put these near the top: s ↔ z, v/vo, ktorý → ktorí …).
#   sz  : s/so + instrumental (with)  vs  z/zo + genitive (from, out of, off)      [the case of the noun decides]
#   voc : v/vo, z/zo, s/so, k/ku: the long form before a "clashing" first sound     [vo vode, so sestrou, ku koncu]
#   vir : masculine-PERSONAL plural -í/-i (dobrí, ktorí, tí, dvaja) vs everything else -é/-e (dobré, ktoré, tie, dve)
# Every item is checked against the rule we teach, so the explanation always fits.
#   in : raw/ud/*.conllu (UD Slovak SNK)      out: work/traps.json
#   item: { c: cat, t: [[form, noSpaceAfter]...], i: blank index, a: answer, x: trap, h: clue index, k: case of clue }
param([string]$Root = (Split-Path $PSScriptRoot -Parent), [int]$PerCat = 160)
$ErrorActionPreference = 'Stop'
$CASEK = @{ Nom = 'nom'; Gen = 'gen'; Dat = 'dat'; Acc = 'acc'; Loc = 'loc'; Ins = 'ins' }

# masculine-personal plural determiners/pronouns/numerals and their "everything else" partner
$VIR = @{ 'ktorí' = 'ktoré'; 'tí' = 'tie'; 'títo' = 'tieto'; 'všetci' = 'všetky'; 'oni' = 'ony'; 'moji' = 'moje'; 'tvoji' = 'tvoje'
  'svoji' = 'svoje'; 'naši' = 'naše'; 'vaši' = 'vaše'; 'akí' = 'aké'; 'takí' = 'také'; 'niektorí' = 'niektoré'; 'žiadni' = 'žiadne'
  'dvaja' = 'dve'; 'traja' = 'tri'; 'štyria' = 'štyri'; 'obaja' = 'obe'; 'sami' = 'samy'; 'iní' = 'iné'; 'ostatní' = 'ostatné'; 'mnohí' = 'mnohé' }
$NONVIR = @{}; foreach ($k in $VIR.Keys) { $NONVIR[$VIR[$k]] = $k }

function Test-Long($prep, $next) {
  $n = $next.ToLowerInvariant()
  switch ($prep) {
    'v' { return $n -match '^[vf]' -or $n -in 'mne', 'mňa' }
    'z' { return $n -match '^[szšž]' -or $n -in 'mňa', 'mne' }
    's' { return $n -match '^[szšž]' -or $n -eq 'mnou' }
    'k' { return $n -match '^[kg]' -or $n -eq 'mne' }
  }
}
$SHORT = @{ vo = 'v'; zo = 'z'; so = 's'; ku = 'k' }; $LONG = @{ v = 'vo'; z = 'zo'; s = 'so'; k = 'ku' }

$items = @{ sz = [System.Collections.Generic.List[object]]::new(); voc = [System.Collections.Generic.List[object]]::new(); vocS = [System.Collections.Generic.List[object]]::new(); vir = [System.Collections.Generic.List[object]]::new(); non = [System.Collections.Generic.List[object]]::new() }
$skipped = @{ vocRule = 0 }

function Add-Sentence($toks) {
  if ($toks.Count -lt 4 -or $toks.Count -gt 18) { return }
  if (@($toks | Where-Object { $_.form -match '\d' }).Count) { return }
  $t = @($toks | ForEach-Object { , @($_.form, [int]($_.misc -match 'SpaceAfter=No')) })
  $byId = @{}; for ($j = 0; $j -lt $toks.Count; $j++) { $byId[$toks[$j].id] = $j }
  for ($j = 0; $j -lt $toks.Count; $j++) {
    $w = $toks[$j]; $f = $w.form; $fl = $f.ToLowerInvariant(); $feats = $w.feats
    $head = $byId[$w.head]; $hk = if ($null -ne $head -and $toks[$head].feats -match 'Case=(\w+)') { $CASEK[$Matches[1]] } else { '' }
    if ($w.upos -eq 'ADP') {
      $case = if ($feats -match 'Case=(\w+)') { $Matches[1] } else { '' }
      $next = if ($j + 1 -lt $toks.Count) { $toks[$j + 1].form } else { '' }
      # s/z: only the clean pairs (s + Ins, z + Gen), keeping the long/short shape of the real form
      if ($fl -in 's', 'so' -and $case -eq 'Ins' -and $null -ne $head) { $items.sz.Add(@{ c = 'sz'; t = $t; i = $j; a = $f; x = $(if ($fl -eq 's') { 'z' } else { 'zo' }); h = $head; k = 'ins' }) }
      if ($fl -in 'z', 'zo' -and $case -eq 'Gen' -and $null -ne $head) { $items.sz.Add(@{ c = 'sz'; t = $t; i = $j; a = $f; x = $(if ($fl -eq 'z') { 's' } else { 'so' }); h = $head; k = 'gen' }) }
      # vo/zo/so/ku, and the short forms as the "no trap here" half
      if ($next -and $fl -in 'v', 'vo', 'z', 'zo', 's', 'so', 'k', 'ku') {
        $short = if ($SHORT[$fl]) { $SHORT[$fl] } else { $fl }
        $isLong = $fl -ne $short; $ruleLong = Test-Long $short $next
        if ($isLong -ne $ruleLong) { $skipped.vocRule++; continue }
        $other = if ($isLong) { $short } else { $LONG[$short] }
        if ($f -cmatch '^\p{Lu}') { $other = $other.Substring(0, 1).ToUpper() + $other.Substring(1) }
        $item = @{ c = 'voc'; t = $t; i = $j; a = $f; x = $other; h = $j + 1; k = '' }
        # short forms only where the long one is never used: next word starts with a vowel or consonant + vowel
        # (before clusters the long form is often optional: vo sne, zo všetkých, so vznikom)
        if ($isLong) { $items.voc.Add($item) } elseif ($next -match '^\p{L}?[aeiouyáéíóúýäô]' -and $next -notmatch '^mn') { $items.vocS.Add($item) }
      }
      continue
    }
    # masculine-personal plural vs the rest (nominative only)
    if ($feats -notmatch 'Case=Nom' -or $feats -notmatch 'Number=Plur') { continue }
    $virile = $feats -match 'Gender=Masc' -and $feats -match 'Animacy=Anim'
    $x = $null
    if ($virile -and $VIR[$fl]) { $x = $VIR[$fl] }
    elseif (-not $virile -and $NONVIR[$fl] -and $feats -match 'Gender=') { $x = $NONVIR[$fl] }
    elseif ($w.upos -eq 'ADJ' -and $feats -match 'Degree=Pos' -and $w.lemma -match 'ý$') {
      $stem = $w.lemma.Substring(0, $w.lemma.Length - 1)
      if ($virile -and $fl -eq "$($stem)í") { $x = "$($stem)é" }
      elseif (-not $virile -and $feats -match 'Gender=(Fem|Neut)|Animacy=Inan' -and $fl -eq "$($stem)é") { $x = "$($stem)í" }
    }
    if (-not $x) { continue }
    if ($f -cmatch '^\p{Lu}') { $x = $x.Substring(0, 1).ToUpper() + $x.Substring(1) }
    # only answerable when the word hangs on a visible noun (Ale oni/ony nič nerobili: can't tell without context)
    $clue = if ($null -ne $head -and $toks[$head].upos -eq 'NOUN') { $head } else { continue }
    $items[$(if ($virile) { 'vir' } else { 'non' })].Add(@{ c = 'vir'; t = $t; i = $j; a = $f; x = $x; h = $clue; k = $(if ($virile) { 'v' } else { 'n' }) })
  }
}

foreach ($file in Get-ChildItem "$Root/raw/ud/*.conllu") {
  $toks = [System.Collections.Generic.List[object]]::new()
  foreach ($line in [IO.File]::ReadLines($file.FullName)) {
    if ($line -eq '') { if ($toks.Count) { Add-Sentence $toks }; $toks = [System.Collections.Generic.List[object]]::new(); continue }
    if ($line[0] -eq '#') { continue }
    $c = $line.Split("`t"); if ($c[0] -notmatch '^\d+$') { continue }
    $toks.Add([pscustomobject]@{ id = $c[0]; form = $c[1]; lemma = $c[2]; upos = $c[3]; feats = $c[5]; head = $c[6]; misc = $c[9] })
  }
}
"found  sz $($items.sz.Count)  voc long $($items.voc.Count) / short $($items.vocS.Count)  vir $($items.vir.Count) / non $($items.non.Count)   (voc not matching the rule, dropped: $($skipped.vocRule))"

# balance: s/z half and half; voc 60% long; vir half and half. Prefer short sentences, one item per sentence per category.
function Get-Pick($list, $n) {
  $seen = @{}
  @($list | Sort-Object { $_.t.Count + (Get-Random -Maximum 6 -SetSeed ($_.i * 7 + $_.t.Count)) } | Where-Object {
    $key = ($_.t | ForEach-Object { $_[0] }) -join ' '; if ($seen[$key]) { $false } else { $seen[$key] = 1; $true } } | Select-Object -First $n)
}
$half = [int]($PerCat / 2)
$out = @()
$out += Get-Pick ($items.sz | Where-Object { $_.k -eq 'ins' }) $half
$out += Get-Pick ($items.sz | Where-Object { $_.k -eq 'gen' }) $half
$out += Get-Pick $items.voc ([int]($PerCat * 0.6))
$out += Get-Pick $items.vocS ([int]($PerCat * 0.4))
$out += Get-Pick $items.vir $half
$out += Get-Pick $items.non $half
$out | ConvertTo-Json -Depth 5 -Compress | Set-Content "$Root/work/traps.json" -Encoding utf8
"kept: " + (($out | Group-Object c | ForEach-Object { "$($_.Name) $($_.Count)" }) -join ', ') + "   size $([math]::Round((Get-Item "$Root/work/traps.json").Length / 1KB)) KB"
foreach ($c in 'sz', 'voc', 'vir') {
  $out | Where-Object c -eq $c | Get-Random -Count 4 -SetSeed 11 | ForEach-Object {
    $it = $_; $s = for ($q = 0; $q -lt $it.t.Count; $q++) { $(if ($q -eq $it.i) { "[$($it.a)|$($it.x)]" } else { $it.t[$q][0] }) + $(if ($it.t[$q][1]) { '' } else { ' ' }) }
    "  $c  $(-join $s)"
  }
}
