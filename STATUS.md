# LATTICE Control Room — status

## Current milestone

Foundation and first governed decision vertical slice.

## Implemented

- clean TypeScript/pnpm workspace;
- product and architecture foundation;
- workspace + brand isolation primitives;
- product-specific Growth Contracts;
- replaceable Capability Registry;
- deterministic product-to-market decision packet;
- immutable/replay-safe in-memory packet store;
- principal/role-scoped Decision Service;
- separate Venture, Treasury reservation and Allocation Ticket contracts;
- versioned dynamic financial authority with human escalation and kill switch;
- provider-neutral Treasury Wallet, settled-deposit ledger and project budgets;
- canonical Metric Definition and Event contracts;
- bounded Opportunity Scout proposals with evidence gaps;
- governed model artifacts, evaluation and champion/challenger promotion;
- initial portable PostgreSQL foundation migration;
- executable RigZip dry-run demo;
- strict TypeScript checks and 30 deterministic tests.

## Verified vertical

`ProductSnapshot -> GrowthContract -> BrandPackage -> Hypothesis -> Evidence -> Venture decision -> Financial Authority -> Treasury reservation -> Allocation Ticket -> ContentBrief -> blocked DistributionAuthorization`

## Safety state

No external provider, live advertising, publishing, bank access, production
credential, cloud database or deployment is configured. Demo distribution is
blocked by policy even when Venture capital is approved.

## Next implementation sequence

1. Expand PostgreSQL migrations for Venture, Treasury Wallet, metrics, intelligence
   lineage and financial authority.
3. Add transport-neutral API schemas and an authenticated local HTTP adapter.
4. Build canonical read models for Command Center and Venture surfaces.
5. Extract Figma tokens/context and implement the Control Room shell.
6. Add Evorios and a non-marketplace product fixture to prove funnel isolation.
7. Add outcome evaluation linking canonical events back to frozen forecasts.

## External prerequisites

None for the next local milestone. Supabase and Vercel remain deferred until a
tested staging contour is ready.
