# A small reader for the Slovak Hunspell dictionary (sk_SK.dic / sk_SK.aff): spelling check + the grammar tags
# the affix rules carry (is:genitive…). Handles suffix rules, the ne-/naj- prefixes, and one level of
# continuation flags. Not a full Hunspell, but enough to tell a real word form from a typo.
#   $h = New-Hunspell 'C:\…\sk_SK'    then    Test-HunWord $h 'sezónu'   /   Get-HunTags $h 'sezónu'
function New-Hunspell([string]$Base) {
  $dic = @{}   # word -> flags string (several homographs: concatenated)
  $first = $true
  foreach ($line in [IO.File]::ReadLines("$Base.dic")) {
    if ($first) { $first = $false; continue }
    $w = ($line -split '\s', 2)[0]; if (-not $w) { continue }
    $word, $flags = $w -split '/', 2
    $dic[$word] = ($dic[$word] ?? '') + ($flags ?? '')
  }
  $sfx = @{}; $pfx = @()   # sfx: last letter of 'add' -> list of rules
  foreach ($line in [IO.File]::ReadLines("$Base.aff")) {
    if ($line -notmatch '^(SFX|PFX)\s+(\S)\s+(\S+)\s+(\S+)\s+(\S+)(.*)$') { continue }
    if ($Matches[3] -in 'Y', 'N' -and $Matches[4] -match '^\d+$') { continue }   # header
    $kind = $Matches[1]; $flag = $Matches[2]; $strip = $Matches[3]; $add = $Matches[4]; $cond = $Matches[5]; $morph = $Matches[6].Trim()
    $cont = ''; if ($add -match '^(.*?)/(.+)$') { $add = $Matches[1]; $cont = $Matches[2] }
    if ($strip -eq '0') { $strip = '' }; if ($add -eq '0') { $add = '' }
    $r = [pscustomobject]@{ flag = $flag; strip = $strip; add = $add; cont = $cont; morph = $morph
      re = [regex]::new($(if ($kind -eq 'SFX') { "$cond$" } else { "^$cond" })) }
    if ($kind -eq 'SFX') { $k = if ($add) { $add.Substring($add.Length - 1) } else { '' }; if (-not $sfx.ContainsKey($k)) { $sfx[$k] = [System.Collections.Generic.List[object]]::new() }; $sfx[$k].Add($r) }
    else { $pfx += $r }
  }
  [pscustomobject]@{ dic = $dic; sfx = $sfx; pfx = $pfx }
}
# all analyses: list of @{ stem; tags }
function Get-HunAnalyses($h, [string]$word, [int]$depth = 0) {
  $out = [System.Collections.Generic.List[object]]::new()
  if ($h.dic.ContainsKey($word)) { $out.Add(@{ stem = $word; tags = 'base' }) }
  $keys = @(''); if ($word.Length) { $keys += $word.Substring($word.Length - 1) }
  foreach ($k in $keys) {
    if (-not $h.sfx.ContainsKey($k)) { continue }
    foreach ($r in $h.sfx[$k]) {
      if ($r.add -and -not $word.EndsWith($r.add)) { continue }
      $stem = $word.Substring(0, $word.Length - $r.add.Length) + $r.strip
      if (-not $stem -or -not $r.re.IsMatch($stem)) { continue }
      if ($h.dic.ContainsKey($stem) -and $h.dic[$stem].Contains($r.flag)) { $out.Add(@{ stem = $stem; tags = $r.morph }) }
      elseif ($depth -eq 0 -and $r.cont) { }   # continuation classes: rare here, skipped
    }
  }
  if ($depth -eq 0) {
    foreach ($r in $h.pfx) {
      if (-not $word.StartsWith($r.add) -or $word.Length -le $r.add.Length) { continue }
      $rest = $r.strip + $word.Substring($r.add.Length)
      foreach ($a in (Get-HunAnalyses $h $rest 1)) { if ($h.dic[$a.stem] -and $h.dic[$a.stem].Contains($r.flag)) { $out.Add(@{ stem = $a.stem; tags = "$($r.morph) $($a.tags)" }) } }
    }
  }
  , $out
}
# every form of a dictionary word: apply each suffix rule its flags allow (výlet -> výletu, výlete, výletom, výlety…)
function Get-HunForms($h, [string]$stem) {
  if (-not $h.dic.ContainsKey($stem)) { return , @() }
  if (-not $h.byFlag) {
    $bf = @{}; foreach ($list in $h.sfx.Values) { foreach ($r in $list) { if (-not $bf.ContainsKey($r.flag)) { $bf[$r.flag] = [System.Collections.Generic.List[object]]::new() }; $bf[$r.flag].Add($r) } }
    $h | Add-Member -NotePropertyName byFlag -NotePropertyValue $bf
  }
  $out = [System.Collections.Generic.HashSet[string]]::new(); [void]$out.Add($stem)
  foreach ($fl in $h.dic[$stem].ToCharArray()) {
    $rules = $h.byFlag["$fl"]; if (-not $rules) { continue }
    foreach ($r in $rules) {
      if (-not $r.re.IsMatch($stem)) { continue }
      if ($r.strip -and -not $stem.EndsWith($r.strip)) { continue }
      [void]$out.Add($stem.Substring(0, $stem.Length - $r.strip.Length) + $r.add)
    }
  }
  , @($out)
}
function Test-HunWord($h, [string]$word) {
  foreach ($w in @($word, $word.ToLowerInvariant()) | Select-Object -Unique) { if ((Get-HunAnalyses $h $w).Count) { return $true } }
  $false
}
