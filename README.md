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

Capital is funded through a provider-neutral Treasury Wallet. Settled bank or
PayPal deposits may be divided into project envelopes; agents can act only
inside both the envelope and the owner's versioned Financial Authority Policy.

Every derived record preserves its inputs and semantic class (`FACT`,
`INFERRED`, or `FORECAST`). External side effects fail closed.

The local Control Room exposes the frozen RigZip scenario through a read-only,
loopback-only API and responsive operator dashboard. It shows portfolio state,
Treasury availability, delegated authority, the active market decision and
every gate requiring attention.

## Commands

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm demo
pnpm control-room
```

Then open `http://127.0.0.1:4310`. The service accepts GET requests only,
binds to the local machine and runs entirely from deterministic fixtures.

## Structure

- `docs/` — product foundation and durable architecture decisions.
- `packages/core/` — provider-neutral domain and application logic.
- `apps/demo/` — deterministic executable scenario.
- `apps/control-room/` — local read-only API and operator interface.
