# More verbs for Hľadaj: the most frequent Slovak verbs (Araneum lemma list) that English Wiktionary has no table
# for, conjugated from the Slovak Hunspell dictionary (sk_SK, the spellchecker's affix rules carry person/tense tags).
# Checks, because Hunspell has slips (fajčim for fajčím, imperative veri for ver, a feminine past tagged masculine):
#   - past forms are sorted by their ending (-l / -la / -lo / -li), not by Hunspell's gender tags;
#   - junk forms are dropped;
#   - every form is checked against real usage (subtitle frequency list + UD treebank): when a near variant
#     (vowel length, imperative -i) is clearly more used than Hunspell's form, the used form wins.
# Aspect and sa/si come from the treebank where the verb occurs there. Meanings are written separately
# (work/verbs_hun_gloss.json, by Claude: marked AI in the app).
#   out: work/verbs_hun.json, work/tr/vg_in_N.json (verbs that still need a meaning)
param([string]$Root = (Split-Path $PSScriptRoot -Parent), [string]$Src = 'C:\Users\ThomasHawkey\Desktop\Slovak App',
  [int]$Top = 3000, [int]$Chunks = 6, [switch]$NoChunks)
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/hunspell_lib.ps1"
$h = New-Hunspell "$Src\sk_SK"
$bf = @{}; foreach ($list in $h.sfx.Values) { foreach ($r in $list) { if (-not $bf.ContainsKey($r.flag)) { $bf[$r.flag] = [System.Collections.Generic.List[object]]::new() }; $bf[$r.flag].Add($r) } }
$isVerb = @{}; foreach ($l in [IO.File]::ReadLines("$Src\sk_SK.dic")) { if ($l -match '^(\S+?)/\S+\s+po:verb') { $isVerb[$Matches[1]] = 1 } }

# ---- usage: form frequencies (OpenSubtitles list + treebank), treebank aspect and sa/si ----
$freq = @{}
foreach ($l in [IO.File]::ReadLines("$Root/raw/sk_50k.txt")) { $p = $l.Split(' '); if ($p.Count -eq 2) { $freq[$p[0]] = [int]$p[1] } }
$asp = @{}; $refl = @{}; $tok = @{}
foreach ($file in Get-ChildItem "$Root/raw/ud/*.conllu") {
  $rows = @()
  foreach ($line in [IO.File]::ReadLines($file.FullName)) {
    if (-not $line) {
      foreach ($r in $rows) {
        if ($r[3] -notin 'VERB', 'AUX') { continue }
        $lem = $r[2].ToLowerInvariant(); $tok[$lem] = 1 + ($tok[$lem] ?? 0)
        $f = $r[1].ToLowerInvariant(); $freq[$f] = 1 + ($freq[$f] ?? 0)
        if ($r[5] -match 'Aspect=(Imp|Perf)') { if (-not $asp[$lem]) { $asp[$lem] = @{ Imp = 0; Perf = 0 } }; $asp[$lem][$Matches[1]]++ }
        foreach ($c in $rows) { if ($c[6] -eq $r[0] -and $c[7] -eq 'expl:pv') { $k = "$lem|$($c[1].ToLowerInvariant())"; $refl[$k] = 1 + ($refl[$k] ?? 0) } }
      }
      $rows = @(); continue
    }
    if ($line[0] -eq '#') { continue }
    $c = $line.Split("`t"); if ($c[0] -match '^\d+$') { $rows += , $c }
  }
}

# ---- which verbs: the Araneum top $Top verb lemmas Hľadaj doesn't have ----
$have = @{}; $base = @{}
foreach ($v in (Get-Content "$Root/work/conj_all.json" -Raw | ConvertFrom-Json)) {
  $have[$v.w] = 1
  if ($v.refl) { continue }
  $p = @($v.pres); $l = @($v.past)
  $base[$v.w] = @{ p1s = $p[0]; p2s = $p[1]; p3s = $p[2]; p1p = $p[3]; p2p = $p[4]; p3p = $p[5]; lm = $l[0]; lf = $l[1]; lp = $l[3] }
}
$cands = [System.Collections.Generic.List[object]]::new(); $rank = 0
foreach ($line in [IO.File]::ReadLines("$Src\dataset-arf-araneum-slovacum-vii-lemma-pos.tsv")) {
  $k = $line.Substring(0, $line.IndexOf("`t")).Normalize()
  if (-not $k.EndsWith('ťV')) { continue }
  $rank++; if ($rank -gt $Top) { break }
  $w = $k.Substring(0, $k.Length - 1)
  if ($w -cnotmatch '^\p{Ll}+$' -or $have[$w]) { continue }
  $cands.Add([pscustomobject]@{ w = $w; rank = $rank })
}

