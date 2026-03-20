-- Append-only versioning for claim sharpening (blockchain-ready lineage).
ALTER TABLE truth_nodes
  ADD COLUMN IF NOT EXISTS previous_version_id UUID REFERENCES truth_nodes(id);

CREATE INDEX IF NOT EXISTS idx_truth_nodes_previous_version_id ON truth_nodes(previous_version_id);
