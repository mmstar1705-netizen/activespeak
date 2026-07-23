-- Convert next_review and last_review from bigint (epoch ms) to timestamptz
-- so that ISO string values from the client are accepted natively.

-- First drop the default, then alter type, then set new default
ALTER TABLE words ALTER COLUMN next_review DROP DEFAULT;
ALTER TABLE words
  ALTER COLUMN next_review TYPE timestamptz USING to_timestamp(next_review / 1000.0);
ALTER TABLE words ALTER COLUMN next_review SET DEFAULT now();

ALTER TABLE words
  ALTER COLUMN last_review TYPE timestamptz USING to_timestamp(last_review / 1000.0);
