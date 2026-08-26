# ADR 008: Treasury wallet and funding rails

## Decision

LATTICE uses one workspace Treasury Wallet as the source of settled budget.
Bank ACH and PayPal are replaceable funding rails, never the system of record.
Verified provider events create immutable ledger entries; pending funds are not
spendable. Treasury creates bounded project envelopes from settled balance.

Autonomous agents may reserve and spend only inside an envelope and the active
Financial Authority Policy. Connecting an account, raising authority, enabling
withdrawals, changing payout destinations, or withdrawing funds requires owner
consent. A kill switch blocks new financial authority immediately.

Provider credentials remain in a secrets manager. Domain records store opaque
provider references only. Webhooks must be signature-verified, replay-safe, and
reconciled against provider statements before funds become settled.

## Initial provider direction

- US bank funding: an account-linking and ACH processor adapter (for example,
  Plaid Link plus Transfer or an approved processing partner).
- PayPal funding: PayPal REST integration with verified webhook ingestion.
- Local development: deterministic fake adapter; no credentials or movement.

The provider choice is deferred until legal entity, operating countries,
custody model, KYC/AML obligations, fees and settlement requirements are known.
