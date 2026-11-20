# Tatoeba Slovak–English pairs -> short real example sentences (with English) for every word we know.
#   in : <Src>/Sentence pairs in Slovak-English*.tsv   (id \t slovak \t id \t english; Tatoeba, CC BY 2.0 FR)
#        app/data.js + app/lookup-data.js             (all forms of every noun, adjective and verb)
#        <Src>/.../araneum_top60k.tsv                  (function words, so "to", "si", "ten" never count as a hit)
#   out: work/tatoeba_ex.json   { lemma: [[slovak, english, form, tatoebaId], ...] }   (up to 3 per word)
# A form only counts when exactly one of our lemmas owns it (so "je" -> byť? jesť? is skipped).
param(
  [string]$Root = (Split-Path $PSScriptRoot -Parent),
  [string]$Src = 'C:\Users\ThomasHawkey\Desktop\Slovak App',
  [int]$PerWord = 3
)
$ErrorActionPreference = 'Stop'

function Read-JsObject($path) { $t = Get-Content $path -Raw -Encoding utf8; $t.Substring($t.IndexOf('{')).TrimEnd().TrimEnd(';') | ConvertFrom-Json }

# ---- 1. form -> lemma ownership --------------------------------------------------------------
$owners = @{}   # form -> hashset of lemma keys
function Add-Form($form, $key) {
  if (-not $form) { return }
  foreach ($f in ("$form" -split '[,/]')) {
    $f = $f.Trim().ToLowerInvariant(); if ($f.Length -lt 2 -or $f -match '\s') { continue }
    if (-not $owners.ContainsKey($f)) { $owners[$f] = [System.Collections.Generic.HashSet[string]]::new() }
    [void]$owners[$f].Add($key)
  }
}
$D = Read-JsObject "$Root/app/data.js"
$L = Read-JsObject "$Root/app/lookup-data.js"
foreach ($n in $D.nouns) { foreach ($f in @($n.s) + @($n.p)) { Add-Form $f $n.w }; foreach ($p in $n.alt.PSObject.Properties) { foreach ($f in $p.Value) { Add-Form $f $n.w } } }
foreach ($n in $L.nouns) { foreach ($f in $n[3]) { Add-Form $f $n[0] } }
foreach ($a in $D.adjs) { foreach ($p in $a.f.PSObject.Properties) { Add-Form $p.Value $a.w } }
foreach ($a in $L.adjs) { foreach ($f in $a[2]) { Add-Form $f $a[0] } }
foreach ($v in $L.verbs) { $k = $v[0]; Add-Form $k $k; foreach ($i in 5, 6, 7) { foreach ($f in @($v[$i])) { Add-Form $f $k } } }
foreach ($v in $D.conj) { Add-Form $v.w $v.w; foreach ($f in @($v.s) + @($v.l) + @($v.i)) { Add-Form $f $v.w } }

# function words never count (to, ten, si, moja, všetko…): any Araneum lemma that is not a noun/adj/verb/adverb, top 3000
$stop = @{}
$ara = Get-ChildItem $Src -Recurse -Filter 'araneum_top60k.tsv' | Select-Object -First 1
foreach ($line in (Get-Content $ara.FullName -Encoding utf8 -TotalCount 3000)) {
  $c = $line -split "`t"; if ($c[2] -notin 'S', 'A', 'V', 'D') { $stop[$c[1].ToLowerInvariant()] = 1 }
}
$unique = @{}
foreach ($f in $owners.Keys) { if ($owners[$f].Count -eq 1 -and -not $stop[$f]) { $unique[$f] = @($owners[$f])[0] } }
"forms: $($owners.Count)  uniquely owned: $($unique.Count)"

