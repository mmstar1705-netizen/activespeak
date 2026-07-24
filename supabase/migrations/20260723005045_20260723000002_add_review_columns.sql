/*
# Add feedback, scene, user_text columns to reviews table

## Purpose
The Practice page needs to store the LLM feedback, the scene prompt, and the
user's spoken/typed text alongside each review record for history and
breakpoint-resume functionality.

## Modified Tables
### reviews
- `feedback` (text, nullable) — LLM polish feedback text
- `scene` (text, nullable) — the practice scene prompt that was shown
- `user_text` (text, nullable) — what the user spoke/typed for this review

## Security
No security changes — RLS already enabled, existing policies cover new columns.
*/

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS feedback text,
  ADD COLUMN IF NOT EXISTS scene text,
  ADD COLUMN IF NOT EXISTS user_text text;