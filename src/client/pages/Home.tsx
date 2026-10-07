import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function Home() {
  const [code, setCode] = useState("");
  const navigate = useNavigate();

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

      <p className="center presenter-link">
        <Link to="/login?next=/create" className="muted small">
          Presenter login →
        </Link>
      </p>
    </main>
  );
}