# ---- 2. clean, short sentence pairs ----------------------------------------------------------------
$badEn = '(?i)\b(sex\w*|penis|vagina|breasts?|naked|nude|fuck\w*|shit\w*|bitch\w*|whore|prostitut\w*|rap(e|ed|ist)|porn\w*|condoms?|masturbat\w*|orgasm\w*|erections?|virgin\w*|nazi\w*|hitler|suicide|kill\w*|murder\w*|drugs?|cocaine|heroin|guns?|pistol|dick|cock|pussy|ass|asshole|bastard|slut|testicles?|nipples?|panties|nigg\w*|negro|corpse|bomb\w*|terroris\w*)\b'
$badSk = '(?i)(kurv|pič|jeb|kokot|chuj|prdel|sex|penis|vagín|drog|zabi[ťlj])'
$pairs = [ordered]@{}
foreach ($line in (Get-Content (Get-ChildItem $Src -Filter 'Sentence pairs in Slovak-English*.tsv' | Select-Object -First 1).FullName -Encoding utf8)) {
  $c = $line -split "`t"; if ($c.Count -lt 4) { continue }
  $sid = $c[0]; $sk = $c[1].Trim(); $en = $c[3].Trim()
  if ($pairs.Contains($sid)) { if ($en.Length -lt $pairs[$sid].en.Length) { $pairs[$sid].en = $en }; continue }   # shortest English wins
  $nw = ($sk -split '\s+').Count
  if ($nw -lt 2 -or $nw -gt 9 -or $sk.Length -gt 60 -or $sk -match '\d' -or $sk -match $badSk -or $en -match $badEn) { continue }
  $pairs[$sid] = [pscustomobject]@{ sk = $sk; en = $en; nw = $nw }
}
"clean pairs: $($pairs.Count)"

# ---- 3. index: lemma -> candidate sentences ---------------------------------------------------------
$cand = @{}
foreach ($sid in $pairs.Keys) {
  $p = $pairs[$sid]
  $toks = [regex]::Matches($p.sk, '\p{L}+') | ForEach-Object { $_.Value }
  $seen = @{}
  foreach ($t in $toks) {
    $lemma = $unique[$t.ToLowerInvariant()]; if (-not $lemma -or $seen[$lemma]) { continue }; $seen[$lemma] = 1
    if (-not $cand.ContainsKey($lemma)) { $cand[$lemma] = [System.Collections.Generic.List[object]]::new() }
    # best: 3–7 words; the English is short too; "Tom" a little less (Tatoeba is full of him)
    $score = [math]::Abs($p.nw - 5) + ($p.en.Length / 40) + $(if ($p.sk -match '\bTom') { 1 } else { 0 })
    $cand[$lemma].Add([pscustomobject]@{ sid = $sid; form = $t; score = $score })
  }
}

# ---- 4. pick up to $PerWord per lemma, different forms first, no sentence used twice per word ----------
$out = [ordered]@{}
foreach ($lemma in ($cand.Keys | Sort-Object)) {
  $pick = @(); $forms = @{}
  $sorted = $cand[$lemma] | Sort-Object score, sid
  foreach ($round in 1, 2) {
    foreach ($c in $sorted) {
      if ($pick.Count -ge $PerWord) { break }
      if ($pick.sid -contains $c.sid) { continue }
      if ($round -eq 1 -and $forms[$c.form.ToLowerInvariant()]) { continue }
      $forms[$c.form.ToLowerInvariant()] = 1
      $pick += $c
    }
  }
  $out[$lemma] = @($pick | ForEach-Object { , @($pairs[$_.sid].sk, $pairs[$_.sid].en, $_.form, [int]$_.sid) })
}
New-Item -ItemType Directory -Force "$Root/work" | Out-Null
$out | ConvertTo-Json -Depth 4 -Compress | Set-Content "$Root/work/tatoeba_ex.json" -Encoding utf8
$inBundle = @($D.nouns.w) + @($D.adjs.w) + @($D.conj.w)
"lemmas with examples: $($out.Count)   bundle words covered: $(@($inBundle | Where-Object { $out.Contains($_) }).Count) / $($inBundle.Count)"
"size: $([math]::Round((Get-Item "$Root/work/tatoeba_ex.json").Length / 1KB)) KB"
