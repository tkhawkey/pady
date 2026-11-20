# Fetch the full declension tables of the 12 model words (vzory) from Wiktionary -> data/models.json
param([string]$Root = (Split-Path $PSScriptRoot -Parent))
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$models = [ordered]@{
  chlap = 'm-pers'; hrdina = 'm-pers'; dub = 'm-inan'; stroj = 'm-inan'
  'žena' = 'f'; ulica = 'f'; 'dlaň' = 'f'; 'kosť' = 'f'
  mesto = 'n'; srdce = 'n'; 'vysvedčenie' = 'n'; 'dievča' = 'n'
}
$ua = @{ 'User-Agent' = 'slovak-drill-builder/0.1 (personal learning tool; low volume)' }
$cases = 'nom', 'gen', 'dat', 'acc', 'loc', 'ins'
$slotRe = [regex]'lang-sk (nom|gen|dat|acc|loc|ins|voc)(?:&#124;|\|)(s|p)-form-of"[^>]*>(?:<a [^>]*>)?([^<]+)<'
$cache = "$Root/work/tables"
New-Item -ItemType Directory -Force $cache | Out-Null

$out = foreach ($w in $models.Keys) {
  $file = Join-Path $cache "$w.html"
  if (-not (Test-Path $file) -or (Get-Item $file).Length -lt 100) {
    $h = $null
    for ($try = 1; -not $h -and $try -le 5; $try++) {
      try { $h = (Invoke-WebRequest "https://en.wiktionary.org/api/rest_v1/page/html/$([uri]::EscapeDataString($w))" -Headers $ua).Content }
      catch { "retry $w ($try)"; Start-Sleep -Seconds (10 * $try) }
    }
    $i = $h.IndexOf('id="Slovak"'); $sk = $h.Substring($i)
    $t0 = $sk.IndexOf('inflection-table'); $t1 = $sk.IndexOf('</table>', $t0)
    Set-Content $file $sk.Substring([math]::Max(0, $t0 - 200), $t1 - $t0 + 208)
    Start-Sleep -Milliseconds 1500
  }
  $html = Get-Content $file -Raw
  $slots = @{}
  foreach ($m in $slotRe.Matches($html)) {
    $k = "$($m.Groups[1].Value)_$($m.Groups[2].Value)"
    if (-not $slots[$k]) { $slots[$k] = [Collections.Generic.List[string]]::new() }
    $f = [Net.WebUtility]::HtmlDecode($m.Groups[3].Value).Trim()
    if ($f -and -not $slots[$k].Contains($f)) { $slots[$k].Add($f) }
  }
  $missing = @(foreach ($c in $cases) { foreach ($n in 's', 'p') { if (-not $slots["${c}_$n"]) { "${c}_$n" } } })
  if ($missing) { throw "$w missing $($missing -join ',')" }
  [ordered]@{
    w = $w; gen = $models[$w]
    s = @($cases | ForEach-Object { $slots["${_}_s"][0] }); p = @($cases | ForEach-Object { $slots["${_}_p"][0] })
    alt = [ordered]@{} + (@{} | ForEach-Object { $h2 = [ordered]@{}; foreach ($k in $slots.Keys) { if ($slots[$k].Count -gt 1 -and $k -notlike 'voc*') { $h2[$k] = @($slots[$k][1..($slots[$k].Count - 1)]) } }; $h2 })
  }
}
$out | ConvertTo-Json -Depth 5 | Set-Content "$Root/data/models.json" -Encoding utf8
$out | ForEach-Object { "{0,-12} sg: {1}  |  pl: {2}" -f $_.w, ($_.s -join ' '), ($_.p -join ' ') }
