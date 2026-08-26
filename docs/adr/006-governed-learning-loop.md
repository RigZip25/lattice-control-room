# ADR 006: Governed learning instead of self-modifying production logic

Status: accepted

## Decision

LATTICE separates model inference, learning proposals, deterministic policy and
external execution. Observed outcomes may produce a challenger artifact, but
only an evaluated promotion record can make it champion. Historical models and
decision snapshots remain immutable.

## Rationale

Uncontrolled online self-training creates feedback loops, attribution errors,
cross-customer leakage and silent strategy drift. A proposal/promotion model
preserves learning speed while keeping evidence, rollback and authority clear.

