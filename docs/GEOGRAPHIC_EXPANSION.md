# Geographic expansion

Figma's United States/Nebraska, Czechia, Italy and Colombia screens are sample
states of one geographic intelligence surface. They are not separate code
paths.

## Model

- `GeographyDefinition` describes a country's local hierarchy and supported
  market dimensions.
- `BoundaryDataset` freezes the authoritative source, license, version and
  geometry format used for a run.
- `AdminUnit` is a provider-neutral parent/child unit with both normalized and
  local type/name. County, parish, borough, kraj, comune and equivalent units
  need no special UI code.
- `MarketAreaOverlay` maps one or several administrative units into an
  economically meaningful cell for a brand and activity dimension.
- `DrillDownPolicy` decides whether to expand, aggregate or stop based on depth,
  observation count, population and privacy thresholds.

## Expansion flow

`Country selection -> source adapter -> versioned boundary import -> hierarchy validation -> market overlay -> metric join -> vector rendering -> policy-controlled drill-down`

The raw administrative map remains immutable for its dataset version. Market
clusters and scoring layers are separate overlays, so learning can change
commercial boundaries without rewriting geographic truth.

No country is auto-enabled for spending. Importing geography creates discovery
capacity only; brand access, metrics, experiments and capital authority remain
separate governed decisions.
