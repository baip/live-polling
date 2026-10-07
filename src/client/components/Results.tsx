import type { LeaderboardEntry, PublicQuestion, Results } from "../../shared/types";

export function ChoiceChart({
  options,
  counts,
  correctIndex,
  total,
}: {
  options: string[];
  counts: number[];
  correctIndex?: number | null;
  total?: number;
}) {
  const max = Math.max(1, ...counts);
  return (
    <div>
      <div className="choice-chart">
        {options.map((opt, i) => (
          <div key={i} className={`choice-row ${correctIndex === i ? "correct" : ""}`}>
            <div className="choice-label">{opt}</div>
            <div className="choice-bar-track">
              <div className="choice-bar" style={{ width: `${(counts[i] / max) * 100}%` }} />
            </div>
            <div className="choice-count">{counts[i]}</div>
          </div>
        ))}
      </div>
      {total != null && (
        <p className="muted small center">
          {total} vote{total === 1 ? "" : "s"}
        </p>
      )}
    </div>
  );
}

export function WordCloud({
  words,
  total,
}: {
  words: { text: string; count: number }[];
  total?: number;
}) {
  if (words.length === 0) return <p className="muted">No words yet.</p>;
  const max = Math.max(1, ...words.map((w) => w.count));
  return (
    <div>
      <div className="word-cloud">
        {words.map((w, i) => {
          const scale = w.count / max;
          const size = 16 + scale * 44;
          const rot = ((i * 47) % 11) - 5;
          return (
            <span
              key={w.text}
              className="word"
              style={{
                fontSize: `${size}px`,
                opacity: 0.55 + 0.45 * scale,
                transform: `rotate(${rot}deg)`,
              }}
            >
              {w.text}
            </span>
          );
        })}
      </div>
      {total != null && (
        <p className="muted small center">
          {total} entr{total === 1 ? "y" : "ies"}
        </p>
      )}
    </div>
  );
}

export function FeedbackList({ responses }: { responses: string[] }) {
  if (responses.length === 0) return <p className="muted">No feedback yet.</p>;
  return (
    <ul className="feedback-list">
      {responses.map((r, i) => (
        <li key={i}>{r}</li>
      ))}
    </ul>
  );
}

export function HiddenResults({ onReveal, busy }: { onReveal: () => void; busy?: boolean }) {
  return (
    <div className="hidden-results">
      <p className="muted">Results are hidden from everyone.</p>
      <button className="primary" onClick={onReveal} disabled={busy}>
        Reveal results
      </button>
    </div>
  );
}

export function Leaderboard({
  entries,
  highlightId,
}: {
  entries: LeaderboardEntry[];
  highlightId?: string | null;
}) {
  if (entries.length === 0) return <p className="muted">No participants yet.</p>;
  return (
    <ol className="leaderboard">
      {entries.map((e) => (
        <li
          key={e.participantId}
          className={e.participantId === highlightId ? "highlight" : undefined}
        >
          <span className="lb-name">{e.nickname}</span>
          <span className="lb-score">{e.score}</span>
        </li>
      ))}
    </ol>
  );
}

export function ResultsView({
  results,
  question,
}: {
  results: Results;
  question: PublicQuestion | null;
}) {
  if (results.kind === "words") return <WordCloud words={results.words} total={results.total} />;
  return (
    <ChoiceChart
      options={question?.options ?? []}
      counts={results.counts}
      correctIndex={question?.correctIndex}
      total={results.total}
    />
  );
}
