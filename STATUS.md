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
- operating ledger migration for Wallet, Venture, project envelopes, metrics
  and outcome evaluation lineage;
- executable RigZip dry-run demo;
- loopback-only read API and responsive Control Room interface;
- strict TypeScript checks and 31 deterministic tests.

## Verified vertical

`ProductSnapshot -> GrowthContract -> BrandPackage -> Hypothesis -> Evidence -> Venture decision -> Financial Authority -> Treasury reservation -> Allocation Ticket -> ContentBrief -> blocked DistributionAuthorization`

## Safety state

No external provider, live advertising, publishing, bank access, production
credential, cloud database or deployment is configured. Demo distribution is
blocked by policy even when Venture capital is approved.

## Next implementation sequence

1. Add Evorios and a non-marketplace product fixture to prove funnel isolation.
2. Implement outcome evaluation against canonical metric events and frozen forecasts.
3. Add authenticated write commands while preserving the read-only dashboard boundary.
4. Extract the approved Figma design system into reusable UI tokens/components.
5. Connect sandbox PostgreSQL and provider adapters only after approval.

## External prerequisites

None for the next local milestone. Supabase and Vercel remain deferred until a
tested staging contour is ready.
