# Minimal static file server for previewing the app: pwsh scripts/serve.ps1 [-Port 8765]
param([int]$Port = 8765, [string]$Dir = (Join-Path (Split-Path $PSScriptRoot -Parent) 'app'))
$types = @{ '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.css' = 'text/css; charset=utf-8'; '.json' = 'application/json'; '.png' = 'image/png'; '.webmanifest' = 'application/manifest+json'; '.svg' = 'image/svg+xml' }
$l = [Net.HttpListener]::new()
$l.Prefixes.Add("http://localhost:$Port/")
$l.Start()
"Serving $Dir at http://localhost:$Port/"
$root = [IO.Path]::GetFullPath($Dir)
while ($l.IsListening) {
  $ctx = $l.GetContext()
  $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
  if (-not $rel) { $rel = 'index.html' }
  $path = [IO.Path]::GetFullPath((Join-Path $root $rel))
  if ($path.StartsWith($root) -and (Test-Path $path -PathType Leaf)) {
    $bytes = [IO.File]::ReadAllBytes($path)
    $ctx.Response.ContentType = $types[[IO.Path]::GetExtension($path)] ?? 'application/octet-stream'
    $ctx.Response.Headers['Cache-Control'] = 'no-store'
    $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  } else { $ctx.Response.StatusCode = 404 }
  $ctx.Response.Close()
}
