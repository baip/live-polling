CREATE TABLE presentations (
  code TEXT PRIMARY KEY,
  presenter_key TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'lobby',
  current_index INTEGER NOT NULL DEFAULT -1,
  question_started_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  presentation_code TEXT NOT NULL REFERENCES presentations(code),
  idx INTEGER NOT NULL,
  type TEXT NOT NULL,
  prompt TEXT NOT NULL,
  options TEXT,
  correct_index INTEGER,
  time_limit_sec INTEGER,
  UNIQUE (presentation_code, idx)
);

CREATE TABLE participants (
  id TEXT PRIMARY KEY,
  presentation_code TEXT NOT NULL REFERENCES presentations(code),
  nickname TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Vote-once enforcement: composite primary key.
CREATE TABLE responses (
  question_id INTEGER NOT NULL REFERENCES questions(id),
  participant_id TEXT NOT NULL REFERENCES participants(id),
  value TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  answered_at INTEGER NOT NULL,
  PRIMARY KEY (question_id, participant_id)
);

CREATE INDEX idx_participants_presentation ON participants(presentation_code);
