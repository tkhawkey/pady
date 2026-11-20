# Fetch the full Wiktionary declension table for every Hľadaj noun (not just the game nouns), so the lookup ships
# with complete tables that check_stur.ps1 can verify, instead of fetching them live in the browser.
#   in : app/lookup-data.js (noun list)     cache: work/tables/<word>.html (shared with fetch_nouns.ps1)
#   out: work/lookup_tables.json  { word: { "nom_s": [forms], ... } }
# Polite: one request at a time, 1.2 s apart, backs off on 429. Safe to stop and re-run (the cache is kept).
param([string]$Root = (Split-Path $PSScriptRoot -Parent), [switch]$NoFetch)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$cache = "$Root/work/tables"; New-Item -ItemType Directory -Force $cache | Out-Null
$ua = @{ 'User-Agent' = 'slovak-drill-builder/0.1 (personal learning tool; low volume)' }
$L = Get-Content "$Root/app/lookup-data.js" -Raw -Encoding utf8; $L = $L.Substring($L.IndexOf('{')).TrimEnd().TrimEnd(';') | ConvertFrom-Json
$words = @($L.nouns | ForEach-Object { $_[0] } | Where-Object { $_ -cmatch '^[a-záäčďéíĺľňóôŕšťúýž]+$' } | Select-Object -Unique)
$todo = @($words | Where-Object { -not (Test-Path (Join-Path $cache "$_.html")) })
"nouns: $($words.Count)   cached already: $($words.Count - $todo.Count)   to fetch: $($todo.Count)"
$n = 0
if (-not $NoFetch) {
  foreach ($w in $todo) {
    $n++
    $u = "https://en.wiktionary.org/api/rest_v1/page/html/$([uri]::EscapeDataString($w))"
    $h = $null; $gone = $false
    for ($try = 1; -not $h -and $try -le 5; $try++) {
      try { $h = (Invoke-WebRequest $u -Headers $ua).Content }
      catch {
        $code = [int]$_.Exception.Response.StatusCode
        if ($code -eq 404) { $gone = $true; break }
        "error $code on $w (try $try)"; Start-Sleep -Seconds (15 * $try)
      }
    }
    $html = ''
    if ($h) {
      $i = $h.IndexOf('id="Slovak"'); $sk = if ($i -ge 0) { $h.Substring($i) } else { '' }
      $t0 = $sk.IndexOf('inflection-table'); $t1 = if ($t0 -ge 0) { $sk.IndexOf('</table>', $t0) } else { -1 }
      if ($t1 -gt 0) { $html = $sk.Substring([math]::Max(0, $t0 - 200), $t1 - $t0 + 208) }
    }
    if ($h -or $gone) { Set-Content (Join-Path $cache "$w.html") $html }   # empty file = no table (don't ask again)
    if ($n % 100 -eq 0) { "fetched $n / $($todo.Count)  $(Get-Date -Format HH:mm)" }
    Start-Sleep -Milliseconds 1200
  }
}

$slotRe = [regex]'lang-sk (nom|gen|dat|acc|loc|ins)(?:&#124;|\|)(s|p)-form-of"[^>]*>(?:<a [^>]*>)?([^<]+)<'
$out = [ordered]@{}
foreach ($w in $words) {
  $cf = Join-Path $cache "$w.html"; if (-not (Test-Path $cf)) { continue }
  $html = Get-Content $cf -Raw; if (-not $html) { continue }
  $slots = [ordered]@{}
  foreach ($m in $slotRe.Matches($html)) {
    $k = "$($m.Groups[1].Value)_$($m.Groups[2].Value)"
    if (-not $slots.Contains($k)) { $slots[$k] = [Collections.Generic.List[string]]::new() }
    $f = [Net.WebUtility]::HtmlDecode($m.Groups[3].Value).Trim().ToLowerInvariant()
    if ($f -and -not $slots[$k].Contains($f)) { $slots[$k].Add($f) }
  }
  if ($slots.Count -eq 12) { $out[$w] = $slots }
}
$out | ConvertTo-Json -Depth 4 -Compress | Set-Content "$Root/work/lookup_tables.json" -Encoding utf8
"complete tables: $($out.Count) / $($words.Count)"
