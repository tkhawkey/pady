# Stage 4: verbs.json = corpus-attested case government (UD SNK) + English gloss and extra frames (Wiktionary).
param([int]$MinCount = 3, [string]$Root = (Split-Path $PSScriptRoot -Parent))
$ErrorActionPreference = 'Stop'
$caseLetter = @{ genitive = 'G'; dative = 'D'; accusative = 'A'; locative = 'L'; instrumental = 'I' }
$skip = @('byť', 'mať')   # copula / possession: frames are idiomatic noise

$ud = Get-Content "$Root/work/ud_frames.json" -Raw | ConvertFrom-Json
$ud = $ud | Where-Object { $_.count -ge $MinCount -and $_.verb.Split(' ')[0] -notin $skip }
# keep plain-accusative frames only for verbs where they are frequent (these are the "default" case)
$ud = $ud | Where-Object { $_.frame -ne 'A' -or $_.count -ge 8 }
$byVerb = $ud | Group-Object verb

$bases = @{}; foreach ($g in $byVerb) { $bases[$g.Name.Split(' ')[0]] = 1 }
$wk = @{}   # base -> @{ gloss_plain; gloss_refl; frames[] }
foreach ($line in [IO.File]::ReadLines("$Root/raw/sk.jsonl")) {
  if (-not $line.Contains('"pos": "verb"')) { continue }
  $hit = $false
  foreach ($m in [regex]::Matches($line, '"word": "([^"]+)"')) { if ($bases.ContainsKey($m.Groups[1].Value)) { $hit = $true; break } }
  if (-not $hit) { continue }
  $o = $line | ConvertFrom-Json
  if ($o.lang_code -ne 'sk') { continue }
  # the entry itself, or an aspect partner listed in its forms (e.g. pomôcť -> pomáhať), whose gloss we borrow
  $partners = @($o.forms | Where-Object { $_.tags -contains 'imperfective' -or $_.tags -contains 'perfective' } | ForEach-Object form)
  $keys = @($o.word | Where-Object { $bases.ContainsKey($_) }) + @($partners | Where-Object { $bases.ContainsKey($_) -and -not $wk[$_] } | ForEach-Object { "~$_" })
  if (-not $keys) { continue }
  $entry = @{ plain = $null; refl = @{}; frames = [Collections.Generic.List[object]]::new() }
  foreach ($k in $keys) {
    if ($k.StartsWith('~')) { if (-not $wk[$k]) { $wk[$k] = $entry } }
    elseif (-not $wk[$k]) { $wk[$k] = $entry } else { $entry = $wk[$k] }
  }
  $e = $entry
  foreach ($s in $o.senses) {
    if (-not $s.glosses) { continue }
    $raw = $s.raw_glosses -join ' '
    $refl = if ($raw -match 'reflexive with (sa|si)') { $Matches[1] } else { $null }
    $g = ($s.glosses[-1] -replace '\s*\(.*?\)', '' -replace '\s*\[.*?\]\s*', ' ').Trim()
    if ($g -match 'form of|^\s*$') { continue }
    if ($refl) { if (-not $e.refl[$refl]) { $e.refl[$refl] = $g } } elseif (-not $e.plain) { $e.plain = $g }
    foreach ($w in [regex]::Matches($raw, '\[with ([^\]]+)\]')) {
      $t = $w.Groups[1].Value
      foreach ($pm in [regex]::Matches($t, '(?:^|\s)([a-zčďľňšťžáéíóúýô]{1,5}) \(\+ (genitive|dative|accusative|locative|instrumental)\)')) {
        $e.frames.Add([pscustomobject]@{ refl = $refl; frame = "$($pm.Groups[1].Value)+$($caseLetter[$pm.Groups[2].Value])" })
      }
      $bare = $t -replace '\w+ \(\+ \w+\)', ''
      foreach ($bm in [regex]::Matches($bare, '\b(genitive|dative|accusative|locative|instrumental)\b')) {
        $e.frames.Add([pscustomobject]@{ refl = $refl; frame = $caseLetter[$bm.Groups[1].Value] })
      }
    }
  }
}

$manual = @{}
if (Test-Path "$Root/scripts/manual_glosses.json") {
  (Get-Content "$Root/scripts/manual_glosses.json" -Raw | ConvertFrom-Json).PSObject.Properties | ForEach-Object { $manual[$_.Name] = $_.Value }
}
$missing = [Collections.Generic.List[string]]::new()
$out = foreach ($g in $byVerb) {
  $base, $refl = $g.Name.Split(' ')
  $e = $wk[$base]; $glossSrc = 'wiktionary'
  if (-not $e) { $e = $wk["~$base"]; $glossSrc = 'wiktionary-aspect-partner' }
  $gloss = if ($e) { if ($refl -and $e.refl[$refl]) { $e.refl[$refl] } else { $e.plain } } else { $null }
  if (-not $gloss) { $gloss = $manual[$g.Name]; $glossSrc = 'manual' }
  if (-not $gloss) { $missing.Add($g.Name); continue }
  $sum = ($g.Group | Measure-Object count -Sum).Sum
  $frames = foreach ($f in ($g.Group | Sort-Object count -Descending)) {
    $prep, $case = if ($f.frame.Contains('+')) { $f.frame.Split('+') } else { $null, $f.frame }
    $wiki = [bool]($e.frames | Where-Object { $_.frame -eq $f.frame -and $_.refl -eq $refl })
    $core = $wiki -or $f.count -ge 5 -or ($f.count / $sum) -ge 0.25
    [pscustomobject]@{ prep = $prep; case = $case; corpusCount = $f.count; wiktionary = $wiki; core = $core; examples = @($f.examples) }
  }
  [pscustomobject]@{ verb = $g.Name; gloss = $gloss; glossSource = $glossSrc; total = ($g.Group | Measure-Object count -Sum).Sum; frames = @($frames) }
}
$out = @($out | Sort-Object total -Descending)
New-Item -ItemType Directory -Force "$Root/data" | Out-Null
$out | ConvertTo-Json -Depth 7 | Set-Content "$Root/data/verbs.json" -Encoding utf8
Set-Content "$Root/work/verbs_missing_gloss.txt" -Value ($missing -join "`n")
"missing gloss: $($missing.Count)"
"verbs: $($out.Count)  frames: $(($out.frames | Measure-Object).Count)  wiktionary-confirmed frames: $(($out.frames | Where-Object wiktionary).Count)"
