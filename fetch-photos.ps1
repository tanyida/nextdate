# Next Date: collect each supplier's / venue's own sharing photo (og:image) from its official website.
# These are the images sites publish for link previews. Shown with a credit and a link back to the source.
# Get permission from each brand/venue before a public launch.
#
# Usage:  powershell -ExecutionPolicy Bypass -File fetch-photos.ps1
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls11
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$out = Join-Path $root 'js\photos-official.js'
$ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

# id = gift or activity id in the app; url = the page whose sharing photo we use; credit = shown on the photo.
$targets = @(
  # Gift suppliers
  @{ id = 'g-fareastflora'; url = 'https://www.fareastflora.com/'; credit = 'Far East Flora'; kw = 'orchid|bouquet' }
  @{ id = 'g-abetterflorist'; url = 'https://www.abetterflorist.com/'; credit = 'A Better Florist' }
  @{ id = 'g-twg'; url = 'https://twgtea.com/'; credit = 'TWG Tea' }
  @{ id = 'g-bacha'; url = 'https://bachacoffee.com/'; credit = 'Bacha Coffee' }
  @{ id = 'g-bengawan'; url = 'https://www.bengawansolo.com.sg/'; credit = 'Bengawan Solo' }
  @{ id = 'g-awfully'; url = 'https://www.awfullychocolate.com/'; credit = 'Awfully Chocolate'; kw = 'cake' }
  @{ id = 'g-tbbakery'; url = 'https://www.tiongbahrubakery.com/'; credit = 'Tiong Bahru Bakery' }
  @{ id = 'g-risis'; url = 'https://www.risis.com/'; credit = 'RISIS'; kw = 'pendant|earring|brooch' }
  @{ id = 'g-carriek'; url = 'https://carriek.com/'; credit = 'Carrie K.' }
  @{ id = 'g-bynd'; url = 'https://byndartisan.com/'; credit = 'Bynd Artisan' }
  @{ id = 'g-beyondthevines'; url = 'https://www.beyondthevines.com/'; credit = 'Beyond the Vines' }
  @{ id = 'g-lovebonito'; url = 'https://www.lovebonito.com/'; credit = 'Love, Bonito' }
  @{ id = 'g-tangs'; url = 'https://www.tangs.com/'; credit = 'TANGS' }
  @{ id = 'g-supermama'; url = 'https://supermama.sg/'; credit = 'Supermama' }
  @{ id = 'g-euyansang'; url = 'https://www.euyansang.com/'; credit = 'Eu Yan Sang'; kw = 'herbal tea|tea' }
  @{ id = 'g-mandai'; url = 'https://www.mandai.com/en/night-safari.html'; credit = 'Mandai Wildlife Reserve' }
  @{ id = 'g-esplanade'; url = 'https://www.esplanade.com/'; credit = 'Esplanade' }
  @{ id = 'g-gardens'; url = 'https://www.gardensbythebay.com.sg/'; credit = 'Gardens by the Bay' }
  # Venues with their own official site
  @{ id = 'a-cloudforest'; url = 'https://www.gardensbythebay.com.sg/en/things-to-do/attractions/cloud-forest.html'; credit = 'Gardens by the Bay' }
  @{ id = 'a-supertree'; url = 'https://www.gardensbythebay.com.sg/en/things-to-do/attractions/supertree-grove.html'; credit = 'Gardens by the Bay' }
  @{ id = 'a-natgallery'; url = 'https://www.nationalgallery.sg/'; credit = 'National Gallery Singapore' }
  @{ id = 'a-esplanade'; url = 'https://www.esplanade.com/'; credit = 'Esplanade' }
  @{ id = 'a-artscience'; url = 'https://www.marinabaysands.com/museum.html'; credit = 'ArtScience Museum' }
  @{ id = 'a-nightsafari'; url = 'https://www.mandai.com/en/night-safari.html'; credit = 'Mandai Wildlife Reserve' }
  @{ id = 'a-zoo'; url = 'https://www.mandai.com/en/singapore-zoo.html'; credit = 'Mandai Wildlife Reserve' }
  @{ id = 'a-sentosa'; url = 'https://www.sentosa.com.sg/'; credit = 'Sentosa' }
  @{ id = 'a-jewel'; url = 'https://www.jewelchangiairport.com/'; credit = 'Jewel Changi Airport' }
  @{ id = 'e-jazzbay'; url = 'https://www.esplanade.com/'; credit = 'Esplanade' }
)

