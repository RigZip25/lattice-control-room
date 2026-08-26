# Figma implementation gap audit

This audit separates route coverage from product fidelity. All 22 routes exist,
but route existence is not treated as completion. A screen is complete only when
its information hierarchy, domain controls, interactions and responsive states
are implemented and verified.

## Delivery tiers

| Tier | Screens | Current state | Exit condition |
| --- | --- | --- | --- |
| 1 — operating spine | Command, Markets, geographic drill-downs, Experiments, Content Factory, Distribution, Learning, Capital Allocator, Venture, Treasury | In progress | The discovery → experiment → production → distribution → learning → capital loop is navigable and uses governed read models. |
| 2 — execution control | Factory Floor, Campaigns, Channels, Assets, Operations | Structured prototype | Replace generic panels with queues, lifecycle states, lineage and exception handling. |
| 3 — governance | Audit, Brands, Owner Command, Factory Configuration | Structured prototype | Implement policy history, authority editing, configuration readiness and owner-level decisions. |

## Screen-by-screen status

| # | Route | Fidelity status | Principal remaining gap |
| ---: | --- | --- | --- |
| 01 | `/command` | Individual composition implemented | Replace remaining demonstration aggregates with event/read-model projections. |
| 02 | `/factory` | Generic composition | Factory topology, queue lanes, capacity and bottleneck states. |
| 03 | `/markets` | Interactive reference map | Opportunity ranking and discovery workflow require dedicated structures. |
| 04 | `/campaigns` | Generic composition | Campaign lifecycle, budget pacing and experiment lineage. |
| 05 | `/channels` | Generic composition | Provider health, marginal response curves and channel constraints. |
| 06 | `/assets` | Generic composition | Searchable registry, claims, provenance and version history. |
| 07 | `/venture` | Generic composition | Investment memos, tranche gates and portfolio frontier. |
| 08 | `/treasury` | Generic composition | Wallet ledger, envelopes, reservations and authority history. |
| 09 | `/operations` | Generic composition | Durable job stream, retries, reconciliation and incidents. |
| 10 | `/audit` | Generic composition | Immutable event trail, policy evidence and replay. |
| 11 | `/brands` | Generic composition | Growth-contract editor and readiness validation. |
| 12–15 | Geographic references | Interactive polygons | Detail drawer and metric-driven layer switching. |
| 16 | `/capital-allocator` | Generic composition | Allocation curve, constraints, scenarios and proposal creation. |
| 17 | `/learning` | Generic composition | Knowledge graph, causal evidence and model promotion. |
| 18 | `/owner` | Generic composition | Executive exception queue and portfolio controls. |
| 19 | `/experiments` | Generic composition | Hypothesis contract, frozen forecast, stops and evaluation. |
| 20 | `/content-factory` | Generic composition | Brief/recipe/job/QA workflow and asset lineage. |
| 21 | `/distribution` | Generic composition | Authorization, pacing, delivery and reconciliation. |
| 22 | `/factory-config` | Generic composition | Safe editor for capabilities, providers and policy bounds. |

## Non-negotiable completion rules

- No screen is complete merely because its route renders.
- Geographic screens use real administrative polygons; synthetic heatmap cells
  are prohibited.
- Every mutation crosses a command/policy boundary and remains local in DRY RUN.
- Financial rails, external publishing and production providers remain disabled
  until separately authorized.
- Desktop and mobile behavior are verified for every completed tier.
