import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import QRCode from "react-qr-code";
import { api } from "../api";
import { usePoll } from "../hooks/usePoll";
import { Leaderboard, ResultsView } from "../components/Results";
import type { ControlAction } from "../../shared/types";

export default function Present() {
  const { code = "" } = useParams();
  const presenterKey = sessionStorage.getItem(`presenter:${code}`);
  const [intervalMs, setIntervalMs] = useState(2500);
  const { data, error } = usePoll(
    () => api.getState(code, { presenterKey }),
    intervalMs,
    [code, presenterKey]
  );
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setIntervalMs(data?.status === "lobby" ? 5000 : 2000);
  }, [data?.status]);

  if (!presenterKey) {
    return (
      <main className="container narrow">
        <div className="card">
          <h1>Presenter key missing</h1>
          <p>
            This browser doesn&apos;t hold the presenter key for session {code}. Presentations
            must be controlled from the browser that created them.
          </p>
          <Link className="button secondary" to="/">
            Back home
          </Link>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="container narrow">
        <p className="muted">{error ? `Error: ${error}` : "Loading…"}</p>
      </main>
    );
  }

  const act = async (action: ControlAction) => {
    setActionError(null);
    try {
      await api.control(code, presenterKey, action);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Action failed");
    }
  };

  const joinUrl = `${window.location.origin}/join?code=${data.code}`;
  const q = data.currentQuestion;

  return (
    <main className="container wide">
      <header className="present-header">
        <div>
          <h1>{data.title}</h1>
          <p className="muted">
            {data.participantCount} participant{data.participantCount === 1 ? "" : "s"} ·{" "}
            {data.status}
            {data.currentIndex >= 0 && (
              <>
                {" "}
                · Question {data.currentIndex + 1} of {data.questionCount}
              </>
            )}
          </p>
        </div>
        <div className="join-box">
          <QRCode value={joinUrl} size={96} />
          <div>
            <div className="join-code">{data.code}</div>
            <div className="muted small">{joinUrl}</div>
          </div>
        </div>
      </header>

      {data.status === "lobby" && (
        <div className="card center">
          <h2>Lobby</h2>
          <p>Participants can join now. Start when ready.</p>
          <button className="primary big" onClick={() => act("start")}>
            Start session
          </button>
        </div>
      )}

      {(data.status === "active" || data.status === "revealing") && q && (
        <div className="card">
          <h2>{q.prompt}</h2>
          <p className="muted small">
            {q.type === "mc" ? "Multiple choice" : q.type === "quiz" ? "Quiz" : "Word cloud"}
          </p>
          {data.results ? (
            <ResultsView results={data.results} question={q} />
          ) : (
            <p className="muted">Waiting for answers…</p>
          )}
          <div className="controls">
            {data.status === "active" && (
              <button className="primary" onClick={() => act("reveal")}>
                Reveal answers
              </button>
            )}
            {data.status === "revealing" && (
              <button className="primary" onClick={() => act("next")}>
                {data.currentIndex + 1 >= data.questionCount ? "End session" : "Next question"}
              </button>
            )}
            <button className="ghost" onClick={() => act("close")}>
              Close session
            </button>
          </div>
        </div>
      )}

      {data.leaderboard && (data.status === "revealing" || data.status === "closed") && (
        <div className="card">
          <h2>Leaderboard</h2>
          <Leaderboard entries={data.leaderboard} />
        </div>
      )}

      {data.status === "closed" && (
        <div className="card center">
          <h2>Session closed</h2>
          <p>Thanks for presenting!</p>
        </div>
      )}

      {actionError && <p className="error">{actionError}</p>}
    </main>
  );
}
