# Next Date: Eventbrite ingestion (PRD "Ingestion pipeline", steps 1–5).
# Reads the public "this weekend in Singapore" listing pages (allowed by eventbrite.sg/robots.txt),
# keeps FACTS ONLY (name, dates, times, venue, location, category, link), writes our own one-line
# description, and saves js/events-eventbrite.js for the app. No Eventbrite text or images are stored.
#
# Usage:  powershell -ExecutionPolicy Bypass -File ingest-eventbrite.ps1 [-Pages 5] [-DelaySeconds 3]
param(
  [int]$Pages = 5,
  [int]$DelaySeconds = 3,
  [string]$Url = 'https://www.eventbrite.sg/d/singapore/events--this-weekend/'
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$out = Join-Path $root 'js\events-eventbrite.js'
$ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) NextDateIngest/0.1 (+facts-only, links back to source)'
$today = [DateTime]::UtcNow.AddHours(8).ToString('yyyy-MM-dd')   # Singapore date
$maxDate = [DateTime]::UtcNow.AddHours(8).AddDays(365).ToString('yyyy-MM-dd')

# Eventbrite category -> Next Date categories. $null = not a date idea (skipped).
$catMap = @{
  'Music' = @('arts', 'nightlife'); 'Performing & Visual Arts' = @('arts'); 'Community & Culture' = @('arts', 'tours')
  'Film, Media & Entertainment' = @('arts', 'chill'); 'Travel & Outdoor' = @('tours', 'nature'); 'Sports & Fitness' = @('sports')
  'Health & Wellness' = @('wellness'); 'Food & Drink' = @('food'); 'Seasonal & Holiday' = @('events'); 'Hobbies & Special Interest' = @('workshops')
  'Charity & Causes' = @('events'); 'Family & Education' = @('workshops'); 'Fashion & Beauty' = @('events'); 'Home & Lifestyle' = @('workshops')
  'Other' = @('events')
  'Science & Technology' = $null; 'Business & Professional' = $null; 'Government & Politics' = $null; 'Religion & Spirituality' = $null
  'Auto, Boat & Air' = $null; 'School Activities' = $null
}

function Get-Region([string]$pc) {
  if ($pc -notmatch '^\d{6}$') { return $null }
  $s = [int]$pc.Substring(0, 2)
  if ($s -ge 11 -and $s -le 13) { return 'West' }
  if ($s -le 41 -or $s -eq 58 -or $s -eq 59) { return 'Central' }
  if ($s -le 52 -or $s -eq 81) { return 'East' }
  if ($s -le 57 -or $s -eq 79 -or $s -eq 80 -or $s -eq 82) { return 'North-East' }
  if ($s -le 71) { return 'West' }
  if ($s -le 78) { return 'North' }
  return $null
}
function To-Min([string]$t) { if ($t -match '^(\d{1,2}):(\d{2})') { return [int]$Matches[1] * 60 + [int]$Matches[2] } return $null }

