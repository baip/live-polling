import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import QRCode from "react-qr-code";
import { api } from "../api";
import { usePoll } from "../hooks/usePoll";
import { FeedbackList, HiddenResults, Leaderboard, ResultsView } from "../components/Results";
import type { ControlAction } from "../../shared/types";

const TYPE_LABELS: Record<string, string> = {
  mc: "Multiple choice",
  wordcloud: "Word cloud",
  quiz: "Quiz",
  feedback: "Feedback",
};

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
  const [busy, setBusy] = useState(false);

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
    setBusy(true);
    try {
      await api.control(code, presenterKey, action);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const joinUrl = `${window.location.origin}/join?code=${data.code}`;
  const q = data.currentQuestion;
  const isFeedback = q?.type === "feedback";
  // Results come from the server only after reveal; before that the presenter
  // sees the same hidden state as the audience.
  const resultsVisible = !!data.results || isFeedback;

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
          <QRCode value={joinUrl} size={180} />
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
          <button className="primary big" onClick={() => act("start")} disabled={busy}>
            Start session
          </button>
        </div>
      )}

      {(data.status === "active" || data.status === "revealing") && q && (
        <div className="card">
          {q.title && <p className="muted small question-title">{q.title}</p>}
          <h2>{q.prompt}</h2>
          {q.description && <p className="muted">{q.description}</p>}
          <p className="muted small">{TYPE_LABELS[q.type]}</p>

          {isFeedback ? (
            <FeedbackPanel code={data.code} presenterKey={presenterKey} questionId={q.id} />
          ) : resultsVisible && data.results ? (
            <ResultsView results={data.results} question={q} />
          ) : (
            <HiddenResults onReveal={() => act("reveal")} busy={busy} />
          )}

          <div className="controls">
            {data.status === "active" && !resultsVisible && (
              <button className="primary" onClick={() => act("reveal")} disabled={busy}>
                Reveal answers
              </button>
            )}
            {data.status === "revealing" && (
              <button className="primary" onClick={() => act("next")} disabled={busy}>
                {data.currentIndex + 1 >= data.questionCount ? "End session" : "Next question"}
              </button>
            )}
            <button className="ghost" onClick={() => act("close")} disabled={busy}>
              Close session
            </button>
          </div>
        </div>
      )}

      {data.leaderboard && (
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

      <div className="card">
        <h2>Export</h2>
        <div className="controls">
          <a className="button secondary" href={api.exportUrl(data.code, presenterKey)} download>
            Download presentation (JSON)
          </a>
          <a
            className="button secondary"
            href={api.resultsMarkdownUrl(data.code, presenterKey)}
            download
          >
            Download results (Markdown)
          </a>
        </div>
      </div>

      {actionError && <p className="error">{actionError}</p>}
    </main>
  );
}

/** Live feedback responses for the presenter (feedback has no aggregate). */
function FeedbackPanel({
  code,
  presenterKey,
  questionId,
}: {
  code: string;
  presenterKey: string;
  questionId: number;
}) {
  const { data } = usePoll(
    () =>
      fetch(
        `/api/presentations/${code}/feedback?presenterKey=${encodeURIComponent(presenterKey)}&questionId=${questionId}`
      ).then((r) => r.json() as Promise<{ responses: string[] }>),
    2000,
    [code, questionId]
  );
  return (
    <div>
      <FeedbackList responses={data?.responses ?? []} />
      {data && (
        <p className="muted small center">
          {data.responses.length} response{data.responses.length === 1 ? "" : "s"}
        </p>
      )}
    </div>
  );
}
