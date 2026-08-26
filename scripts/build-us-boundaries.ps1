param(
  [Parameter(Mandatory = $true)][string]$StatesKml,
  [Parameter(Mandatory = $true)][string]$CountiesKml,
  [Parameter(Mandatory = $true)][string]$OutputDirectory
)

$ErrorActionPreference = 'Stop'

# Source: US Census Bureau 2024 cartographic boundary KML files.
# https://www2.census.gov/geo/tiger/GENZ2024/kml/cb_2024_us_state_20m.zip
# https://www2.census.gov/geo/tiger/GENZ2024/kml/cb_2024_us_county_20m.zip
function Convert-Coordinates([string]$Text) {
  return @($Text.Trim() -split '\s+' | ForEach-Object {
    $parts = $_ -split ','
    ,@([double]$parts[0], [double]$parts[1])
  })
}

function Convert-Kml([string]$Path, [scriptblock]$Include) {
  [xml]$document = Get-Content -Raw -LiteralPath $Path
  $features = @()
  foreach ($placemark in $document.SelectNodes("//*[local-name()='Placemark']")) {
    $properties = @{}
    foreach ($datum in $placemark.SelectNodes(".//*[local-name()='SimpleData']")) {
      $properties[$datum.GetAttribute('name')] = $datum.InnerText
    }
    if (-not (& $Include $properties)) { continue }

    $polygons = @()
    foreach ($polygon in $placemark.SelectNodes(".//*[local-name()='Polygon']")) {
      $rings = @()
      $outer = $polygon.SelectSingleNode("./*[local-name()='outerBoundaryIs']/*[local-name()='LinearRing']/*[local-name()='coordinates']")
      if ($null -eq $outer) { continue }
      $rings += ,(Convert-Coordinates $outer.InnerText)
      foreach ($inner in $polygon.SelectNodes("./*[local-name()='innerBoundaryIs']/*[local-name()='LinearRing']/*[local-name()='coordinates']")) {
        $rings += ,(Convert-Coordinates $inner.InnerText)
      }
      $polygons += ,$rings
    }
    if ($polygons.Count -eq 0) { continue }
    $geometry = if ($polygons.Count -eq 1) {
      @{ type = 'Polygon'; coordinates = $polygons[0] }
    } else {
      @{ type = 'MultiPolygon'; coordinates = $polygons }
    }
    $features += @{ type = 'Feature'; properties = $properties; geometry = $geometry }
  }
  return @{ type = 'FeatureCollection'; features = $features }
}

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$states = Convert-Kml $StatesKml { param($properties) $properties.STUSPS -match '^[A-Z]{2}$' -and $properties.STUSPS -notin @('AS','GU','MP','PR','VI') }
$counties = Convert-Kml $CountiesKml { param($properties) $properties.STATEFP -eq '31' }
$states | ConvertTo-Json -Depth 100 -Compress | Set-Content -Encoding utf8 (Join-Path $OutputDirectory 'us-states.geojson')
$counties | ConvertTo-Json -Depth 100 -Compress | Set-Content -Encoding utf8 (Join-Path $OutputDirectory 'nebraska-counties.geojson')
Write-Output "Generated $($states.features.Count) states and $($counties.features.Count) Nebraska counties."
