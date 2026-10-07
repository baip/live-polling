import { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { api, ApiError } from "../api";
import { usePoll } from "../hooks/usePoll";
import { useCountdown } from "../hooks/useCountdown";
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
  const [text, setText] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const q = data?.currentQuestion ?? null;
  const qid = q?.id ?? null;

  const countdown = useCountdown(
    q?.type === "quiz" ? q.startedAt : null,
    q?.type === "quiz" ? q.timeLimitSec : null,
    data?.serverTime
  );
  const timeUp = countdown !== null && countdown <= 0;

  useEffect(() => {
    setIntervalMs(data?.status === "lobby" ? 5000 : 2000);
  }, [data?.status]);

  useEffect(() => {
    setEarned(null);
    setText("");
    setSubmitError(null);
    setSubmitting(false);
  }, [qid]);

  if (!participantId) return <Navigate to={`/join?code=${code}`} replace />;
  if (!data) {
    return (
      <main className="container narrow">
        <p className="muted">{error ? `Error: ${error}` : "Loading…"}</p>
      </main>
    );
  }

  const multiEntry = q?.type === "wordcloud" && q.allowMultiple;
  const answered = (!!q && answeredQ === q.id && !multiEntry) || (!!data.myResponse && !multiEntry);
  const entries = data.myResponses ?? [];

  const submit = async (value: string | number) => {
    if (!q || submitting) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const res = await api.respond(code, { participantId, questionId: q.id, value });
      setAnsweredQ(q.id);
      setEarned(res.points);
      if (multiEntry) setText("");
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setAnsweredQ(q.id);
        if (e.message === "time_expired") setSubmitError("Time is up!");
      } else {
        setSubmitError(e instanceof Error ? e.message : "Submit failed");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const questionHeading = (
    <>
      {q?.title && <p className="muted small question-title">{q.title}</p>}
      <h1>{q?.prompt}</h1>
      {q?.image && <img className="question-image" src={q.image} alt="" />}
      {q?.description && <p className="muted">{q.description}</p>}
    </>
  );

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

      {data.status === "active" && q && q.type === "quiz" && (
        <div className={`countdown ${timeUp ? "expired" : countdown !== null && countdown <= 5 ? "low" : ""}`}>
          {countdown !== null ? `${countdown}s` : ""}
        </div>
      )}

      {data.status === "active" && q && !answered && !timeUp && (
        <div className="card">
          <p className="muted small">
            Question {data.currentIndex + 1} of {data.questionCount}
          </p>
          {questionHeading}
          {q.type === "wordcloud" || q.type === "feedback" ? (
            <div className="word-form-col">
              <form
                className="word-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (text.trim()) void submit(text);
                }}
              >
                {q.type === "feedback" ? (
                  <textarea
                    className="textarea"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    maxLength={500}
                    rows={4}
                    placeholder="Share your thoughts…"
                    autoFocus
                  />
                ) : (
                  <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    maxLength={40}
                    placeholder="Type one or two words…"
                    autoFocus
                  />
                )}
                <button className="primary" type="submit" disabled={submitting}>
                  Send
                </button>
              </form>
              {multiEntry && entries.length > 0 && (
                <div className="entries">
                  <p className="muted small">Your entries:</p>
                  <div className="entry-chips">
                    {entries.map((r, i) => (
                      <span key={i} className="chip">
                        {r.value}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {multiEntry && (
                <p className="muted small">You can submit as many entries as you like.</p>
              )}
            </div>
          ) : (
            <div className="answers">
              {(q.options ?? []).map((opt, i) => (
                <button
                  key={i}
                  className="answer-button"
                  onClick={() => void submit(i)}
                  disabled={submitting}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
          {q.type === "quiz" && <p className="muted small">Answer fast for bonus points!</p>}
        </div>
      )}

      {data.status === "active" && q && q.type === "quiz" && timeUp && !answered && (
        <div className="card center">
          <h1>Time&apos;s up!</h1>
          <p className="muted">Waiting for the presenter to reveal…</p>
        </div>
      )}

      {data.status === "active" && q && answered && (
        <div className="card center">
          <h1>Answer recorded ✓</h1>
          {earned != null && earned > 0 && <p>+{earned} points</p>}
          {multiEntry && entries.length > 0 && (
            <div className="entry-chips">
              {entries.map((r, i) => (
                <span key={i} className="chip">
                  {r.value}
                </span>
              ))}
            </div>
          )}
          <p className="muted">
            {multiEntry
              ? "Add more entries above, or wait for the presenter."
              : "Waiting for the presenter to reveal…"}
          </p>
        </div>
      )}

      {data.status === "revealing" && q && (
        <div className="card">
          {questionHeading}
          {q.type === "feedback" ? (
            <p className="muted center">Thanks for your feedback!</p>
          ) : data.results ? (
            <ResultsView results={data.results} question={q} />
          ) : null}
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
