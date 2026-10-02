import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";

export default function Join() {
  const [params] = useSearchParams();
  const [code, setCode] = useState(params.get("code") ?? "");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (!c || !nickname.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.join(c, nickname.trim());
      localStorage.setItem(`participant:${c}`, res.participantId);
      localStorage.setItem(`participant-name:${c}`, nickname.trim());
      navigate(`/play/${c}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join");
      setBusy(false);
    }
  };

  return (
    <main className="container narrow">
      <div className="card">
        <h1>Join session</h1>
        <form onSubmit={submit}>
          <label className="field">
            <span>Session code</span>
            <input
              className="code-input"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={6}
              placeholder="ABCD23"
              autoComplete="off"
            />
          </label>
          <label className="field">
            <span>Nickname</span>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={30}
              placeholder="Shown on the leaderboard"
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="primary big" type="submit" disabled={busy}>
            {busy ? "Joining…" : "Join"}
          </button>
        </form>
      </div>
    </main>
  );
}
