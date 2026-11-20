# Fetch more noun tables from Wiktionary, then rebuild everything that depends on the noun list.
#   pwsh scripts/expand_nouns.ps1 -Top 600
# Resumable: tables already in work/tables are not fetched again.
param([int]$Top = 600, [string]$Root = (Split-Path $PSScriptRoot -Parent))
$ErrorActionPreference = 'Stop'
$s = $PSScriptRoot
function Step($name, [scriptblock]$b) { "`n=== $name  $(Get-Date -Format HH:mm:ss)"; & $b }

Step 'fetch noun tables'      { & "$s/fetch_nouns.ps1" -Top $Top | Where-Object { $_ -notmatch '^error 429' } }
Step 'validate (1st pass)'    { & "$s/build_data.ps1" }
Step 'real adjective pairs'   { & "$s/adj_pairs.ps1" | Select-Object -First 1 }
Step 'validate (with pairs)'  { & "$s/build_data.ps1" }
Step 'frequency ownership'    { & "$s/check_homographs.ps1" | Out-Null; 'done' }
Step 'bundle app/data.js'     { & "$s/build_bundle.ps1" }
"`n=== finished $(Get-Date -Format HH:mm:ss)"