function Get-OgImage([string]$html, [string]$base) {
  foreach ($p in @(
      '<meta[^>]+(?:property|name)\s*=\s*["''](?:og:image(?::secure_url)?|twitter:image(?::src)?)["''][^>]*content\s*=\s*["'']([^"'']+)["'']',
      '<meta[^>]+content\s*=\s*["'']([^"'']+)["''][^>]*(?:property|name)\s*=\s*["''](?:og:image|twitter:image)["'']')) {
    $m = [regex]::Match($html, $p, 'IgnoreCase')
    if ($m.Success) {
      $u = [System.Net.WebUtility]::HtmlDecode($m.Groups[1].Value.Trim())
      if ($u.StartsWith('//')) { $u = 'https:' + $u }
      elseif (-not $u.StartsWith('http')) { $u = (New-Object Uri((New-Object Uri $base), $u)).AbsoluteUri }
      return $u
    }
  }
  return $null
}

$found = [ordered]@{}; $cache = @{}
foreach ($t in $targets) {
  try {
    if (-not $cache.ContainsKey($t.url)) {
      $html = (Invoke-WebRequest -UseBasicParsing $t.url -UserAgent $ua -TimeoutSec 25).Content
      $cache[$t.url] = Get-OgImage $html $t.url
      Start-Sleep -Milliseconds 800
    }
    $img = $cache[$t.url]
    if (-not $img) { Write-Warning "$($t.id): no sharing image on $($t.url)"; continue }
    # A logo isn't a useful photo. Shopify shops publish a product feed: use a matching product photo instead.
    if ($img -match '(?i)logo' -or $t.kw) {
      $prod = $null
      try {
        $feed = (Invoke-WebRequest -UseBasicParsing ($t.url.TrimEnd('/') + '/products.json?limit=60') -UserAgent $ua -TimeoutSec 25).Content | ConvertFrom-Json
        $withImg = @($feed.products | Where-Object { $_.images.Count -gt 0 })
        if ($t.kw) { $prod = $withImg | Where-Object { $_.title -match "(?i)$($t.kw)" } | Select-Object -First 1 }
        if (-not $prod) { $prod = $withImg | Select-Object -First 1 }
      } catch { }
      if ($prod) { $img = $prod.images[0].src; $t.page = $t.url.TrimEnd('/') + '/products/' + $prod.handle; Write-Host "     $($t.id): product photo '$($prod.title)'" }
      elseif ($img -match '(?i)logo') { Write-Warning "$($t.id): sharing image is a logo, skipped"; continue }
    }
    $img = $img -replace '^http://', 'https://'   # avoid mixed-content blocking on the https site
    # Make sure the image actually loads.
    $r = Invoke-WebRequest -UseBasicParsing $img -UserAgent $ua -TimeoutSec 25 -Method Get
    if ($r.Headers['Content-Type'] -notmatch '^image/') { Write-Warning "$($t.id): $img is not an image"; continue }
    $found[$t.id] = [ordered]@{ src = $img; credit = $t.credit; page = $(if ($t.page) { $t.page } else { $t.url }) }
    Write-Host "OK   $($t.id)"
  } catch { Write-Warning "$($t.id): $($_.Exception.Message)" }
}

$json = ConvertTo-Json -InputObject $found -Depth 4 -Compress
$stamp = [DateTime]::UtcNow.AddHours(8).ToString('yyyy-MM-dd')
$body = "/* Generated by fetch-photos.ps1 on $stamp (SGT). Each site's own sharing image (og:image), credited and linked. */`nwindow.PL = window.PL || {};`nPL.OFFICIAL_PHOTOS = $json;`n"
[IO.File]::WriteAllText($out, $body, (New-Object System.Text.UTF8Encoding $false))
Write-Host "Saved $($found.Count) of $($targets.Count) photos to js\photos-official.js"
