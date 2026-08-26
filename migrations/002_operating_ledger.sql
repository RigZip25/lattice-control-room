BEGIN;

CREATE TABLE treasury_wallet (
  workspace_id text PRIMARY KEY REFERENCES lattice_workspace(workspace_id),
  wallet_id text NOT NULL UNIQUE,
  currency text NOT NULL CHECK (currency = 'USD'),
  settled_usd numeric(18,2) NOT NULL DEFAULT 0 CHECK (settled_usd >= 0),
  pending_usd numeric(18,2) NOT NULL DEFAULT 0 CHECK (pending_usd >= 0),
  reserved_usd numeric(18,2) NOT NULL DEFAULT 0 CHECK (reserved_usd >= 0),
  CHECK (reserved_usd <= settled_usd)
);

CREATE TABLE wallet_ledger_entry (
  workspace_id text NOT NULL REFERENCES lattice_workspace(workspace_id),
  entry_id text NOT NULL,
  wallet_id text NOT NULL,
  external_event_id text NOT NULL,
  entry_kind text NOT NULL CHECK (entry_kind IN ('DEPOSIT_PENDING','DEPOSIT_SETTLED','DEPOSIT_REVERSED','RESERVATION','RELEASE','SPEND')),
  amount_usd numeric(18,2) NOT NULL CHECK (amount_usd > 0),
  occurred_at timestamptz NOT NULL,
  payload_hash text NOT NULL,
  PRIMARY KEY (workspace_id, entry_id),
  UNIQUE (workspace_id, external_event_id, entry_kind),
  FOREIGN KEY (workspace_id, wallet_id) REFERENCES treasury_wallet(workspace_id, wallet_id)
);

CREATE TABLE financial_authority_policy (
  workspace_id text NOT NULL REFERENCES lattice_workspace(workspace_id),
  policy_id text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  effective_at timestamptz NOT NULL,
  expires_at timestamptz,
  maximum_decision_usd numeric(18,2) NOT NULL CHECK (maximum_decision_usd >= 0),
  maximum_daily_usd numeric(18,2) NOT NULL CHECK (maximum_daily_usd >= 0),
  maximum_exposure_usd numeric(18,2) NOT NULL CHECK (maximum_exposure_usd >= 0),
  brand_limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  kill_switch boolean NOT NULL DEFAULT true,
  PRIMARY KEY (workspace_id, policy_id),
  UNIQUE (workspace_id, version)
);

CREATE TABLE capital_request (
  workspace_id text NOT NULL REFERENCES lattice_workspace(workspace_id),
  request_id text NOT NULL,
  brand_id text NOT NULL,
  market_cell_id text NOT NULL,
  hypothesis_id text NOT NULL,
  requested_usd numeric(18,2) NOT NULL CHECK (requested_usd > 0),
  forecast_outcome numeric NOT NULL,
  confidence text NOT NULL CHECK (confidence IN ('LOW','MEDIUM','HIGH')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, request_id),
  FOREIGN KEY (workspace_id, brand_id) REFERENCES brand_line(workspace_id, brand_id)
);

CREATE TABLE venture_decision (
  workspace_id text NOT NULL REFERENCES lattice_workspace(workspace_id),
  decision_id text NOT NULL,
  request_id text NOT NULL,
  decision_kind text NOT NULL CHECK (decision_kind IN ('APPROVE','MODIFY','DEFER','REJECT')),
  approved_usd numeric(18,2) NOT NULL CHECK (approved_usd >= 0),
  policy_version text NOT NULL,
  reason_codes jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, decision_id),
  FOREIGN KEY (workspace_id, request_id) REFERENCES capital_request(workspace_id, request_id)
);

CREATE TABLE project_budget_envelope (
  workspace_id text NOT NULL REFERENCES lattice_workspace(workspace_id),
  envelope_id text NOT NULL,
  wallet_id text NOT NULL,
  brand_id text NOT NULL,
  authorized_usd numeric(18,2) NOT NULL CHECK (authorized_usd >= 0),
  reserved_usd numeric(18,2) NOT NULL DEFAULT 0 CHECK (reserved_usd >= 0),
  spent_usd numeric(18,2) NOT NULL DEFAULT 0 CHECK (spent_usd >= 0),
  policy_version integer NOT NULL CHECK (policy_version > 0),
  PRIMARY KEY (workspace_id, envelope_id),
  FOREIGN KEY (workspace_id, wallet_id) REFERENCES treasury_wallet(workspace_id, wallet_id),
  FOREIGN KEY (workspace_id, brand_id) REFERENCES brand_line(workspace_id, brand_id),
  CHECK (reserved_usd + spent_usd <= authorized_usd)
);

CREATE TABLE metric_event (
  workspace_id text NOT NULL REFERENCES lattice_workspace(workspace_id),
  event_id text NOT NULL,
  brand_id text NOT NULL,
  metric_key text NOT NULL,
  market_cell_id text,
  value numeric NOT NULL,
  occurred_at timestamptz NOT NULL,
  source_ref text NOT NULL,
  payload_hash text NOT NULL,
  PRIMARY KEY (workspace_id, event_id),
  FOREIGN KEY (workspace_id, brand_id) REFERENCES brand_line(workspace_id, brand_id)
);

CREATE TABLE outcome_evaluation (
  workspace_id text NOT NULL REFERENCES lattice_workspace(workspace_id),
  evaluation_id text NOT NULL,
  venture_decision_id text NOT NULL,
  forecast_value numeric NOT NULL,
  observed_value numeric NOT NULL,
  variance numeric NOT NULL,
  evaluated_at timestamptz NOT NULL,
  metric_event_ids jsonb NOT NULL,
  PRIMARY KEY (workspace_id, evaluation_id),
  FOREIGN KEY (workspace_id, venture_decision_id) REFERENCES venture_decision(workspace_id, decision_id)
);

CREATE INDEX wallet_ledger_time_idx ON wallet_ledger_entry (workspace_id, occurred_at DESC);
CREATE INDEX metric_event_brand_time_idx ON metric_event (workspace_id, brand_id, occurred_at DESC);
CREATE INDEX venture_decision_time_idx ON venture_decision (workspace_id, created_at DESC);

REVOKE UPDATE, DELETE ON wallet_ledger_entry, capital_request, venture_decision, metric_event, outcome_evaluation FROM PUBLIC;

COMMIT;
