# Stage 3: fetch full, tagged declension tables for the top-N nouns from the Wiktionary API.
param([int]$Top = 400, [switch]$NoFetch, [string]$Root = (Split-Path $PSScriptRoot -Parent))
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$cache = "$Root/work/tables"
New-Item -ItemType Directory -Force $cache | Out-Null
$ua = @{ 'User-Agent' = 'slovak-drill-builder/0.1 (personal learning tool; low volume)' }

$cands = Get-Content "$Root/work/nouns_candidates.json" -Raw | ConvertFrom-Json
# homograph artefacts (score inflated by another word's forms) and vulgarities from the subtitle corpus
$block = @('zob', 'cesto', 'stoj', 'mena', 'medza', 'kopa', 'kurva', 'sexus', 'chujovina', 'suka', 'dobro', 'beta', 'kuba', 'kľud')
$seen = @{}
$picked = foreach ($c in $cands) {
  if ($c.word -in $block) { continue }
  if ($c.word -cnotmatch '^[a-záäčďéíĺľňóôŕšťúýž]+$') { continue }   # single lowercase word, no proper nouns
  if ($c.args.n) { continue }                                         # singular-only / plural-only
  if ($seen[$c.word]) { continue }
  $seen[$c.word] = 1; $c
}
$picked = @($picked | Select-Object -First $Top)

$slotRe = [regex]'lang-sk (nom|gen|dat|acc|loc|ins|voc)(?:&#124;|\|)(s|p)-form-of"[^>]*>(?:<a [^>]*>)?([^<]+)<'
$i = 0
foreach ($n in $picked) {
  $i++
  $file = Join-Path $cache "$($n.word).html"
  if (-not $NoFetch -and -not (Test-Path $file)) {
    # rendered (cached) page HTML via REST; keep only the first declension table in the Slovak section
    $u = "https://en.wiktionary.org/api/rest_v1/page/html/$([uri]::EscapeDataString($n.word))"
    $h = $null
    for ($try = 1; -not $h -and $try -le 5; $try++) {
      try { $h = (Invoke-WebRequest $u -Headers $ua).Content }
      catch {
        $code = [int]$_.Exception.Response.StatusCode
        "error $code on $($n.word) (try $try)"
        if ($code -eq 404) { break }
        Start-Sleep -Seconds (15 * $try)
      }
    }
    if (-not $h) { "skipping $($n.word)"; continue }
    $i = $h.IndexOf('id="Slovak"')
    $sk = if ($i -ge 0) { $h.Substring($i) } else { '' }
    $t0 = $sk.IndexOf('inflection-table'); $t1 = if ($t0 -ge 0) { $sk.IndexOf('</table>', $t0) } else { -1 }
    Set-Content $file $(if ($t1 -gt 0) { $sk.Substring([math]::Max(0, $t0 - 200), $t1 - $t0 + 208) } else { '' })
    Start-Sleep -Milliseconds 1200
  }
  if ($i % 50 -eq 0) { "fetched $i / $($picked.Count)" }
}

$out = foreach ($n in $picked) {
  $cf = Join-Path $cache "$($n.word).html"
  if (-not (Test-Path $cf)) { continue }
  $html = Get-Content $cf -Raw
  if (-not $html) { continue }
  $slots = [ordered]@{}
  foreach ($m in $slotRe.Matches($html)) {
    $k = "$($m.Groups[1].Value)_$($m.Groups[2].Value)"
    if (-not $slots[$k]) { $slots[$k] = [Collections.Generic.List[string]]::new() }
    $f = [Net.WebUtility]::HtmlDecode($m.Groups[3].Value).Trim()
    if ($f -and -not $slots[$k].Contains($f)) { $slots[$k].Add($f) }
  }
  $pattern = if ($html -match 'declension pattern ([^"]+)"') { $Matches[1] } else { $null }
  [pscustomobject]@{ word = $n.word; head = $n.head; type = $n.args.'1'; pattern = $pattern; gloss = $n.gloss; score = $n.score; forms = $slots }
}
$out | ConvertTo-Json -Depth 5 | Set-Content "$Root/work/nouns_full.json"
"done: $($out.Count) nouns"
