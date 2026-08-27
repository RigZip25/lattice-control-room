# Financial authority policy

The workspace owner may delegate bounded financial decisions to LAFWIRON and
change that delegation over time.

Authority is expressed as a versioned policy, never as a hidden application
constant. A policy can define:

- maximum autonomous amount per Venture decision;
- maximum autonomous amount per rolling day;
- maximum concurrent reserved exposure;
- optional brand, MarketCell, channel and playbook limits;
- allowed decision/actor classes;
- effective and expiration time;
- human-approval threshold;
- workspace, brand or system kill switches.

Evaluation outcomes are `AUTONOMOUSLY_AUTHORIZED`,
`HUMAN_APPROVAL_REQUIRED`, or `DENIED`. The policy snapshot and evaluation are
stored with the reservation/allocation ticket.

Changing a policy creates a new version. It affects new authority evaluations
and does not rewrite historical decisions. A restrictive policy or kill switch
may freeze unclaimed tickets through an explicit auditable transition; settled
spend remains financial fact.

