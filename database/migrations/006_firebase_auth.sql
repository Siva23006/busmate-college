-- BusMate College: link each user to their Firebase Authentication account.
-- Firebase stores/checks passwords and sends "forgot password" emails.
ALTER TABLE users ADD COLUMN IF NOT EXISTS firebase_uid TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_firebase_uid_idx ON users (firebase_uid) WHERE firebase_uid IS NOT NULL;
