-- 0003 — block re-registration of anonymized students (security review M-1; ARCHITECTURE §3 "Anonymized students cannot log in")
--
-- Anonymizing a student clears their e-mail and student code, so without this table the same person could sign in
-- again and get a fresh account. We store only keyed hashes: HMAC-SHA256("email:<lower-cased e-mail>") and
-- HMAC-SHA256("code:<student code>") with SESSION_SECRET as the key (hex). No personal data is stored.
-- A hard DELETE of a student does NOT add hashes (a deleted student may register again).
-- NOTE: rotating SESSION_SECRET invalidates these hashes (anonymized students could then sign up again).
--
-- Rollback (manual): DROP TABLE anonymized_identities;

CREATE TABLE anonymized_identities (
  hash        TEXT PRIMARY KEY,
  created_at  TEXT NOT NULL
);