$SLOT = [ordered]@{
  p1s = 'is:1st_person'; p2s = 'is:2nd_person'; p3s = 'is:3rd_person'
  p1p = 'is:1st_person is:plural'; p2p = 'is:2nd_person is:plural'; p3p = 'is:3rd_person is:plural'
  i2s = 'is:2nd_person is:imperative'; i1p = 'is:1st_person is:imperative is:plural'; i2p = 'is:2nd_person is:imperative is:plural'
}
function Get-Table($w) {
  $out = @{}; $past = [System.Collections.Generic.HashSet[string]]::new()
  foreach ($fl in $h.dic[$w].ToCharArray()) {
    foreach ($r in @($bf["$fl"])) {
      if (-not $r -or -not $r.re.IsMatch($w)) { continue }
      if ($r.strip -and -not $w.EndsWith($r.strip)) { continue }
      $form = $w.Substring(0, $w.Length - $r.strip.Length) + $r.add
      # junk: the infinitive with something stuck on (veriťnásobni, nazvaťi)
      if ($form -cnotmatch '^\p{Ll}+$' -or ($form -match 'násob' -and $w -notmatch 'násob') -or ($form.StartsWith($w) -and $form.Length -gt $w.Length)) { continue }
      $m = (($r.morph -split '\s+' | Where-Object { $_ -like 'is:*' } | Sort-Object) -join ' ')
      if ($m -match 'is:past') { [void]$past.Add($form); continue }
      foreach ($k in $SLOT.Keys) { if ($m -eq $SLOT[$k]) { if (-not $out[$k]) { $out[$k] = [System.Collections.Generic.List[string]]::new() }; if (-not $out[$k].Contains($form)) { $out[$k].Add($form) } } }
    }
  }
  # past by ending: Hunspell tags some feminine forms as masculine
  foreach ($f in $past) {
    $k = if ($f -match 'la$') { 'lf' } elseif ($f -match 'lo$') { 'ln' } elseif ($f -match 'li$') { 'lp' } elseif ($f -match 'l$') { 'lm' } else { $null }
    if ($k) { if (-not $out[$k]) { $out[$k] = [System.Collections.Generic.List[string]]::new() }; if (-not $out[$k].Contains($f)) { $out[$k].Add($f) } }
  }
  $out
}
# near variants a slip could produce: vowel length either way, an imperative -i added or dropped
$LONG = @{ a = 'á'; e = 'é'; i = 'í'; o = 'ó'; u = 'ú'; y = 'ý'; á = 'a'; é = 'e'; í = 'i'; ó = 'o'; ú = 'u'; ý = 'y' }
function Get-Variants($f, $slot) {
  $vs = @()
  for ($i = 0; $i -lt $f.Length; $i++) { $c = [string]$f[$i]; if ($LONG.ContainsKey($c)) { $vs += $f.Substring(0, $i) + $LONG[$c] + $f.Substring($i + 1) } }
  if ($slot -like 'i*') {
    if ($slot -eq 'i2s') { if ($f -match 'i$') { $vs += $f.Substring(0, $f.Length - 1) } else { $vs += "${f}i" } }
    else { $vs += ($f -replace 'ime$', 'me' -replace 'ite$', 'te'); $vs += ($f -replace '([^i])me$', '$1ime' -replace '([^i])te$', '$1ite') }
  }
  $vs | Where-Object { $_ -ne $f } | Select-Object -Unique
}
$fq = { param($x) $freq[$x] ?? 0 }
# imperative (ty) by the school rule: the oni form without its ending (robia → rob, berú → ber, chytajú → chytaj, pijú → pi),
# + -i after two consonants (zisti, kresli, žni), where r / l between consonants count as vowels (drv, plň, potvrď);
# otherwise a final d / t / n / l softens (choď, vráť, zmeň, deľ). Checked against Wiktionary: 767 of 768 agree.
$VW = 'aeiouyáéíóúýäô'
function Get-ImpRule($w, $p3) {
  if (-not $p3 -or $w -match '(byť|ísť|jsť|jesť|vedieť|povedať|chcieť|môcť|vziať)$') { return $null }
  if ($p3 -cmatch '[iy]jú$') { return $p3 -creplace 'jú$', '' }
  if ($p3 -cnotmatch '(ia|ú|u|a)$') { return $null }
  $st = $p3 -creplace '(ia|ú|u|a)$', ''
  $c = ($st -replace '(ch|dz|dž)', '%') -creplace '[ŕĺ]', '#'
  $c = [regex]::Replace($c, "(?<=[^${VW}#])[rl](?=[^${VW}#])", '#')
  if ($c -cmatch "[^${VW}#][^${VW}#]$") { return ("${st}i" -creplace 'ľi$', 'li' -creplace 'ňi$', 'ni' -creplace 'ďi$', 'di' -creplace 'ťi$', 'ti') }
  $st -creplace 'd$', 'ď' -creplace 't$', 'ť' -creplace 'n$', 'ň' -creplace 'l$', 'ľ'
}
# subtitles often drop accents, so "skonči" is frequent as a misspelt skončí: compare without accents to spot that
function Get-Bare($s) { ($s.Normalize([Text.NormalizationForm]::FormD) -replace '\p{M}', '') }
# a known form of some other word (určite = certainly, záujme = interest, zísť = to go down)
function Test-OtherWord($x, $w) {
  if ($h.dic.ContainsKey($x) -and $x -ne $w) { return $true }
  foreach ($a in (Get-HunAnalyses $h $x)) { if ($a.stem -ne $w) { return $true } }
  $false
}
$out = @(); $fixes = @(); $skipped = @()
foreach ($c in $cands) {
  $w = $c.w
  if (-not $h.dic.ContainsKey($w) -or -not $isVerb[$w]) { $skipped += "$w (not in Hunspell)"; continue }
  $t = Get-Table $w
  $pick = @{}
  $keys = @($SLOT.Keys) + @('lm', 'lf', 'ln', 'lp')
  foreach ($k in $keys) {
    $opts = @($t[$k] | Where-Object { $_ })
    if (-not $opts.Count) { continue }
    # the other cells of this verb, without accents (verime looks like veríme; skonči like skončí)
    $others = [System.Collections.Generic.HashSet[string]]::new()
    foreach ($k2 in $keys) { if ($k2 -ne $k) { foreach ($x in @($t[$k2])) { if ($x) { [void]$others.Add((Get-Bare $x)) } } } }
    # several Hunspell forms: one that can't be mistaken for another cell, then the most used (verme over verime)
    $clean = @($opts | Where-Object { -not $others.Contains((Get-Bare $_)) }); if (-not $clean.Count) { $clean = $opts }
    $best = $clean | Sort-Object { - (& $fq $_) } | Select-Object -First 1
    # (a "near variant used more often" fix was tried and dropped: the subtitle list is full of accent-less text,
    # so it "corrected" vítali to vitali and kúr to kur far more often than it caught a real slip)
    $pick[$k] = $best
  }
  # gaps Hunspell leaves:
  # 1. past plural / neuter from the feminine (naliala → naliali, nalialo): always -a → -i / -o
  if ($pick.lf -match 'la$') { if (-not $pick.lp) { $pick.lp = $pick.lf -replace 'a$', 'i' }; if (-not $pick.ln) { $pick.ln = $pick.lf -replace 'a$', 'o' } }
  # 2. a prefixed verb whose base has a checked table (zapísať = za + písať): borrow the missing cell, but only when
  #    every cell it does have is exactly prefix + the base's cell
  $missing = @('p1s', 'p2s', 'p3s', 'p1p', 'p2p', 'p3p', 'lm', 'lf', 'lp' | Where-Object { -not $pick[$_] })
  if ($missing.Count) {
    for ($i = 1; $i -lt $w.Length - 2; $i++) {
      $b = $base[$w.Substring($i)]; if (-not $b) { continue }
      $pre = $w.Substring(0, $i)
      $agree = $true; $same = 0
      foreach ($k in $b.Keys) { if ($pick[$k]) { if ($pick[$k] -ne "$pre$($b[$k])") { $agree = $false } else { $same++ } } }
      if ($agree -and $same -ge 4) { foreach ($k in $missing) { if ($b[$k]) { $pick[$k] = "$pre$($b[$k])"; $fixes += "$w $k from $($w.Substring($i))" } }; break }
    }
  }
  $pres = @('p1s', 'p2s', 'p3s', 'p1p', 'p2p', 'p3p' | ForEach-Object { $pick[$_] })
  $pastA = @('lm', 'lf', 'ln', 'lp' | ForEach-Object { $pick[$_] })
  # a table that contradicts itself is Hunspell garbage (viaziam… viaže… viazajú; zvládam… zvládzu): leave the verb out
  if ($w -notmatch '(byť|ísť|jsť|jesť|vedieť|povedať|chcieť|môcť|vziať|sedieť)$' -and $pres[0]) {
    $st = $pres[0] -replace '(iem|em|ím|im|ám|am|ujem)$', ''; $st = $st.Substring(0, [Math]::Max(1, $st.Length - 1))
    $broken = @($pres[1..4] | Where-Object { $_ -and -not $_.StartsWith($st) }).Count -gt 0
    if ($pres[0] -match '[aá]m$' -and $pres[5] -notmatch 'aj[úu]$') { $broken = $true }
    if ($pres[0] -match 'ujem$' -and $pres[5] -notmatch 'uj[úu]$') { $broken = $true }
    # on and oni from the same type (zakončije… zakončia is two tables mixed)
    if ($pres[5] -match 'ia$' -and $pres[2] -notmatch '[íi]$') { $broken = $true }
    if ($pres[2] -match 'je$' -and $pres[5] -notmatch 'j[úu]$') { $broken = $true }
    if ($broken) { $skipped += "$w (table contradicts itself: $($pres -join ','))"; continue }
  }
  if (@($pres | Where-Object { $_ }).Count -lt 6 -or -not $pastA[0] -or -not $pastA[1] -or -not $pastA[3]) {
    $gap = @('p1s', 'p2s', 'p3s', 'p1p', 'p2p', 'p3p', 'lm', 'lf', 'lp' | Where-Object { -not $pick[$_] }) -join '/'
    $skipped += "$w (no $gap)"; continue
  }
  # imperative: Hunspell's is the shakiest part (veri for ver, zisť for zisti). Keep it only when the ty form is really
  # used (and can't be a misspelt other cell: veri ~ verí), trying the form with / without a final -i; then my / vy follow
  # by rule (ver → verme, verte; kresli → kreslime, kreslite). Otherwise leave the imperative out.
  # imperative: the school rule from the oni form, not Hunspell's (91% right against Wiktionary; the rule: 767 / 768).
  # Irregular families (prísť, povedať, zjesť…) keep Hunspell's form. my / vy follow from ty (ver → verme, verte).
  $ty = Get-ImpRule $w $pick.p3p
  if ($null -eq $ty) { $ty = $pick.i2s } elseif ($pick.i2s -and $pick.i2s -cne $ty) { $fixes += "$w imp $($pick.i2s)→$ty" }
  $imp = if ($ty) { @($ty, "${ty}me", "${ty}te") } else { @('', '', '') }
  # aspect + sa/si from the treebank, when it has the verb often enough
  $a = ''; $s = $asp[$w]; if ($s -and ($s.Imp + $s.Perf) -ge 3) { if ($s.Imp -ge 3 * [math]::Max(1, $s.Perf)) { $a = 'impf' } elseif ($s.Perf -ge 3 * [math]::Max(1, $s.Imp)) { $a = 'pf' } }
  $r = ''; $n = $tok[$w] ?? 0
  if ($n -ge 3) { foreach ($x in 'sa', 'si') { if (($refl["$w|$x"] ?? 0) -ge 0.8 * $n) { $r = $x } } }
  $out += [ordered]@{ w = $w; rank = $c.rank; asp = $a; refl = $r; pres = $pres; past = $pastA; imp = $imp }
}
$out | ConvertTo-Json -Depth 4 -Compress | Set-Content "$Root/work/verbs_hun.json" -Encoding utf8
"candidates: $($cands.Count)   built: $($out.Count)   skipped: $($skipped.Count)   usage fixes: $($fixes.Count)"
"aspect from treebank: $(@($out | Where-Object { $_.asp }).Count)   sa/si from treebank: $(@($out | Where-Object { $_.refl }).Count)"
"fixes (first 40): $(($fixes | Select-Object -First 40) -join ' | ')"
"skipped (first 30): $(($skipped | Select-Object -First 30) -join ', ')"

# ---- meanings still to write: work/tr/vg_in_N.json ----
$have = @{}; if (Test-Path "$Root/work/verbs_hun_gloss.json") { foreach ($p in (Get-Content "$Root/work/verbs_hun_gloss.json" -Raw -Encoding utf8 | ConvertFrom-Json).PSObject.Properties) { $have[$p.Name] = 1 } }
if ($NoChunks) { return }
$todo = @($out | Where-Object { -not $have[$_.w] } | ForEach-Object { , @($_.w, $_.pres[0], $_.pres[5], $_.past[0], $_.asp, $_.refl) })
Get-ChildItem "$Root/work/tr/vg_in_*.json" -ErrorAction SilentlyContinue | Remove-Item
$per = [Math]::Ceiling($todo.Count / [Math]::Max(1, $Chunks))
for ($i = 0; $i -lt $Chunks -and $i * $per -lt $todo.Count; $i++) {
  $part = $todo[($i * $per)..([Math]::Min($todo.Count, ($i + 1) * $per) - 1)]
  ConvertTo-Json @($part) -Depth 3 -Compress | Set-Content "$Root/work/tr/vg_in_$($i + 1).json" -Encoding utf8
  "  vg_in_$($i + 1).json: $($part.Count)"
}
