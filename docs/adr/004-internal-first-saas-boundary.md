# ADR 004: Internal-first with a SaaS-capable workspace boundary

Status: accepted

## Decision

Lafwiron is the first workspace, not a hard-coded owner of the domain. Every
stateful aggregate carries a workspace identity in addition to brand identity.
Authorization, budgets, provider accounts, evidence and learning are evaluated
inside that workspace boundary.

SaaS billing, self-service onboarding and plan entitlements are deferred until
the core loop works for Lafwiron. They will be adapters and commercial policy,
not reasons to redesign the decision domain.

## Consequences

- Cross-workspace access fails closed.
- Database keys and future row-level policies include workspace scope.
- Global prior libraries are immutable reference knowledge; customer-derived
  evidence is not globally shared by default.
- The internal product remains usable without SaaS infrastructure.

