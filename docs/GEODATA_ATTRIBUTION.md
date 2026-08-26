# Geographic boundary attribution

LATTICE stores simplified boundary snapshots locally so the control room can be
tested without external runtime calls. Metrics shown on these shapes are demo
values and are not part of the source boundary datasets.

| Dataset | Administrative units | Snapshot | Source and license |
| --- | --- | --- | --- |
| World | 180 country/equivalent polygons | repository snapshot | world.geo.json, derived from Natural Earth |
| United States | 51 states/equivalents | 2024 | US Census Bureau Cartographic Boundary Files |
| Nebraska | 93 counties | 2024 | US Census Bureau Cartographic Boundary Files |
| Czechia | 14 regions (ADM1) | 2021 | geoBoundaries gbOpen, CC BY 4.0 |
| Italy | 20 regions (source layer ADM2) | 2023 | geoBoundaries gbOpen, CC BY 3.0 |
| Colombia | 33 departments/equivalents (ADM1) | 2017 | geoBoundaries gbOpen, ODbL 1.0 |

The Census-derived GeoJSON is reproducible with `scripts/build-us-boundaries.ps1`.
For production, boundary versions must be promoted through the geography
registry and old versions retained so historical decisions remain reproducible.
