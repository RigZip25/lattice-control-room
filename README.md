# LATTICE Control Room

LATTICE is a full-cycle market-distribution operating system. It is initially
proven on Lafwiron's portfolio and designed to become a governed marketing
factory for external product organizations. It turns versioned product
knowledge into strategy, falsifiable experiments, creative production,
governed capital decisions, authorized distribution and durable learning.

This repository is a clean implementation baseline. The historical
`LATTICE-Market-Distribution-OS` repository is research input, not an upstream
code dependency.

## First executable proof

The initial vertical slice proves this decision chain without live providers,
spend or publication:

`ProductSnapshot -> BrandPackage -> MarketHypothesis -> ScoutEvidence -> CapitalDecision -> ContentBrief -> DistributionAuthorization`

Every derived record preserves its inputs and semantic class (`FACT`,
`INFERRED`, or `FORECAST`). External side effects fail closed.

## Commands

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm demo
```

## Structure

- `docs/` — product foundation and durable architecture decisions.
- `packages/core/` — provider-neutral domain and application logic.
- `apps/demo/` — deterministic executable scenario.