$events = @{}; $skipped = @{ notDateIdea = 0; invalid = 0; online = 0; duplicate = 0 }
for ($page = 1; $page -le $Pages; $page++) {
  $pageUrl = if ($page -eq 1) { $Url } else { "$($Url)?page=$page" }
  Write-Host "Fetching page $page ..."
  try { $html = (Invoke-WebRequest -UseBasicParsing $pageUrl -UserAgent $ua -TimeoutSec 30).Content }
  catch { Write-Warning "Page $page failed: $_"; break }
  $s = $html.IndexOf('__SERVER_DATA__ = ')
  if ($s -lt 0) { Write-Warning "No structured data on page $page (layout changed?)"; break }
  $s += 18; $e = $html.IndexOf("};`n", $s)
  $data = $html.Substring($s, $e - $s + 1) | ConvertFrom-Json
  $results = $data.search_data.events.results
  if (-not $results) { break }

  foreach ($r in $results) {
    if ($r.is_online_event -or $r.is_cancelled) { $skipped.online++; continue }
    $ebCat = ($r.tags | Where-Object { $_.prefix -eq 'EventbriteCategory' } | Select-Object -First 1).display_name
    if (-not $ebCat) { $ebCat = 'Other' }
    if ($catMap.ContainsKey($ebCat) -and $null -eq $catMap[$ebCat]) { $skipped.notDateIdea++; continue }
    # Wrap in @() so one-item lists stay arrays (PowerShell unrolls them otherwise).
    $cats = @(if ($catMap.ContainsKey($ebCat)) { $catMap[$ebCat] } else { 'events' })
    if ($cats -notcontains 'events') { $cats = @($cats) + 'events' }

    $v = $r.primary_venue; $a = $v.address
    $pc = [string]$a.postal_code; $region = Get-Region $pc
    $lat = [double]$a.latitude; $lng = [double]$a.longitude
    # Validate: dates in range, located in Singapore, has a link.
    if (-not $r.start_date -or -not $r.end_date -or $r.end_date -lt $today -or $r.start_date -gt $maxDate -or
        $a.country -ne 'SG' -or -not $region -or $lat -lt 1.15 -or $lat -gt 1.48 -or $lng -lt 103.59 -or $lng -gt 104.1 -or -not $r.url) {
      $skipped.invalid++; continue
    }
    $key = if ($r.dedup.hash) { $r.dedup.hash } else { $r.id }
    if ($events.ContainsKey($key)) { $skipped.duplicate++; continue }

    $name = ($r.name -replace '\s+', ' ').Trim()
    $text = ($name + ' ' + (($r.tags | ForEach-Object display_name) -join ' ')).ToLower()
    # Professional / training listings are not date ideas.
    if ($text -match '\b(first aid|cpr|certification|certificate|seminar|webinar|conference|networking|career|investing|investment|property|forex|crypto|trading|bootcamp|recruitment|masterclass|exam|compliance|leadership|entrepreneur)') { $skipped.notDateIdea++; continue }
    $format = ($r.tags | Where-Object { $_.prefix -eq 'EventbriteFormat' } | Select-Object -First 1).display_name
    $startMin = To-Min $r.start_time; $endMin = To-Min $r.end_time
    $dur = 120
    if ($null -ne $startMin -and $null -ne $endMin -and $r.start_date -eq $r.end_date -and $endMin -gt $startMin) { $dur = [Math]::Min(600, [Math]::Max(30, $endMin - $startMin)) }
    $slots = @()
    if ($null -eq $startMin) { $slots = @('morning', 'afternoon', 'evening') }
    elseif ($startMin -lt 720) { $slots = @('morning') }
    elseif ($startMin -lt 1020) { $slots = @('afternoon') }
    else { $slots = @('evening') }
    $adults = $text -match '\b(rave|party|club|bar|drag|18\+|r18|r21|beer|wine|cocktail|nightlife|techno|disco|halloween|comedy)\b'
    $family = $ebCat -eq 'Family & Education' -or $text -match '\b(kids?|family|children|parent)\b'
    $outdoor = $text -match '\b(outdoor|park|beach|hike|trail|garden|island|lighthouse|cycling|run)\b' -or $ebCat -eq 'Travel & Outdoor'
    $vibes = @()
    if ($cats -contains 'arts' -or $cats -contains 'tours') { $vibes += 'cultural' }
    if ($adults -or $cats -contains 'sports' -or $outdoor) { $vibes += 'adventurous' }
    if ($cats -contains 'wellness' -or $cats -contains 'chill') { $vibes += 'chill' }
    if ($text -match '\b(jazz|piano|violin|candlelight|orchestra|acoustic|wine)\b') { $vibes += 'romantic' }
    if (-not $adults -and ($cats -contains 'arts' -or $cats -contains 'workshops')) { $vibes += 'first-date' }

    # Our own short description, built from facts only.
    $what = if ($format) { $format.ToLower() } else { 'event' }
    $when = if ($null -ne $startMin) { ' from ' + $r.start_time } else { '' }
    $desc = "A $($ebCat.ToLower()) $what at $($v.name)$when. See the full details, photos and ticket prices on Eventbrite."

    $events[$key] = [ordered]@{
      id = "eb-$($r.id)"; name = $name; short_description = $desc; type = 'event'
      categories = $cats; vibes = @($vibes | Select-Object -Unique)
      start_date = $r.start_date; end_date = $r.end_date; days = $null
      start_time = $r.start_time; end_time = $r.end_time
      time_slots = $slots; duration_min = $dur
      price_min = $null; price_max = $null; price_note = 'Ticket price on Eventbrite'
      venue = $v.name; address = $a.address_1; postal_code = $pc; lat = $lat; lng = $lng; region = $region
      indoor_outdoor = $(if ($outdoor) { 'outdoor' } else { 'indoor' })
      kid_friendly = [bool]($family -and -not $adults); kid_age_min = 0; booking_required = $true
      official_url = $r.url; booking_url = $r.url
      source_name = 'Eventbrite'; source_url = $pageUrl; source_category = $ebCat
      sponsored = $false; status = 'live'; auto_imported = $true; pinned = $false; last_verified_at = $today
      photo = ''; photo_kind = ''; image_url = ''
    }
  }
  if ($page -ge [int]$data.page_count) { break }
  if ($page -lt $Pages) { Start-Sleep -Seconds $DelaySeconds }   # be polite
}

$list = @($events.Values | Sort-Object { $_.start_date }, { $_.start_time })
$json = ConvertTo-Json -InputObject $list -Depth 5 -Compress
$header = "/* Generated by ingest-eventbrite.ps1 on $today (SGT). Facts only; source: Eventbrite ($Url). Do not edit by hand. */`n"
$body = "window.PL = window.PL || {};`nPL.EVENTBRITE_FETCHED_AT = '$([DateTime]::UtcNow.AddHours(8).ToString('yyyy-MM-ddTHH:mm'))+08:00';`nPL.EVENTBRITE_EVENTS = $json;`n"
[IO.File]::WriteAllText($out, $header + $body, (New-Object System.Text.UTF8Encoding $false))
Write-Host ("Saved {0} events to js\events-eventbrite.js (skipped: {1} not date ideas, {2} invalid, {3} online/cancelled, {4} duplicates)" -f $list.Count, $skipped.notDateIdea, $skipped.invalid, $skipped.online, $skipped.duplicate)
