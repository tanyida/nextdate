# Next Date: Eventbrite ingestion (PRD "Ingestion pipeline", steps 1–5).
# Reads the public Singapore listing pages for this weekend, this week, next week and next month
# (allowed by eventbrite.sg/robots.txt), keeps facts (name, dates, times, venue, location, category, link)
# plus a link to the organiser's event image (shown credited), writes our own one-line description, and
# saves js/events-eventbrite.js. No Eventbrite description text is stored.
# Get Eventbrite's permission before a public launch.
#
# Runs daily on GitHub Actions (.github/workflows/daily-events.yml) and works locally too:
#   powershell -ExecutionPolicy Bypass -File ingest-eventbrite.ps1 [-PagesPerUrl 4] [-DelaySeconds 3]
#
# Safety: events from earlier runs are kept until they end; if nothing could be fetched (site down,
# blocked, layout changed) the existing file is left untouched and the script exits with an error.
param(
  [int]$PagesPerUrl = 4,
  [int]$DelaySeconds = 3,
  [string[]]$Urls = @(
    'https://www.eventbrite.sg/d/singapore/events--this-weekend/',
    'https://www.eventbrite.sg/d/singapore/events--this-week/',
    'https://www.eventbrite.sg/d/singapore/events--next-week/',
    'https://www.eventbrite.sg/d/singapore/events--next-month/'
  ),
  [int]$KeepOldDays = 7   # keep previously ingested, still-upcoming events seen within this many days
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$out = [IO.Path]::Combine($root, 'js', 'events-eventbrite.js')   # works on Windows and Linux
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
# PowerShell 7 turns date-like JSON strings into DateTime objects; normalise back to yyyy-MM-dd.
function D($v) { if ($v -is [datetime]) { return $v.ToString('yyyy-MM-dd') } if ($null -eq $v) { return $null } return [string]$v }

$events = @{}; $skipped = @{ notDateIdea = 0; invalid = 0; online = 0; duplicate = 0 }; $pagesOk = 0
foreach ($Url in $Urls) {
for ($page = 1; $page -le $PagesPerUrl; $page++) {
  $pageUrl = if ($page -eq 1) { $Url } else { "$($Url)?page=$page" }
  Write-Host "Fetching $pageUrl ..."
  try { $html = (Invoke-WebRequest -UseBasicParsing $pageUrl -UserAgent $ua -TimeoutSec 30).Content }
  catch { Write-Warning "Page failed: $_"; break }
  $s = $html.IndexOf('__SERVER_DATA__ = ')
  if ($s -lt 0) { Write-Warning "No structured data on page $page (layout changed?)"; break }
  $s += 18; $e = $html.IndexOf("};`n", $s)
  $data = $html.Substring($s, $e - $s + 1) | ConvertFrom-Json
  $results = $data.search_data.events.results
  if (-not $results) { break }
  $pagesOk++

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
    $sd = D $r.start_date; $ed = D $r.end_date
    # Validate: dates in range, located in Singapore, has a link.
    if (-not $sd -or -not $ed -or $ed -lt $today -or $sd -gt $maxDate -or
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
    if ($null -ne $startMin -and $null -ne $endMin -and $sd -eq $ed -and $endMin -gt $startMin) { $dur = [Math]::Min(600, [Math]::Max(30, $endMin - $startMin)) }
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
      start_date = $sd; end_date = $ed; days = $null
      start_time = $r.start_time; end_time = $r.end_time
      time_slots = $slots; duration_min = $dur
      price_min = $null; price_max = $null; price_note = 'Ticket price on Eventbrite'
      venue = $v.name; address = $a.address_1; postal_code = $pc; lat = $lat; lng = $lng; region = $region
      indoor_outdoor = $(if ($outdoor) { 'outdoor' } else { 'indoor' })
      kid_friendly = [bool]($family -and -not $adults); kid_age_min = 0; booking_required = $true
      official_url = $r.url; booking_url = $r.url
      source_name = 'Eventbrite'; source_url = $pageUrl; source_category = $ebCat
      sponsored = $false; status = 'live'; auto_imported = $true; pinned = $false; last_verified_at = $today
      # The organiser's event image, shown credited with a link back to the listing.
      photo = ''; photo_kind = ''
      image_url = $(if ($r.image -and $r.image.image_sizes) { [string]$r.image.image_sizes.medium } else { '' })
      image_credit = 'Event organiser via Eventbrite'; image_page = $r.url
    }
  }
  if ($page -ge [int]$data.page_count) { break }
  Start-Sleep -Seconds $DelaySeconds   # be polite
}
}

# Safety: nothing fetched (blocked, offline or layout change) -> keep the current file and fail loudly.
if ($pagesOk -eq 0 -or $events.Count -eq 0) {
  Write-Error "No events could be fetched from Eventbrite; leaving js/events-eventbrite.js unchanged."
  exit 1
}

# Merge: keep earlier events that are still upcoming and were seen recently, even if today's pages
# didn't list them (listing pages only show a slice of what's on).
$fresh = @($events.Values)
$freshIds = @{}; $fresh | ForEach-Object { $freshIds[$_.id] = $true }
$kept = 0
if (Test-Path $out) {
  try {
    $old = [IO.File]::ReadAllText($out)
    $i = $old.IndexOf('PL.EVENTBRITE_EVENTS = ')
    if ($i -ge 0) {
      $prev = $old.Substring($i + 23).Trim().TrimEnd(';') | ConvertFrom-Json
      $since = [DateTime]::UtcNow.AddHours(8).AddDays(-$KeepOldDays).ToString('yyyy-MM-dd')
      foreach ($p in @($prev)) {
        $p.start_date = D $p.start_date; $p.end_date = D $p.end_date; $p.last_verified_at = D $p.last_verified_at
        if (-not $freshIds.ContainsKey($p.id) -and $p.end_date -ge $today -and $p.last_verified_at -ge $since) { $fresh += $p; $kept++ }
      }
    }
  } catch { Write-Warning "Couldn't read the previous events file, starting fresh: $_" }
}

$list = @($fresh | Sort-Object { $_.start_date }, { $_.start_time })
$json = ConvertTo-Json -InputObject $list -Depth 5 -Compress
$header = "/* Generated by ingest-eventbrite.ps1 on $today (SGT). Facts only; source: Eventbrite Singapore listings. Do not edit by hand. */`n"
$body = "window.PL = window.PL || {};`nPL.EVENTBRITE_FETCHED_AT = '$([DateTime]::UtcNow.AddHours(8).ToString('yyyy-MM-ddTHH:mm'))+08:00';`nPL.EVENTBRITE_EVENTS = $json;`n"
[IO.File]::WriteAllText($out, $header + $body, (New-Object System.Text.UTF8Encoding $false))
Write-Host ("Saved {0} events ({1} new/refreshed, {2} kept from earlier runs) from {3} pages. Skipped: {4} not date ideas, {5} invalid, {6} online/cancelled, {7} duplicates." -f $list.Count, $events.Count, $kept, $pagesOk, $skipped.notDateIdea, $skipped.invalid, $skipped.online, $skipped.duplicate)
