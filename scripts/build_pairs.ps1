# Aspect pairs for Páry and the Vid unit, ranked by how common they are.
# A pair is kept only when Wiktionary backs it:
#   - mutual partners in the decoded verbs (work/conj_all.json), or
#   - a standard textbook pair (list below) that the Wiktionary dump confirms from either side, or
#   - the perfective is a standard prefix + the imperfective (platiť -> zaplatiť, čítať -> prečítať).
# Ranked by the Araneum frequency of the more common verb of the two.
#   out: work/apairs.json  [{ w: imperfective, pr: perfective, g: gloss, r: rank }]
param([string]$Root = (Split-Path $PSScriptRoot -Parent), [string]$Src = 'C:\Users\ThomasHawkey\Desktop\Slovak App')
$ErrorActionPreference = 'Stop'
$TEXTBOOK = 'kupovať:kúpiť dostávať:dostať vracať:vrátiť platiť:zaplatiť volať:zavolať piť:vypiť variť:uvariť pomáhať:pomôcť začínať:začať končiť:skončiť otvárať:otvoriť zatvárať:zatvoriť čakať:počkať stretávať:stretnúť posielať:poslať ukazovať:ukázať rozhodovať:rozhodnúť prinášať:priniesť hovoriť:povedať vstávať:vstať umývať:umyť obliekať:obliecť kresliť:nakresliť telefonovať:zatelefonovať opravovať:opraviť pripravovať:pripraviť vysvetľovať:vysvetliť zabúdať:zabudnúť ponúkať:ponúknuť objednávať:objednať zostávať:zostať prichádzať:prísť odchádzať:odísť nechávať:nechať chytať:chytiť padať:padnúť zabíjať:zabiť vyhrávať:vyhrať strácať:stratiť používať:použiť vyberať:vybrať predstavovať:predstaviť spoznávať:spoznať učiť:naučiť dvíhať:zdvihnúť' -split ' '
$PREFIX = '^(u|na|z|s|zo|so|po|pre|vy|za|o|ob|pri|do|od|roz|pod|nad|v)'

# 1. pairs we already trust (mutual in the decoded verbs, or prefix-formed): same rule as build_bundle.ps1
$all = @{}; foreach ($v in (Get-Content "$Root/work/conj_all.json" -Raw | ConvertFrom-Json)) { $all[$v.w] = $v }
$pairs = [ordered]@{}
foreach ($v in $all.Values) {
  if ($v.asp -ne 'impf' -or -not $v.partner) { continue }
  $pr = $v.partner
  if ($all[$pr].partner -eq $v.w -or $pr -match "$PREFIX$([regex]::Escape($v.w))$") { $pairs[$v.w] = $pr }
}
$crude = 'prdieť', 'srať', 'jebať', 'chcať', 'drbať', 'šukať', 'mrdať', 'naštvať', 'močiť'
# tešiť (sa) = please / look forward; utešiť = comfort: a real pair on paper, but it misleads a learner
$confusing = 'tešiť'
foreach ($k in @($pairs.Keys)) { if ($k -in $crude -or $pairs[$k] -in $crude -or $k -in $confusing) { $pairs.Remove($k) } }
"trusted from the decoded verbs: $($pairs.Count)"

# 2. textbook pairs, confirmed by the dump (an aspect-tagged form or a gloss naming the partner) or prefix-formed
$want = @{}; foreach ($c in $TEXTBOOK) { $a, $b = $c -split ':'; $want[$a] = 1; $want[$b] = 1 }
$rel = @{}; $gloss = @{}
foreach ($line in [IO.File]::ReadLines("$Root/raw/sk.jsonl")) {
  if ($line -notmatch '"pos": ?"verb"') { continue }
  $o = $line | ConvertFrom-Json; if (-not $want[$o.word] -and -not $pairs.Contains($o.word)) { continue }
  if (-not $gloss[$o.word]) { $g = @($o.senses | Where-Object { $_.glosses } | Select-Object -First 1 | ForEach-Object { ($_.glosses[-1] -replace '\s*\([^)]*\)', '') -split '[,;]\s*' } | Select-Object -First 2) -join ', '; if ($g) { $gloss[$o.word] = $g } }
  $p = @()
  foreach ($f in @($o.forms) + @($o.related) + @($o.synonyms)) { if ($f -and ($f.tags -join ' ') -match 'perfective') { $p += $(if ($f.form) { $f.form } else { $f.word }) } }
  foreach ($s in $o.senses) { if ($s.raw_glosses) { $p += ([regex]::Matches(($s.raw_glosses -join ' '), '\p{L}+ť') | ForEach-Object Value) } }
  $rel[$o.word] = @(@($rel[$o.word]) + $p | Where-Object { $_ } | Select-Object -Unique)
}
$added = @(); $skipped = @()
foreach ($c in $TEXTBOOK) {
  $a, $b = $c -split ':'
  if ($pairs.Contains($a)) { continue }
  if ($rel[$a] -contains $b -or $rel[$b] -contains $a -or $b -match "$PREFIX$([regex]::Escape($a))$") { $pairs[$a] = $b; $added += $c } else { $skipped += $c }
}
"textbook pairs added: $($added.Count)   not confirmed (left out): $($skipped -join ', ')"

# 3. rank by Araneum (the more common of the two verbs), gloss from the decoded verbs or the dump
$ara = @{}
foreach ($line in [IO.File]::ReadLines((Get-ChildItem $Src -Recurse -Filter 'araneum_top60k.tsv' | Select-Object -First 1).FullName)) {
  $c = $line -split "`t"; if ($c[2] -eq 'V' -and -not $ara.ContainsKey($c[1])) { $ara[$c[1]] = [int]$c[0] }
}
$out = foreach ($w in $pairs.Keys) {
  $pr = $pairs[$w]; $r = [math]::Min(($ara[$w] ?? 99999), ($ara[$pr] ?? 99999))
  $g = if ($all[$w].g) { (($all[$w].g -split ';')[0] -split ',' | Select-Object -First 2 | ForEach-Object { $_.Trim() }) -join ', ' } else { $gloss[$w] }
  [ordered]@{ w = $w; pr = $pr; g = $g; r = $r }
}
$out = @($out | Sort-Object { $_.r })
$out | ConvertTo-Json -Depth 3 -Compress | Set-Content "$Root/work/apairs.json" -Encoding utf8
"pairs: $($out.Count)   top 25: " + (($out | Select-Object -First 25 | ForEach-Object { "$($_.w)↔$($_.pr)" }) -join ', ')
