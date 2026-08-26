# Figma screen registry

Source file: `LATTICE — Factory Control Room` (`DTgUxEXPudMdXHEu9BMTkd`).

The document contains 20 numbered top-level frames. Frame 04 is a canvas that
contains three independent product screens, so the implementation surface is
exactly 22 screens. `REF — ChatGPT Reference` is a design artifact and is not a
product route.

The executable registry lives in `packages/core/src/screen-registry.ts`. Each
entry owns a stable route, exact Figma node id, domain contour and outbound
screen links. Tests reject missing screens, duplicate routes/nodes and dangling
links.

## Interaction spine

`Command -> Market -> Market drill-down -> Experiment -> Venture -> Treasury -> Campaign -> Content -> Distribution -> Learning -> Command`

Supporting control paths:

- Owner Command -> Capital Allocator -> Venture/Treasury
- Operations -> Audit -> Factory Configuration
- Brands -> Markets and Factory Configuration
- Factory Floor -> Campaigns, Content Factory and Distribution

External writes remain disabled. Screen interactions operate on local governed
state until provider adapters and production authority are explicitly enabled.
