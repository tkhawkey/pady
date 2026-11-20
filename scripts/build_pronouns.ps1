# Real treebank sentences with a personal pronoun in an oblique case (mňa, mi, jeho, ho, neho, ňom, nám…),
# for the "Zámená" drill: blank the pronoun, show which pronoun it is (ja, on, ona…), pick the right form.
#   in : raw/ud/*.conllu     out: work/pron_sents.json
#   item: { t: [[form, noSpaceAfter]...], i: blank index, a: form, p: pronoun (ja|ty|on|ona|ono|my|vy|oni|ony), k: case, pr: preposition or '' }
param([string]$Root = (Split-Path $PSScriptRoot -Parent), [int]$PerPron = 60)
$ErrorActionPreference = 'Stop'
$CASEK = @{ Gen = 'gen'; Dat = 'dat'; Acc = 'acc'; Loc = 'loc'; Ins = 'ins' }
# forms we teach (Wiktionary, kaikki dump); anything else in the treebank (archaic "preň", "zaň") is skipped
$FORMS = @{
  ja = 'mňa ma mne mi mnou'; ty = 'teba ťa tebe ti tebou'; on = 'jeho ho neho jemu mu nemu ňom ním'; ono = 'jeho ho neho jemu mu nemu ňom ním'
  ona = 'jej nej ju ňu ňou'; my = 'nás nám nami'; vy = 'vás vám vami'; oni = 'ich nich im nim nimi'; ony = 'ich nich im nim nimi ne'
}
$items = @{}; foreach ($k in $FORMS.Keys) { $items[$k] = [System.Collections.Generic.List[object]]::new() }

function Add-Sentence($toks) {
  if ($toks.Count -gt 16) { return }
  # enough context to decide the case ("Mne nie!" could just as well be "Mňa nie!")
  if (@($toks | Where-Object { $_.form -match '\p{L}' }).Count -lt 5) { return }
  $uposOf = @{}; foreach ($x in $toks) { $uposOf[$x.id] = $x.upos }
  if (@($toks | Where-Object { $_.form -match '\d' }).Count) { return }
  $t = @($toks | ForEach-Object { , @($_.form, [int]($_.misc -match 'SpaceAfter=No')) })
  for ($j = 0; $j -lt $toks.Count; $j++) {
    $w = $toks[$j]; $f = $w.feats
    if ($w.upos -ne 'PRON' -or $f -notmatch 'PronType=Prs' -or $f -match 'Poss=Yes|Reflex=Yes') { continue }
    if ($f -notmatch 'Case=(Gen|Dat|Acc|Loc|Ins)') { continue }; $ck = $CASEK[$Matches[1]]
    $per = if ($f -match 'Person=(\d)') { $Matches[1] } else { continue }
    $pl = $f -match 'Number=Plur'
    $p = switch ($per) {
      '1' { if ($pl) { 'my' } else { 'ja' } }
      '2' { if ($pl) { 'vy' } else { 'ty' } }
      '3' { if ($pl) { if ($f -match 'Gender=Masc' -and $f -match 'Animacy=Anim') { 'oni' } else { 'ony' } }
            elseif ($f -match 'Gender=Fem') { 'ona' } elseif ($f -match 'Gender=Neut') { 'ono' } else { 'on' } }
    }
    $fl = $w.form.ToLowerInvariant()
    if ($fl -notin ($FORMS[$p] -split ' ')) { continue }
    if ($p -eq 'ony' -and $fl -ne 'ne' -and (Get-Random -Maximum 3)) { continue }   # ony = oni except "ne": keep a few
    # the preposition that governs it (the token right before, attached to the pronoun)
    $pr = ''
    if ($j -gt 0 -and $toks[$j - 1].upos -eq 'ADP' -and $toks[$j - 1].head -eq $w.id) { $pr = $toks[$j - 1].form.ToLowerInvariant() }
    # the clue must be in the sentence: a preposition, or the verb / adjective it hangs on
    if (-not $pr -and $uposOf[$w.head] -notin 'VERB', 'AUX', 'ADJ') { continue }
    $items[$p].Add(@{ t = $t; i = $j; a = $w.form; p = $p; k = $ck; pr = $pr })
  }
}
foreach ($file in Get-ChildItem "$Root/raw/ud/*.conllu") {
  $toks = [System.Collections.Generic.List[object]]::new()
  foreach ($line in [IO.File]::ReadLines($file.FullName)) {
    if ($line -eq '') { if ($toks.Count) { Add-Sentence $toks }; $toks = [System.Collections.Generic.List[object]]::new(); continue }
    if ($line[0] -eq '#') { continue }
    $c = $line.Split("`t"); if ($c[0] -notmatch '^\d+$') { continue }
    $toks.Add([pscustomobject]@{ id = $c[0]; form = $c[1]; upos = $c[3]; feats = $c[5]; head = $c[6]; misc = $c[9] })
  }
}
"found: " + (($items.Keys | Sort-Object | ForEach-Object { "$_ $($items[$_].Count)" }) -join ', ')
# per pronoun: spread over forms (so "ňom", "mnou" show up, not only "ho" and "mi"), shorter sentences first
$out = foreach ($p in $items.Keys) {
  $byForm = $items[$p] | Group-Object { $_.a.ToLowerInvariant() }
  $per = [math]::Max(4, [int]($PerPron / [math]::Max(1, $byForm.Count)))
  foreach ($g in $byForm) { $g.Group | Sort-Object { $_.t.Count } | Select-Object -First $per }
}
$out = @($out)
$out | ConvertTo-Json -Depth 5 -Compress | Set-Content "$Root/work/pron_sents.json" -Encoding utf8
"kept $($out.Count)  (" + (($out | Group-Object p | ForEach-Object { "$($_.Name) $($_.Count)" }) -join ', ') + ")   $([math]::Round((Get-Item "$Root/work/pron_sents.json").Length / 1KB)) KB"
$out | Get-Random -Count 8 -SetSeed 5 | ForEach-Object { $it = $_; "  [$($it.p) $($it.k)$(if ($it.pr) { ' after ' + $it.pr })] " + (-join (0..($it.t.Count - 1) | ForEach-Object { $(if ($_ -eq $it.i) { "[$($it.a)]" } else { $it.t[$_][0] }) + $(if ($it.t[$_][1]) { '' } else { ' ' }) })) }
