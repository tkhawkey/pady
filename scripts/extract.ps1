# Stage 1: pull candidate nouns / adjectives / verbs from the kaikki Slovak dump, scored by frequency.
param([string]$Root = (Split-Path $PSScriptRoot -Parent))
$ErrorActionPreference = 'Stop'

$freq = @{}
foreach ($line in [IO.File]::ReadLines("$Root/raw/sk_50k.txt")) {
  $p = $line.Split(' ')
  if ($p.Length -eq 2) { $freq[$p[0]] = [long]$p[1] }
}

function Get-Score($forms) {
  $s = 0L
  foreach ($f in ($forms | Select-Object -Unique)) {
    foreach ($w in $f.Split(' ')) { if ($freq.ContainsKey($w)) { $s += $freq[$w] } }
  }
  $s
}

$nouns = [Collections.Generic.List[object]]::new()
$adjs  = [Collections.Generic.List[object]]::new()
$verbs = [Collections.Generic.List[object]]::new()

foreach ($line in [IO.File]::ReadLines("$Root/raw/sk.jsonl")) {
  $isNoun = $line.Contains('"sk-ndecl"')
  $isAdj  = $line.Contains('"sk-adecl"')
  $isVerb = $line.Contains('"pos": "verb"') -and $line.Contains('[with ')
  if (-not ($isNoun -or $isAdj -or $isVerb)) { continue }
  $o = $line | ConvertFrom-Json
  if ($o.lang_code -ne 'sk') { continue }
  $gloss = ($o.senses | Where-Object { $_.glosses } | Select-Object -First 3 | ForEach-Object { $_.glosses[-1] }) -join '; '
  # score only real inflected forms: untagged noun table cells, or case-tagged adjective/verb cells
  $junk = 'table-tags', 'inflection-template', 'declension-pattern-of', 'diminutive', 'augmentative', 'relational', 'comparative', 'superlative', 'adverb', 'perfective', 'imperfective', 'feminine-equivalent', 'masculine-equivalent'
  $formStrs = @($o.word) + @($o.forms | Where-Object { -not $_.tags -or -not ($_.tags | Where-Object { $_ -in $junk }) } | Where-Object { -not ($isNoun -and $_.tags) } | ForEach-Object { $_.form })

  if ($isNoun -and $o.pos -eq 'noun') {
    $tpl = $o.inflection_templates | Where-Object name -eq 'sk-ndecl' | Select-Object -First 1
    $nouns.Add([pscustomobject]@{
      word = $o.word; head = ($o.head_templates.expansion -join '; ')
      args = $tpl.args; gloss = $gloss; score = (Get-Score $formStrs)
    })
  }
  elseif ($isAdj -and $o.pos -eq 'adj') {
    $adjs.Add([pscustomobject]@{
      word = $o.word; gloss = $gloss; score = (Get-Score $formStrs)
      forms = @($o.forms | Where-Object { $_.tags -and $_.tags -notcontains 'table-tags' -and $_.tags -notcontains 'inflection-template' -and $_.tags -notcontains 'error-unrecognized-form' } | ForEach-Object { [pscustomobject]@{ f = $_.form; t = $_.tags } })
    })
  }
  if ($isVerb -and $o.pos -eq 'verb') {
    $senses = @($o.senses | Where-Object { ($_.raw_glosses -join ' ') -match '\[with ' } | ForEach-Object {
      [pscustomobject]@{ raw = ($_.raw_glosses -join ' '); tags = $_.tags; examples = @($_.examples | Select-Object -First 2 | ForEach-Object { [pscustomobject]@{ text = $_.text; english = $_.english } }) }
    })
    $inf = ($o.forms | Where-Object { $_.tags -contains 'infinitive' } | Select-Object -First 1).form
    $verbs.Add([pscustomobject]@{ word = $o.word; inf = $inf; head = ($o.head_templates.expansion -join '; '); score = (Get-Score $formStrs); senses = $senses })
  }
}

New-Item -ItemType Directory -Force "$Root/work" | Out-Null
$nouns | Sort-Object score -Descending | ConvertTo-Json -Depth 6 | Set-Content "$Root/work/nouns_candidates.json"
$adjs  | Sort-Object score -Descending | ConvertTo-Json -Depth 6 | Set-Content "$Root/work/adj_candidates.json"
$verbs | Sort-Object score -Descending | ConvertTo-Json -Depth 8 | Set-Content "$Root/work/verb_candidates.json"
"nouns $($nouns.Count)  adjs $($adjs.Count)  verbs $($verbs.Count)"
