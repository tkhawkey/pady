# Subtitle test, step 1+2: pair a Slovak and an English .srt into sentence pairs, then filter the noise.
# Subtitle text is copyrighted: everything goes to work/subs/<name>/ (git-ignored, never uploaded).
#   pairing: walk both files in time order and close a "bundle" only where both languages reach a common boundary
#            (same end time ±0.3 s) and both have finished a sentence; dialogue cues ("- … / - …") with the same
#            number of turns on both sides are split into one pair per turn.
#   out: work/subs/<name>/pairs.json  [{ id, s, e, sk, en, kind, flags[] }]   kind: keep | short | screen | untranslated | dup
param(
  [Parameter(Mandatory)][string]$Sk, [Parameter(Mandatory)][string]$En, [Parameter(Mandatory)][string]$Name,
  [string]$Root = (Split-Path $PSScriptRoot -Parent)
)
$ErrorActionPreference = 'Stop'
function Read-Srt($p) {
  $t = Get-Content -LiteralPath $p -Raw -Encoding utf8
  @([regex]::Matches($t, '(?ms)^\d+\r?\n(\d\d):(\d\d):(\d\d),(\d{3}) --> (\d\d):(\d\d):(\d\d),(\d{3})[^\n]*\r?\n(.*?)(?=\r?\n\r?\n|\z)') | ForEach-Object {
    $g = $_.Groups
    $raw = $g[9].Value
    [pscustomobject]@{
      s = [int]$g[1].Value * 3600 + [int]$g[2].Value * 60 + [int]$g[3].Value + [int]$g[4].Value / 1000
      e = [int]$g[5].Value * 3600 + [int]$g[6].Value * 60 + [int]$g[7].Value + [int]$g[8].Value / 1000
      lines = @(($raw -replace '\{[^}]*\}', '' -replace '</?[a-z][^>]*>', '') -split '\r?\n' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
      italic = $raw -match '<i>'
    } })
}
$S = Read-Srt $Sk; $E = Read-Srt $En
$isSentEnd = { param($txt) $txt -match '[.?!…:"“”»]\s*$' }
$join = { param($cues) (($cues | ForEach-Object { $_.lines -join ' ' }) -join ' ') -replace '\s+', ' ' }

# ---- 1. bundles ----
$bundles = [System.Collections.Generic.List[object]]::new()
$i = 0; $j = 0
while ($i -lt $S.Count) {
  $bs = [System.Collections.Generic.List[object]]::new(); $be = [System.Collections.Generic.List[object]]::new()
  $bs.Add($S[$i]); $i++
  while ($true) {
    $endS = $bs[-1].e
    while ($j -lt $E.Count -and $E[$j].s -lt $endS - 0.3) { $be.Add($E[$j]); $j++ }
    $endE = if ($be.Count) { $be[-1].e } else { $endS }
    # English runs on past the Slovak: the Slovak sentence continues in the next cue
    if ($endE -gt $endS + 0.3 -and $i -lt $S.Count -and $S[$i].s -lt $endE - 0.3 -and $bs.Count -lt 5) { $bs.Add($S[$i]); $i++; continue }
    # either side mid-sentence and the next cues follow on closely: keep going
    $skOpen = -not (& $isSentEnd (& $join $bs)); $enOpen = $be.Count -and -not (& $isSentEnd (& $join $be))
    if (($skOpen -or $enOpen) -and $i -lt $S.Count -and $S[$i].s - $endS -lt 1.2 -and $bs.Count -lt 5) { $bs.Add($S[$i]); $i++; continue }
    break
  }
  $bundles.Add(@{ sk = $bs; en = $be })
}
# English cues that fell between bundles (no Slovak at all) are simply not used

# ---- 2. pairs (split dialogue turns when both sides agree on the number of turns) ----
$pairs = [System.Collections.Generic.List[object]]::new(); $id = 0
foreach ($b in $bundles) {
  $s0 = $b.sk[0].s; $e0 = $b.sk[-1].e
  $skL = @($b.sk | ForEach-Object { $_.lines }); $enL = @($b.en | ForEach-Object { $_.lines })
  $skT = @($skL | Where-Object { $_ -match '^-' }); $enT = @($enL | Where-Object { $_ -match '^-' })
  $units = @()
  if ($b.sk.Count -eq 1 -and $b.en.Count -eq 1 -and $skT.Count -ge 2 -and $skT.Count -eq $skL.Count -and $enT.Count -eq $skT.Count -and $enT.Count -eq $enL.Count) {
    for ($k = 0; $k -lt $skT.Count; $k++) { $units += , @(($skT[$k] -replace '^-\s*', ''), ($enT[$k] -replace '^-\s*', ''), 'turn') }
  } else {
    $units += , @(((& $join $b.sk) -replace '(^|\s)-\s+', '$1'), ((& $join $b.en) -replace '(^|\s)-\s+', '$1'), $(if ($skT.Count -ge 2) { 'dialogue' } else { 'line' }))
  }
  foreach ($u in $units) {
    $id++
    $p = [ordered]@{ id = $id; s = [math]::Round($s0, 2); e = [math]::Round($e0, 2); sk = $u[0].Trim(); en = $u[1].Trim(); type = $u[2]; kind = 'keep'; flags = @() }
    $letters = $p.sk -replace '[^\p{L}]', ''
    $words = @([regex]::Matches($p.sk, '\p{L}+')).Count
    if ($letters.Length -gt 3 -and $letters -ceq $letters.ToUpper()) { $p.kind = 'screen' }                      # on-screen text
    elseif (-not $p.en) { $p.kind = 'noen' }
    elseif ($p.sk -eq $p.en) { $p.kind = 'untranslated' }
    elseif ($words -lt 3) { $p.kind = 'short' }                                                                      # Áno. / Dobre. / Poď.
    $ratio = if ($p.en.Length) { $p.sk.Length / $p.en.Length } else { 0 }
    if ($p.kind -eq 'keep' -and ($ratio -lt 0.55 -or $ratio -gt 1.8)) { $p.flags += "length ratio $([math]::Round($ratio, 2))" }
    if ($p.type -eq 'dialogue') { $p.flags += 'two speakers in one pair' }
    $pairs.Add($p)
  }
}
# duplicates (same Slovak sentence again): keep the first
$seen = @{}; foreach ($p in $pairs) { if ($p.kind -eq 'keep') { $k = $p.sk.ToLowerInvariant() -replace '[^\p{L} ]', ''; if ($seen[$k]) { $p.kind = 'dup' } else { $seen[$k] = 1 } } }

$out = "$Root/work/subs/$Name"; New-Item -ItemType Directory -Force $out | Out-Null
$pairs | ConvertTo-Json -Depth 4 | Set-Content "$out/pairs.json" -Encoding utf8
"cues: SK $($S.Count)  EN $($E.Count)   bundles: $($bundles.Count)   pairs: $($pairs.Count)"
($pairs | Group-Object kind | Sort-Object Count -Descending | ForEach-Object { "$($_.Name) $($_.Count)" }) -join '  |  '
"kept with a flag: " + @($pairs | Where-Object { $_.kind -eq 'keep' -and $_.flags.Count }).Count + "   multi-cue bundles: " + @($bundles | Where-Object { $_.sk.Count -gt 1 -or $_.en.Count -gt 1 }).Count
