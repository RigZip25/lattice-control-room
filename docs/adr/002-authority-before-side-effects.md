# ADR 002: Authority is separate from recommendation and execution

Status: accepted

## Decision

A capital recommendation, an approved capital decision, a content brief and a
distribution authorization are distinct immutable records. No recommendation
or approval directly invokes an external provider.

The default distribution authorization is `BLOCKED`. It can become `AUTHORIZED`
only through a policy decision scoped to the exact brand, MarketCell, channel,
budget ceiling and expiration time.

## Rationale

Connectivity is not authority. Separating these records makes replay,
explanation, revocation and audit possible while keeping future provider
adapters replaceable.

