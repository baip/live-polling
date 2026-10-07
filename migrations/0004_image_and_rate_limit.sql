ALTER TABLE questions ADD COLUMN image TEXT;

CREATE TABLE passcode_attempts (
  ip TEXT PRIMARY KEY,
  failures INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER
);
