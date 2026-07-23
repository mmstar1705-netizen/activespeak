/*
# Create words, reviews, and settings tables for ActiveSpeak

1. Purpose
   - Migrate ActiveSpeak's data storage from LocalStorage to Supabase cloud for cross-device sync.
   - Three tables: `words` (vocabulary), `reviews` (review log for analytics), `settings` (user configuration).
   - Single-tenant app (no sign-in screen), so all policies use `TO anon, authenticated` with `USING (true)`.

2. New Tables

   a) `words` — the user's vocabulary library
      - id (uuid, PK, client-generated)
      - word (text, not null) — the English word
      - meaning (text) — Chinese meaning / definition
      - proficiency (text, default 'new') — 'new' | 'familiar' | 'mastered'
      - ef (double precision, default 2.5) — SM-2 easiness factor
      - interval (integer, default 0) — SM-2 interval in days
      - repetitions (integer, default 0) — SM-2 repetition count
      - next_review (bigint, not null) — next review timestamp (epoch ms)
      - last_review (bigint) — last review timestamp (epoch ms, nullable)
      - paused (boolean, default false) — whether the word is paused
      - success_count (integer, default 0) — consecutive correct answers
      - created_at (timestamptz, default now())
      - updated_at (timestamptz, default now())

   b) `reviews` — log of every review event for analytics
      - id (uuid, PK, auto-generated)
      - word_id (uuid, FK -> words.id ON DELETE CASCADE)
      - quality (integer, not null) — SM-2 quality grade 0-5
      - score (integer) — AI score 0-100
      - reviewed_at (timestamptz, default now())

   c) `settings` — single-row user settings table
      - id (integer, PK, always 1 — singleton)
      - data (jsonb, not null) — full settings object as JSON
      - updated_at (timestamptz, default now())

3. Security
   - RLS enabled on all three tables.
   - All policies use `TO anon, authenticated` because this is a single-tenant no-auth app.
   - `USING (true)` / `WITH CHECK (true)` because all data is intentionally shared (no multi-user isolation).

4. Indexes
   - `words.next_review` — for due-word queries
   - `reviews.word_id` — for per-word review history lookups
*/

-- ── words table ──
CREATE TABLE IF NOT EXISTS words (
  id uuid PRIMARY KEY,
  word text NOT NULL,
  meaning text DEFAULT '',
  proficiency text NOT NULL DEFAULT 'new',
  ef double precision NOT NULL DEFAULT 2.5,
  interval integer NOT NULL DEFAULT 0,
  repetitions integer NOT NULL DEFAULT 0,
  next_review bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  last_review bigint,
  paused boolean NOT NULL DEFAULT false,
  success_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE words ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_words" ON words;
CREATE POLICY "anon_select_words" ON words FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_words" ON words;
CREATE POLICY "anon_insert_words" ON words FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_words" ON words;
CREATE POLICY "anon_update_words" ON words FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_words" ON words;
CREATE POLICY "anon_delete_words" ON words FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_words_next_review ON words (next_review);

-- ── reviews table ──
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  word_id uuid NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  quality integer NOT NULL,
  score integer,
  reviewed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_reviews" ON reviews;
CREATE POLICY "anon_select_reviews" ON reviews FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_reviews" ON reviews;
CREATE POLICY "anon_insert_reviews" ON reviews FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_reviews" ON reviews;
CREATE POLICY "anon_update_reviews" ON reviews FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_reviews" ON reviews;
CREATE POLICY "anon_delete_reviews" ON reviews FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_reviews_word_id ON reviews (word_id);

-- ── settings table (singleton: id always = 1) ──
CREATE TABLE IF NOT EXISTS settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_settings" ON settings;
CREATE POLICY "anon_select_settings" ON settings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_settings" ON settings;
CREATE POLICY "anon_insert_settings" ON settings FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_settings" ON settings;
CREATE POLICY "anon_update_settings" ON settings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_settings" ON settings;
CREATE POLICY "anon_delete_settings" ON settings FOR DELETE
  TO anon, authenticated USING (true);
