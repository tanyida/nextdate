# Minimal static file server for local testing on Windows (no installs needed).
# Usage:  powershell -ExecutionPolicy Bypass -File serve.ps1 [-Port 8080]
param([int]$Port = 8080)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$types = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.css' = 'text/css; charset=utf-8'
  '.svg' = 'image/svg+xml'; '.json' = 'application/json'; '.webmanifest' = 'application/manifest+json'
  '.png' = 'image/png'; '.ico' = 'image/x-icon'; '.md' = 'text/plain; charset=utf-8'
}
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Next Date running at http://localhost:$Port/  (Ctrl+C to stop)"
try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    try {
      $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
      if ([string]::IsNullOrEmpty($path)) { $path = 'index.html' }
      $file = [IO.Path]::GetFullPath((Join-Path $root $path))
      [byte[]]$bytes = $null
      if (-not $file.StartsWith($root) -or -not (Test-Path $file -PathType Leaf)) {
        $ctx.Response.StatusCode = 404
        $bytes = [Text.Encoding]::UTF8.GetBytes('Not found')
      } else {
        $ext = [IO.Path]::GetExtension($file).ToLower()
        $ctx.Response.ContentType = if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' }
        $ctx.Response.Headers.Add('Cache-Control', 'no-cache')
        $bytes = [IO.File]::ReadAllBytes($file)
      }
      $ctx.Response.ContentLength64 = $bytes.Length
      if ($ctx.Request.HttpMethod -ne 'HEAD') { $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length) }
      $ctx.Response.Close()
    } catch {
      Write-Host "Request failed: $_"
      try { $ctx.Response.Abort() } catch {}
    }
  }
} finally { $listener.Stop() }
