import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import type { QuestionInput, QuestionType } from "../../shared/types";

interface DraftQuestion extends QuestionInput {
  key: number;
}

let nextKey = 1;

function newQuestion(type: QuestionType): DraftQuestion {
  const base: DraftQuestion = { key: nextKey++, type, prompt: "" };
  if (type !== "wordcloud") {
    base.options = ["", ""];
    if (type === "quiz") {
      base.correctIndex = 0;
      base.timeLimitSec = 20;
    }
  }
  return base;
}

export default function Create() {
  const [title, setTitle] = useState("My presentation");
  const [questions, setQuestions] = useState<DraftQuestion[]>([newQuestion("mc")]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

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
      if (q.type !== "wordcloud") {
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
        questions: questions.map(({ key: _key, ...q }) => ({
          ...q,
          prompt: q.prompt.trim(),
          options: q.options?.map((o) => o.trim()),
        })),
      };
      const res = await api.createPresentation(payload);
      sessionStorage.setItem(`presenter:${res.code}`, res.presenterKey);
      navigate(`/present/${res.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create presentation.");
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
              {qi + 1}.{" "}
              {q.type === "mc" ? "Multiple choice" : q.type === "quiz" ? "Quiz" : "Word cloud"}
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
            <span>Prompt</span>
            <input
              value={q.prompt}
              onChange={(e) => update(q.key, { prompt: e.target.value })}
              maxLength={300}
              placeholder="What should the audience answer?"
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
      </div>

      {error && <p className="error">{error}</p>}
      <button className="primary big" onClick={submit} disabled={submitting}>
        {submitting ? "Creating…" : "Create presentation"}
      </button>
    </main>
  );
}
