# Second opinion on every noun table: the Ľ. Štúr Institute morphology groups (groups-nouns.yaml).
# Each group gives the full paradigm of one representative word; the other lemmas in the group decline the same way
# after their stem. We derive their tables and compare them cell by cell with ours (Wiktionary).
#   in : <Src>/groups-nouns.yaml, data/nouns.json, app/lookup-data.js
#   out: data/stur_check.txt (report), work/stur_nouns.json (derived tables, used by build_data/bundle if wanted)
param([string]$Root = (Split-Path $PSScriptRoot -Parent), [string]$Src = 'C:\Users\ThomasHawkey\Desktop\Slovak App')
$ErrorActionPreference = 'Stop'
$CASEDIG = @{ nom = '1'; gen = '2'; dat = '3'; acc = '4'; loc = '6'; ins = '7' }
$cases = 'nom', 'gen', 'dat', 'acc', 'loc', 'ins'

. "$PSScriptRoot/stur_lib.ps1"
$stur = Get-SturTables "$Src/groups-nouns.yaml"
"lemmas with a derived table: $($stur.Count)"

# ---- compare with the game nouns, cell by cell ----
$report = [System.Collections.Generic.List[string]]::new()
$nCmp = 0; $nSame = 0; $extra = [System.Collections.Generic.List[string]]::new(); $clash = [System.Collections.Generic.List[string]]::new(); $absent = @()
foreach ($n in (Get-Content "$Root/data/nouns.json" -Raw | ConvertFrom-Json)) {
  $s = $stur[$n.word]; if (-not $s) { $absent += $n.word; continue }
  foreach ($ck in $cases) { foreach ($num in 's', 'p') {
    $theirs = @($s | ForEach-Object { $_.cells["$($ck)_$num"] } | Where-Object { $_ } | Select-Object -Unique); if (-not $theirs) { continue }
    $prim = if ($num -eq 's') { $n.sg.$ck } else { $n.pl.$ck }
    $ours = @($prim) + @($n.alt."$($ck)_$num" | Where-Object { $_ })
    $nCmp++
    $common = @($theirs | Where-Object { $_ -in $ours })
    if (-not $common.Count) { $clash.Add("$($n.word)  $ck $num   ours: $($ours -join '/')   Štúr: $($theirs -join '/')") }
    else {
      $nSame++
      $more = @($theirs | Where-Object { $_ -notin $ours }); if ($more.Count) { $extra.Add("$($n.word)  $ck $num   ours: $($ours -join '/')   Štúr also: $($more -join '/')") }
      if ($prim -notin $theirs) { $extra.Add("$($n.word)  $ck $num   our MAIN form $prim is not in Štúr ($($theirs -join '/'))") }
    }
  } }
}
# ---- extra accepted answers: Štúr variants where both sources overlap, and the clashes where both forms are in real
#      use (decided by hand; autobus/oceán/štít are NOT here: Štúr files them as animate, which is wrong) ----
$bothInUse = 'vďaka', 'stop', 'pláž', 'garáž', 'súťaž', 'krádež', 'púšť', 'medveď', 'had', 'pizza', 'dážď', 'bordel'
$alts = [ordered]@{}
foreach ($line in @($extra) + @($clash)) {
  if ($line -notmatch '^(\S+)\s+(\w+) ([sp])\s+ours: (\S+)\s+Štúr(?: also)?: (\S+)$') { continue }
  $w = $Matches[1]; $cell = "$($Matches[2])_$($Matches[3])"; $ours = $Matches[4] -split '/'; $theirs = $Matches[5] -split '/'
  if ($line -notmatch 'Štúr also' -and $w -notin $bothInUse) { continue }
  if (-not $alts.Contains($w)) { $alts[$w] = [ordered]@{} }
  $alts[$w][$cell] = @($theirs | Where-Object { $_ -notin $ours })
}
$alts | ConvertTo-Json -Depth 4 | Set-Content "$Root/data/stur_alts.json" -Encoding utf8
"accepted Štúr variants: $(@($alts.Values | ForEach-Object { $_.Count }) | Measure-Object -Sum | ForEach-Object Sum) cells in $($alts.Count) nouns"

$report.Add("Game nouns compared with the Ľ. Štúr Institute groups ($(Get-Date -Format 'yyyy-MM-dd'))")
$report.Add("cells compared: $nCmp   agree: $nSame   disagree: $($clash.Count)   nouns not in Štúr: $($absent.Count) ($($absent -join ', '))")
$report.Add(''); $report.Add('== DISAGREE (no form in common) =='); $clash | ForEach-Object { $report.Add($_) }
$report.Add(''); $report.Add('== AGREE, but one side has an extra variant =='); $extra | ForEach-Object { $report.Add($_) }

# ---- lookup nouns: every form we list should exist in the Štúr table ----
$L = Get-Content "$Root/app/lookup-data.js" -Raw; $L = $L.Substring($L.IndexOf('{')).TrimEnd().TrimEnd(';') | ConvertFrom-Json
$lk = 0; $lkBad = [System.Collections.Generic.List[string]]::new()
foreach ($e in $L.nouns) {
  $s = $stur[$e[0]]; if (-not $s) { continue }; $lk++
  $theirs = @($s | ForEach-Object { $_.cells.Values | ForEach-Object { $_ } })
  $odd = @($e[3] | Where-Object { $_ -notin $theirs })
  if ($odd.Count) { $lkBad.Add("$($e[0]): $($odd -join ', ')") }
}
$report.Add(''); $report.Add("== Hľadaj nouns: $lk checked, $($lkBad.Count) list a form the derived Štúr table doesn't have ==")
$report.Add('(rough: the derivation misses vocatives and stem changes such as voda -> vôd, so most of these are not errors)')
$lkBad | ForEach-Object { $report.Add($_) }
$report | Set-Content "$Root/data/stur_check.txt" -Encoding utf8
$report | Select-Object -First 3
"extra-variant lines: $($extra.Count)   lookup nouns with odd forms: $($lkBad.Count)"
