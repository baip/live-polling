import { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { api, ApiError } from "../api";
import { usePoll } from "../hooks/usePoll";
import { Leaderboard, ResultsView } from "../components/Results";

export default function Play() {
  const { code = "" } = useParams();
  const participantId = localStorage.getItem(`participant:${code}`);
  const nickname = localStorage.getItem(`participant-name:${code}`) ?? "";
  const [intervalMs, setIntervalMs] = useState(2500);
  const { data, error } = usePoll(
    () => api.getState(code, { participantId }),
    intervalMs,
    [code, participantId]
  );
  const [answeredQ, setAnsweredQ] = useState<number | null>(null);
  const [earned, setEarned] = useState<number | null>(null);
  const [word, setWord] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const q = data?.currentQuestion ?? null;
  const qid = q?.id ?? null;

  useEffect(() => {
    setIntervalMs(data?.status === "lobby" ? 5000 : 2000);
  }, [data?.status]);

  useEffect(() => {
    setEarned(null);
    setWord("");
    setSubmitError(null);
  }, [qid]);

  if (!participantId) return <Navigate to={`/join?code=${code}`} replace />;
  if (!data) {
    return (
      <main className="container narrow">
        <p className="muted">{error ? `Error: ${error}` : "Loading…"}</p>
      </main>
    );
  }

  const answered = (!!q && answeredQ === q.id) || !!data.myResponse;

  const submit = async (value: string | number) => {
    if (!q) return;
    setSubmitError(null);
    try {
      const res = await api.respond(code, { participantId, questionId: q.id, value });
      setAnsweredQ(q.id);
      setEarned(res.points);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setAnsweredQ(q.id);
      } else {
        setSubmitError(e instanceof Error ? e.message : "Submit failed");
      }
    }
  };

  return (
    <main className="container narrow">
      <header className="play-header">
        <span className="badge">{data.code}</span>
        <span className="muted">{nickname}</span>
      </header>

      {data.status === "lobby" && (
        <div className="card center">
          <h1>{data.title}</h1>
          <p>You&apos;re in! Waiting for the presenter to start…</p>
          <p className="spinner" aria-hidden>
            ●●●
          </p>
        </div>
      )}

      {data.status === "active" && q && !answered && (
        <div className="card">
          <p className="muted small">
            Question {data.currentIndex + 1} of {data.questionCount}
          </p>
          <h1>{q.prompt}</h1>
          {q.type === "wordcloud" ? (
            <form
              className="word-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (word.trim()) void submit(word);
              }}
            >
              <input
                value={word}
                onChange={(e) => setWord(e.target.value)}
                maxLength={40}
                placeholder="Type one or two words…"
                autoFocus
              />
              <button className="primary" type="submit">
                Send
              </button>
            </form>
          ) : (
            <div className="answers">
              {(q.options ?? []).map((opt, i) => (
                <button key={i} className="answer-button" onClick={() => void submit(i)}>
                  {opt}
                </button>
              ))}
            </div>
          )}
          {q.type === "quiz" && <p className="muted small">Answer fast for bonus points!</p>}
        </div>
      )}

      {data.status === "active" && q && answered && (
        <div className="card center">
          <h1>Answer recorded ✓</h1>
          {earned != null && earned > 0 && <p>+{earned} points</p>}
          <p className="muted">Waiting for the presenter to reveal…</p>
        </div>
      )}

      {data.status === "revealing" && q && (
        <div className="card">
          <h1>{q.prompt}</h1>
          {data.results && <ResultsView results={data.results} question={q} />}
          {data.myResponse && data.myResponse.points > 0 && (
            <p className="center">You earned +{data.myResponse.points} points!</p>
          )}
          {data.leaderboard && (
            <Leaderboard entries={data.leaderboard} highlightId={participantId} />
          )}
        </div>
      )}

      {data.status === "closed" && (
        <div className="card">
          <h1 className="center">Session over — thanks for playing!</h1>
          {data.leaderboard && (
            <Leaderboard entries={data.leaderboard} highlightId={participantId} />
          )}
        </div>
      )}

      {submitError && <p className="error">{submitError}</p>}
    </main>
  );
}
