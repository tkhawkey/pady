# Shared: parse the Ľ. Štúr Institute noun groups (groups-nouns.yaml) and derive a table for every lemma.
# Each group gives the full paradigm of one representative word; the other lemmas in the group decline the same way
# after their stem. Each form is derived on its own: form = rep[0..k] + tail, where k = common prefix of rep and that
# form, so a stem change in one cell (žena -> žien) doesn't block the others. Lemmas match with exact case
# (Sloboda the surname is not sloboda); a lemma in several groups (homonyms) keeps all of them.
# Returns: lemma -> list of @{ gen = 'm|i|f|n'; cells = @{ 'gen_s' = @(forms) } }
function Get-SturTables([string]$YamlPath) {
  $CASEDIG = @{ '1' = 'nom'; '2' = 'gen'; '3' = 'dat'; '4' = 'acc'; '6' = 'loc'; '7' = 'ins' }
  $groups = [System.Collections.Generic.List[object]]::new(); $g = $null; $mode = ''; $tag = ''
  foreach ($line in [IO.File]::ReadLines($YamlPath)) {
    if ($line -eq '- lemmata:') { $g = @{ lemmata = [System.Collections.Generic.List[string]]::new(); forms = @{}; rep = '' }; $groups.Add($g); $mode = 'lem'; continue }
    if ($line -match '^  lexeme:') { $mode = 'lex'; continue }
    if ($line -match '^  representant: (.+)$') { $g.rep = $Matches[1].Trim() -replace '_\d+$', ''; $mode = ''; continue }   # banka_1 = banka (homonym no.)
    if ($line -match '^  representant_flags:') { $mode = 'flags'; continue }
    if ($mode -eq 'lem' -and $line -match '^  - (.+)$') { $g.lemmata.Add(($Matches[1].Trim() -replace '_\d+$', '')); continue }
    if ($mode -eq 'lex' -and $line -match '^    (\S+):\s*$') { $tag = $Matches[1]; $g.forms[$tag] = [System.Collections.Generic.List[string]]::new(); continue }
    if ($mode -eq 'lex' -and $line -match '^    - (.+)$') { $g.forms[$tag].Add($Matches[1].Trim()); continue }
  }
  $lcp = { param($a, $b) $i = 0; while ($i -lt $a.Length -and $i -lt $b.Length -and $a[$i] -eq $b[$i]) { $i++ }; $i }
  # soft consonants harden before e/i: cieľ -> ciele, so kremeň -> kremene (same group, different soft consonant)
  $HARD = @{ [char]'ľ' = 'l'; [char]'ň' = 'n'; [char]'ť' = 't'; [char]'ď' = 'd' }
  $derive = {
    param($lem, $rep, $f)
    $k = & $lcp $rep $f; $repTail = $rep.Substring($k); $fTail = $f.Substring($k)
    if ($lem.EndsWith($repTail)) { return $lem.Substring(0, $lem.Length - $repTail.Length) + $fTail }
    if ($repTail.Length -ge 1 -and $lem.Length -ge $repTail.Length) {
      $rs = $repTail[0]; $ls = $lem[$lem.Length - $repTail.Length]
      if ($HARD.ContainsKey($rs) -and $HARD.ContainsKey($ls) -and $lem.EndsWith($repTail.Substring(1))) {
        $stem = $lem.Substring(0, $lem.Length - $repTail.Length)
        if ($fTail.StartsWith($HARD[$rs])) { return $stem + $HARD[$ls] + $fTail.Substring(1) }
        if ($fTail.StartsWith([string]$rs)) { return $stem + $ls + $fTail.Substring(1) }
      }
    }
    $null
  }
  $stur = @{}
  foreach ($g in $groups) {
    if (-not $g.rep -or -not $g.forms.Count) { continue }
    foreach ($lem in $g.lemmata) {
      if ($lem -cne $lem.ToLowerInvariant()) { continue }
      $cells = @{}; $gen = ''
      foreach ($t in $g.forms.Keys) {
        if ($t -notmatch '^SS(\w)([sp])(\d)$') { continue }
        $gen = $Matches[1]; $num = $Matches[2]; $ck = $CASEDIG[$Matches[3]]; if (-not $ck) { continue }
        $fs = @(foreach ($f in $g.forms[$t]) { $d = & $derive $lem $g.rep $f; if ($d) { $d } })
        if ($fs.Count) { $cells["$($ck)_$num"] = $fs }
      }
      if (-not $stur.ContainsKey($lem)) { $stur[$lem] = [System.Collections.Generic.List[object]]::new() }
      $stur[$lem].Add(@{ gen = $gen; cells = $cells })
    }
  }
  $stur
}
