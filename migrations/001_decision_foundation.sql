BEGIN;

CREATE TABLE lattice_workspace (
  workspace_id text PRIMARY KEY,
  display_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('ACTIVE', 'SUSPENDED')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE brand_line (
  workspace_id text NOT NULL REFERENCES lattice_workspace(workspace_id),
  brand_id text NOT NULL,
  display_name text NOT NULL,
  growth_contract jsonb NOT NULL,
  growth_contract_version integer NOT NULL CHECK (growth_contract_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, brand_id)
);

CREATE TABLE decision_packet (
  workspace_id text NOT NULL REFERENCES lattice_workspace(workspace_id),
  decision_id text NOT NULL,
  brand_id text NOT NULL,
  market_cell_id text NOT NULL,
  hypothesis_id text NOT NULL,
  packet_fingerprint text NOT NULL,
  packet jsonb NOT NULL,
  decision_kind text NOT NULL CHECK (decision_kind IN ('APPROVE', 'MODIFY', 'DEFER', 'REJECT')),
  approved_usd numeric(18, 2) NOT NULL CHECK (approved_usd >= 0),
  authorization_state text NOT NULL CHECK (authorization_state IN ('BLOCKED', 'AUTHORIZED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, decision_id),
  FOREIGN KEY (workspace_id, brand_id) REFERENCES brand_line(workspace_id, brand_id),
  UNIQUE (workspace_id, packet_fingerprint)
);

CREATE INDEX decision_packet_workspace_brand_created_idx
  ON decision_packet (workspace_id, brand_id, created_at DESC);

REVOKE UPDATE, DELETE ON decision_packet FROM PUBLIC;

COMMIT;

