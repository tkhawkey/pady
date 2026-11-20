# Stage 2: count verb -> (preposition +) case frames in the Slovak UD treebank (SNK), keeping example sentences.
param([string]$Root = (Split-Path $PSScriptRoot -Parent))
$ErrorActionPreference = 'Stop'
$argRels = @('obj', 'iobj', 'obl:arg')
$caseMap = @{ Gen = 'G'; Dat = 'D'; Acc = 'A'; Loc = 'L'; Ins = 'I' }
$frames = @{}   # key "lemma|frame" -> @{count; examples}

function Add-Sentence($toks, $text) {
  $byId = @{}
  foreach ($t in $toks) { $byId[$t.id] = $t }
  foreach ($t in $toks) {
    if ($argRels -notcontains $t.rel) { continue }
    if ($t.upos -notin 'NOUN', 'PRON', 'PROPN', 'DET', 'ADJ') { continue }
    $head = $byId[$t.head]
    if (-not $head -or $head.upos -ne 'VERB') { continue }
    if ($t.feats -notmatch 'Case=(\w+)') { continue }
    $case = $caseMap[$Matches[1]]
    if (-not $case) { continue }
    $prep = ($toks | Where-Object { $_.head -eq $t.id -and $_.rel -eq 'case' } | Select-Object -First 1).lemma
    $refl = ($toks | Where-Object { $_.head -eq $head.id -and $_.rel -eq 'expl:pv' } | Select-Object -First 1).lemma
    $lemma = if ($refl) { "$($head.lemma) $refl" } else { $head.lemma }
    $frame = if ($prep) { "$($prep.ToLower())+$case" } else { $case }
    $key = "$lemma|$frame"
    if (-not $frames[$key]) { $frames[$key] = @{ count = 0; examples = [Collections.Generic.List[object]]::new() } }
    $frames[$key].count++
    # keep the governed word too (form, lemma, part of speech, number) so games can blank it out
    if ($frames[$key].examples.Count -lt 8 -and $text.Length -lt 110) {
      $num = if ($t.feats -match 'Number=Plur') { 'p' } else { 's' }
      $frames[$key].examples.Add([ordered]@{ t = $text; f = $t.form; l = $t.lemma; u = $t.upos; num = $num })
    }
  }
}

foreach ($f in Get-ChildItem "$Root/raw/ud/*.conllu") {
  $toks = [Collections.Generic.List[object]]::new(); $text = ''
  foreach ($l in [IO.File]::ReadLines($f.FullName)) {
    if ($l.StartsWith('# text = ')) { $text = $l.Substring(9); continue }
    if ($l -eq '') { if ($toks.Count) { Add-Sentence $toks $text }; $toks = [Collections.Generic.List[object]]::new(); continue }
    if ($l[0] -eq '#') { continue }
    $p = $l.Split("`t")
    if ($p[0] -notmatch '^\d+$') { continue }
    $toks.Add([pscustomobject]@{ id = $p[0]; form = $p[1]; lemma = $p[2]; upos = $p[3]; feats = $p[5]; head = $p[6]; rel = $p[7] })
  }
  if ($toks.Count) { Add-Sentence $toks $text }
}

$out = $frames.GetEnumerator() | ForEach-Object {
  $lemma, $frame = $_.Key.Split('|')
  [pscustomobject]@{ verb = $lemma; frame = $frame; count = $_.Value.count; examples = @($_.Value.examples) }
} | Sort-Object count -Descending
$out | ConvertTo-Json -Depth 5 | Set-Content "$Root/work/ud_frames.json"
"frames: $($out.Count)  (count>=3: $(($out | Where-Object count -ge 3).Count))"
