-- Add a sequence column so multi-entry word-cloud questions can store several
-- rows per participant (seq = 0 for single-answer questions, so vote-once is
-- still enforced by the primary key).
CREATE TABLE responses_new (
  question_id INTEGER NOT NULL REFERENCES questions(id),
  participant_id TEXT NOT NULL REFERENCES participants(id),
  seq INTEGER NOT NULL DEFAULT 0,
  value TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  answered_at INTEGER NOT NULL,
  PRIMARY KEY (question_id, participant_id, seq)
);

INSERT INTO responses_new (question_id, participant_id, seq, value, points, answered_at)
SELECT question_id, participant_id, 0, value, points, answered_at FROM responses;

DROP TABLE responses;
ALTER TABLE responses_new RENAME TO responses;
