# ADR 001: Clean foundation with selective inheritance

Status: accepted

## Context

The research repository contains a strong Phase 2 runtime, detailed UI
contracts and several parallel branches, but its canonical `main` branch is
behind the most mature implementation and its documentation namespaces overlap.

## Decision

Build a clean repository around the canonical product loop. Historical code is
ported only when a current contract and test justify it. Git history from the
research repository remains available in a local mirror for provenance.

## Consequences

- We preserve ideas and proofs without inheriting branch/document drift.
- Ported runtime components must pass new repository tests.
- Figma screens are implemented against canonical read models, not copied demo
  values.
- The research repository can continue evolving without destabilizing this
  implementation.

