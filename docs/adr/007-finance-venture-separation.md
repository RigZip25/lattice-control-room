# ADR 007: Separate Treasury truth from Venture allocation judgment

Status: accepted

## Decision

Finance/Treasury owns balances, envelopes, reservations and ledger truth.
Venture owns opportunity ranking, forecasts and capital decisions. Their bridge
is an exact, replay-safe reservation and allocation ticket.

Neither contour inherits the other's authority.

