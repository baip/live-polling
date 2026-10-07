import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";

export default function Home() {
  const [code, setCode] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const navigate = useNavigate();

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
      });
      sessionStorage.setItem(`presenter:${res.code}`, res.presenterKey);
      navigate(`/present/${res.code}`);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Import failed.");
      setImporting(false);
    }
  };

  return (
    <main className="container narrow">
      <h1 className="brand">Live Polling</h1>
      <p className="tagline">Anonymous live polls, word clouds and quizzes.</p>

      <div className="card">
        <h2>Join a session</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) navigate(`/join?code=${code.trim().toUpperCase()}`);
          }}
        >
          <input
            className="code-input"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABCD23"
            maxLength={6}
            autoComplete="off"
          />
          <button type="submit" className="primary">
            Join
          </button>
        </form>
      </div>

      <div className="card">
        <h2>Present</h2>
        <p>Create a presentation with polls, word clouds, quizzes and feedback.</p>
        <Link to="/create" className="button primary">
          Create a presentation
        </Link>
        <p className="muted small" style={{ marginTop: 16 }}>
          …or import a previously exported presentation:
        </p>
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
