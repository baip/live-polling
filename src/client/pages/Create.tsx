import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { getPresenterToken } from "../auth";
import type { QuestionInput, QuestionType } from "../../shared/types";

interface DraftQuestion extends QuestionInput {
  key: number;
}

let nextKey = 1;

function newQuestion(type: QuestionType): DraftQuestion {
  const base: DraftQuestion = { key: nextKey++, type, prompt: "", title: "", description: "" };
  if (type === "mc" || type === "quiz") {
    base.options = ["", ""];
    if (type === "quiz") {
      base.correctIndex = 0;
      base.timeLimitSec = 20;
    }
  }
  if (type === "wordcloud") base.allowMultiple = false;
  return base;
}

const TYPE_LABELS: Record<QuestionType, string> = {
  mc: "Multiple choice",
  wordcloud: "Word cloud",
  quiz: "Quiz",
  feedback: "Feedback",
};

/** Read an image file, downscale to fit within `max` px, return a data URL. */
function fileToDataUrl(file: File, max = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas unavailable"));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    img.src = url;
  });
}

export default function Create() {
  const [title, setTitle] = useState("My presentation");
  const [questions, setQuestions] = useState<DraftQuestion[]>([newQuestion("mc")]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!getPresenterToken()) navigate("/login?next=/create", { replace: true });
  }, [navigate]);

  const importFile = async (file: File) => {
    setImportError(null);
    setImporting(true);
    try {
      const parsed = JSON.parse(await file.text()) as {
        title?: string;
        questions?: unknown;
      };
      if (!parsed.title || !Array.isArray(parsed.questions))
        throw new Error("Not a valid presentation file.");
      const res = await api.importPresentation({
        title: parsed.title,
        questions: parsed.questions as never,
        presenterToken: getPresenterToken() ?? undefined,
      });
      sessionStorage.setItem(`presenter:${res.code}`, res.presenterKey);
      navigate(`/present/${res.code}`);
    } catch (e) {
      setImportError(
        e instanceof Error && e.message === "not_authenticated"
          ? "Your login has expired — please log in again."
          : e instanceof Error
            ? e.message
            : "Import failed."
      );
      setImporting(false);
    }
  };

  const update = (key: number, patch: Partial<DraftQuestion>) =>
    setQuestions((qs) => qs.map((q) => (q.key === key ? { ...q, ...patch } : q)));

  const setOption = (key: number, index: number, value: string) =>
    setQuestions((qs) =>
      qs.map((q) => {
        if (q.key !== key || !q.options) return q;
        const options = [...q.options];
        options[index] = value;
        return { ...q, options };
      })
    );

  const addOption = (key: number) =>
    setQuestions((qs) =>
      qs.map((q) =>
        q.key === key && q.options && q.options.length < 6
          ? { ...q, options: [...q.options, ""] }
          : q
      )
    );

  const removeOption = (key: number, index: number) =>
    setQuestions((qs) =>
      qs.map((q) => {
        if (q.key !== key || !q.options || q.options.length <= 2) return q;
        const options = q.options.filter((_, i) => i !== index);
        const correctIndex =
          q.correctIndex != null && q.correctIndex >= options.length
            ? options.length - 1
            : q.correctIndex;
        return { ...q, options, correctIndex };
      })
    );

  const addQuestion = (type: QuestionType) =>
    setQuestions((qs) => (qs.length < 20 ? [...qs, newQuestion(type)] : qs));

  const validate = (): string | null => {
    if (!title.trim()) return "Title is required.";
    for (const [i, q] of questions.entries()) {
      const label = `Question ${i + 1}`;
      if (!q.prompt.trim()) return `${label}: prompt is required.`;
      if (q.type === "mc" || q.type === "quiz") {
        const opts = (q.options ?? []).map((o) => o.trim());
        if (opts.length < 2 || opts.some((o) => !o))
          return `${label}: needs at least 2 non-empty options.`;
      }
    }
    return null;
  };

  const submit = async () => {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        title: title.trim(),
        presenterToken: getPresenterToken() ?? undefined,
        questions: questions.map(({ key: _key, ...q }) => ({
          ...q,
          prompt: q.prompt.trim(),
          title: q.title?.trim() || undefined,
          description: q.description?.trim() || undefined,
          options: q.options?.map((o) => o.trim()),
        })),
      };
      const res = await api.createPresentation(payload);
      sessionStorage.setItem(`presenter:${res.code}`, res.presenterKey);
      navigate(`/present/${res.code}`);
    } catch (e) {
      setError(
        e instanceof Error && e.message === "not_authenticated"
          ? "Your login has expired — please log in again."
          : e instanceof Error
            ? e.message
            : "Failed to create presentation."
      );
      setSubmitting(false);
    }
  };

  return (
    <main className="container">
      <h1>Create presentation</h1>

      <label className="field">
        <span>Title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
      </label>

      {questions.map((q, qi) => (
        <section key={q.key} className="card">
          <div className="card-header">
            <h2>
              {qi + 1}. {TYPE_LABELS[q.type]}
            </h2>
            {questions.length > 1 && (
              <button
                className="ghost"
                onClick={() => setQuestions((qs) => qs.filter((x) => x.key !== q.key))}
              >
                Remove
              </button>
            )}
          </div>

          <label className="field">
            <span>Title (optional)</span>
            <input
              value={q.title ?? ""}
              onChange={(e) => update(q.key, { title: e.target.value })}
              maxLength={120}
              placeholder="Short headline"
            />
          </label>

          <label className="field">
            <span>Prompt</span>
            <input
              value={q.prompt}
              onChange={(e) => update(q.key, { prompt: e.target.value })}
              maxLength={300}
              placeholder="What should the audience answer?"
            />
          </label>

          <label className="field">
            <span>Description (optional)</span>
            <textarea
              className="textarea"
              value={q.description ?? ""}
              onChange={(e) => update(q.key, { description: e.target.value })}
              maxLength={1000}
              rows={2}
              placeholder="Extra context shown to voters"
            />
          </label>

          {q.options && (
            <div className="options">
              {q.options.map((opt, oi) => (
                <div key={oi} className="option-row">
                  <input
                    value={opt}
                    onChange={(e) => setOption(q.key, oi, e.target.value)}
                    placeholder={`Option ${oi + 1}`}
                    maxLength={80}
                  />
                  {q.type === "quiz" && (
                    <label className="correct-toggle">
                      <input
                        type="radio"
                        name={`correct-${q.key}`}
                        checked={q.correctIndex === oi}
                        onChange={() => update(q.key, { correctIndex: oi })}
                      />
                      correct
                    </label>
                  )}
                  <button
                    className="ghost"
                    onClick={() => removeOption(q.key, oi)}
                    disabled={(q.options?.length ?? 0) <= 2}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                className="ghost"
                onClick={() => addOption(q.key)}
                disabled={(q.options?.length ?? 0) >= 6}
              >
                + Add option
              </button>
            </div>
          )}

          {q.type === "quiz" && (
            <label className="field inline">
              <span>Time limit (seconds)</span>
              <input
                type="number"
                min={5}
                max={300}
                value={q.timeLimitSec ?? 20}
                onChange={(e) => update(q.key, { timeLimitSec: Number(e.target.value) })}
              />
            </label>
          )}

          {q.type === "quiz" && (
            <div className="field">
              <span>Picture (optional)</span>
              {q.image ? (
                <div className="image-preview">
                  <img src={q.image} alt="Question" />
                  <button className="ghost" onClick={() => update(q.key, { image: undefined })}>
                    Remove image
                  </button>
                </div>
              ) : (
                <label className="button secondary import-button">
                  Upload image
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (!f) return;
                      try {
                        update(q.key, { image: await fileToDataUrl(f) });
                      } catch {
                        setError("Could not process that image.");
                      }
                    }}
                  />
                </label>
              )}
            </div>
          )}

          {q.type === "wordcloud" && (
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={!!q.allowMultiple}
                onChange={(e) => update(q.key, { allowMultiple: e.target.checked })}
              />
              <span>Allow multiple entries per participant</span>
            </label>
          )}

          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={!!q.showLeaderboard}
              onChange={(e) => update(q.key, { showLeaderboard: e.target.checked })}
            />
            <span>Show leaderboard after this question</span>
          </label>
        </section>
      ))}

      <div className="add-row">
        <button className="secondary" onClick={() => addQuestion("mc")}>
          + Multiple choice
        </button>
        <button className="secondary" onClick={() => addQuestion("wordcloud")}>
          + Word cloud
        </button>
        <button className="secondary" onClick={() => addQuestion("quiz")}>
          + Quiz
        </button>
        <button className="secondary" onClick={() => addQuestion("feedback")}>
          + Feedback
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      <button className="primary big" onClick={submit} disabled={submitting}>
        {submitting ? "Creating…" : "Create presentation"}
      </button>

      <div className="card">
        <h2>Import instead</h2>
        <p className="muted small">Start a new session from an exported JSON file.</p>
        <label className="button secondary import-button">
          {importing ? "Importing…" : "Import from JSON"}
          <input
            type="file"
            accept="application/json,.json"
            hidden
            disabled={importing}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importFile(f);
              e.target.value = "";
            }}
          />
        </label>
        {importError && <p className="error">{importError}</p>}
      </div>
    </main>
  );
}
